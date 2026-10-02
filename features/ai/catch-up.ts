import type { CatchUp, CatchUpActionItem, CatchUpRequest, CatchUpResponse } from "./catch-up-types";
import { generateValidatedGeminiJson } from "./gemini";
import {
  type ParseResult,
  asRecord,
  describeTasks,
  describeUpdates,
  isStringArray,
  nonEmptyString,
  parseAsyncUpdates,
  parseMembers,
  parseMode,
  parseTasks,
} from "./ai-parse";

/**
 * Feature Owner: Divij Anand
 * SERVER ONLY. Missed-meeting catch-up for POST /api/catch-up.
 */

const NO_NOTES_MESSAGE = "No meeting notes were provided, so decisions from the meeting can't be confirmed.";
const MAX_SUMMARY_CHARS = 800;
const MAX_DECISIONS = 8;
const MAX_ACTION_ITEMS = 10;

type ParsedCatchUpRequest = Required<Omit<CatchUpRequest, "notes" | "absentMemberId">> &
  Pick<CatchUpRequest, "notes" | "absentMemberId">;

export function parseCatchUpRequest(body: unknown): ParseResult<ParsedCatchUpRequest> {
  const issues: string[] = [];
  const b = asRecord(body);
  const m = asRecord(b.meeting);

  if (!nonEmptyString(m.id) || !nonEmptyString(m.title)) issues.push("meeting needs an id and title.");
  const members = parseMembers(b.members, issues);
  const tasks = parseTasks(b.tasks, issues);
  const asyncUpdates = parseAsyncUpdates(b.asyncUpdates, issues);
  const mode = parseMode(b.mode, issues);

  if (b.notes !== undefined && typeof b.notes !== "string") issues.push("notes must be a string.");
  if (b.absentMemberId !== undefined && !members.some((member) => member.id === b.absentMemberId)) {
    issues.push("absentMemberId must match a member id.");
  }

  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    value: {
      mode,
      meeting: {
        id: m.id as string,
        title: m.title as string,
        scheduledTime: typeof m.scheduledTime === "string" ? m.scheduledTime : "",
        durationMinutes: typeof m.durationMinutes === "number" ? m.durationMinutes : 0,
        attendeeIds: isStringArray(m.attendeeIds) ? m.attendeeIds : [],
        agendaItems: isStringArray(m.agendaItems) ? m.agendaItems : [],
      },
      notes: typeof b.notes === "string" && b.notes.trim() ? b.notes.trim() : undefined,
      absentMemberId: b.absentMemberId as string | undefined,
      asyncUpdates,
      tasks,
      members,
    },
  };
}

function hasNotes(request: ParsedCatchUpRequest) {
  return Boolean(request.notes);
}

/** Validates Gemini output and enforces honesty rules that the prompt alone can't guarantee. */
export function validateCatchUp(raw: unknown, request: ParsedCatchUpRequest): ParseResult<CatchUp> {
  const issues: string[] = [];
  const r = asRecord(raw);
  const memberIds = new Set(request.members.map((m) => m.id));
  const taskIds = new Set(request.tasks.map((t) => t.id));

  if (!nonEmptyString(r.summary)) issues.push("summary is required.");
  else if (r.summary.length > MAX_SUMMARY_CHARS) issues.push(`summary must be under ${MAX_SUMMARY_CHARS} characters.`);

  if (!isStringArray(r.decisions)) issues.push("decisions must be a list of strings.");
  else if (r.decisions.length > MAX_DECISIONS) issues.push(`Return at most ${MAX_DECISIONS} decisions.`);
  else if (!hasNotes(request) && r.decisions.length > 0) {
    issues.push("No meeting notes were provided, so decisions must be an empty list.");
  }

  const actionItems: CatchUpActionItem[] = [];
  if (!Array.isArray(r.actionItems)) {
    issues.push("actionItems must be a list.");
  } else if (r.actionItems.length > MAX_ACTION_ITEMS) {
    issues.push(`Return at most ${MAX_ACTION_ITEMS} action items.`);
  } else {
    r.actionItems.forEach((rawItem, index) => {
      const item = asRecord(rawItem);
      if (!nonEmptyString(item.text)) {
        issues.push(`actionItems[${index}] needs text.`);
        return;
      }
      const owner = nonEmptyString(item.suggestedOwnerId) ? item.suggestedOwnerId : undefined;
      const task = nonEmptyString(item.relatedTaskId) ? item.relatedTaskId : undefined;
      if (owner && !memberIds.has(owner)) issues.push(`actionItems[${index}] suggests unknown member "${owner}".`);
      if (task && !taskIds.has(task)) issues.push(`actionItems[${index}] references unknown task "${task}".`);
      actionItems.push({ text: item.text.trim(), suggestedOwnerId: owner, relatedTaskId: task });
    });
  }

  const missingInfo = isStringArray(r.missingInfo) ? r.missingInfo.filter((s) => s.trim()) : [];
  if (r.missingInfo !== undefined && !isStringArray(r.missingInfo)) issues.push("missingInfo must be a list of strings.");

  if (issues.length > 0) return { ok: false, issues };

  if (!hasNotes(request) && !missingInfo.some((s) => /notes/i.test(s))) missingInfo.unshift(NO_NOTES_MESSAGE);
  return {
    ok: true,
    value: {
      summary: (r.summary as string).trim(),
      decisions: (r.decisions as string[]).map((d) => d.trim()).filter(Boolean),
      actionItems,
      missingInfo,
    },
  };
}

const SYSTEM_INSTRUCTION = `You help a university student catch up on a team meeting they missed.

Rules:
- Use ONLY the information provided: meeting details, meeting notes, async updates, and task states. Never invent attendance, decisions, discussion, or completed work.
- decisions: only decisions explicitly stated or clearly agreed in the meeting notes. If no notes are provided, return an empty list.
- actionItems: concrete next steps grounded in the inputs. suggestedOwnerId must be a provided member id, and only when the inputs make the owner clear; otherwise omit it. relatedTaskId must be a provided task id, or omit it. These are suggestions the team will review.
- summary: 2 to 4 plain sentences a student can read in under a minute. If an absent member is named, write it for them.
- missingInfo: list anything a student would need that the inputs do not cover (for example missing notes, or blockers with no clear owner).
- Neutral tone. Never judge, rank, or blame anyone for absence, effort, or productivity.`;

function buildPrompt(request: ParsedCatchUpRequest, previousIssues: string[]): string {
  const absent = request.members.find((m) => m.id === request.absentMemberId);
  const lines = [
    `Meeting (JSON):\n${JSON.stringify(request.meeting, null, 2)}`,
    `Members (JSON):\n${JSON.stringify(request.members, null, 2)}`,
    `Catching up: ${absent ? `${absent.name} (${absent.id})` : "not specified"}`,
    `Meeting notes:\n${request.notes ?? "(none provided)"}`,
    `Async updates (JSON):\n${JSON.stringify(describeUpdates(request.asyncUpdates, request.members), null, 2)}`,
    `Tasks (JSON):\n${JSON.stringify(describeTasks(request.tasks, request.members), null, 2)}`,
  ];
  if (previousIssues.length > 0) {
    lines.push(`Your previous answer was rejected. Fix every issue:\n- ${previousIssues.join("\n- ")}`);
  }
  lines.push("Return JSON matching the response schema.");
  return lines.join("\n\n");
}

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    summary: { type: "STRING" },
    decisions: { type: "ARRAY", items: { type: "STRING" } },
    actionItems: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          text: { type: "STRING" },
          suggestedOwnerId: { type: "STRING" },
          relatedTaskId: { type: "STRING" },
        },
        required: ["text"],
      },
    },
    missingInfo: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["summary", "decisions", "actionItems", "missingInfo"],
  propertyOrdering: ["summary", "decisions", "actionItems", "missingInfo"],
};

/** Deterministic, clearly labeled fallback built only from task and update data. */
export function buildDemoCatchUp(request: ParsedCatchUpRequest): CatchUp {
  const nameById = new Map(request.members.map((m) => [m.id, m.name]));
  const blockedTasks = request.tasks.filter((t) => t.status === "blocked");
  const blockerUpdates = request.asyncUpdates.filter((u) => u.type === "blocker");

  const actionItems: CatchUpActionItem[] = [
    ...blockedTasks.map((task) => ({
      text: `Check what is blocking "${task.title}".`,
      suggestedOwnerId: task.ownerId,
      relatedTaskId: task.id,
    })),
    ...blockerUpdates.map((update) => ({
      text: `Follow up on the blocker ${nameById.get(update.memberId) ?? "a teammate"} reported.`,
    })),
  ].slice(0, MAX_ACTION_ITEMS);

  const missingInfo = ["Demo catch-up: this was assembled from task and update data, not generated by Gemini."];
  if (!request.notes) missingInfo.push(NO_NOTES_MESSAGE);

  return {
    summary:
      `Demo summary for "${request.meeting.title}". ` +
      `${request.asyncUpdates.length} async update(s) were posted and ${blockedTasks.length} task(s) are currently blocked.`,
    decisions: [],
    actionItems,
    missingInfo,
  };
}

export async function generateCatchUp(body: unknown): Promise<{ status: number; body: CatchUpResponse }> {
  const parsed = parseCatchUpRequest(body);
  if (!parsed.ok) {
    return { status: 400, body: { ok: false, error: "bad_request", message: "Invalid catch-up request.", issues: parsed.issues } };
  }
  const request = parsed.value;

  if (request.mode === "demo") {
    return { status: 200, body: { ok: true, source: "demo", catchUp: buildDemoCatchUp(request) } };
  }

  const result = await generateValidatedGeminiJson<CatchUp>({
    systemInstruction: SYSTEM_INSTRUCTION,
    buildPrompt: (issues) => buildPrompt(request, issues),
    responseSchema: RESPONSE_SCHEMA,
    validate: (data) => validateCatchUp(data, request),
    temperature: 0.2,
  });

  if (result.ok) {
    return { status: 200, body: { ok: true, source: "gemini", model: result.model, catchUp: result.value } };
  }
  return {
    status: result.error === "missing_key" ? 503 : 502,
    body: { ok: false, error: result.error, message: result.message, issues: result.issues },
  };
}

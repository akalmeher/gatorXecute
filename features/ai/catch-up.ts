import type { CatchUp, CatchUpAction, CatchUpCommitment, CatchUpRequest, CatchUpResponse } from "./catch-up-types";
import { generateValidatedGeminiJson, isGeminiOffline } from "./gemini";
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
 * SERVER ONLY. "Here's what you missed" for POST /api/catch-up.
 */

const NO_NOTES_MESSAGE = "No meeting notes were shared, so nothing can be confirmed as decided.";
const MAX_HEADLINE_CHARS = 160;
const MAX_LIST_ITEMS = 6;
const MAX_ITEM_CHARS = 240;

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

function checkStringList(value: unknown, field: string, issues: string[]): string[] {
  if (!isStringArray(value)) {
    issues.push(`${field} must be a list of strings.`);
    return [];
  }
  if (value.length > MAX_LIST_ITEMS) issues.push(`${field} has more than ${MAX_LIST_ITEMS} items.`);
  if (value.some((item) => item.length > MAX_ITEM_CHARS)) issues.push(`Keep each ${field} item short.`);
  return value.map((item) => item.trim()).filter(Boolean);
}

/** Validates Gemini output and enforces honesty rules that the prompt alone can't guarantee. */
export function validateCatchUp(raw: unknown, request: ParsedCatchUpRequest): ParseResult<CatchUp> {
  const issues: string[] = [];
  const r = asRecord(raw);
  const memberIds = new Set(request.members.map((m) => m.id));
  const taskIds = new Set(request.tasks.map((t) => t.id));

  const checkTask = (id: unknown, label: string) => {
    if (!nonEmptyString(id)) return undefined;
    if (!taskIds.has(id)) issues.push(`${label} references unknown work item "${id}".`);
    return id;
  };

  if (!nonEmptyString(r.headline)) issues.push("headline is required.");
  else if (r.headline.length > MAX_HEADLINE_CHARS) issues.push(`headline must be under ${MAX_HEADLINE_CHARS} characters.`);

  const decided = checkStringList(r.decided, "decided", issues);
  if (!request.notes && decided.length > 0) {
    issues.push("No meeting notes were provided, so decided must be an empty list.");
  }
  const changed = checkStringList(r.changed, "changed", issues);
  const openQuestions = checkStringList(r.openQuestions, "openQuestions", issues);
  const missingInfo = isStringArray(r.missingInfo) ? r.missingInfo.map((s) => s.trim()).filter(Boolean) : [];
  if (!isStringArray(r.missingInfo)) issues.push("missingInfo must be a list of strings.");

  const yourPart: CatchUpAction[] = [];
  if (!Array.isArray(r.yourPart)) {
    issues.push("yourPart must be a list.");
  } else if (!request.absentMemberId && r.yourPart.length > 0) {
    issues.push("No absent member was given, so yourPart must be an empty list.");
  } else if (r.yourPart.length > MAX_LIST_ITEMS) {
    issues.push(`yourPart has more than ${MAX_LIST_ITEMS} items.`);
  } else {
    r.yourPart.forEach((rawItem, index) => {
      const item = asRecord(rawItem);
      if (!nonEmptyString(item.text)) {
        issues.push(`yourPart[${index}] needs text.`);
        return;
      }
      yourPart.push({ text: item.text.trim(), relatedTaskId: checkTask(item.relatedTaskId, `yourPart[${index}]`) });
    });
  }

  const commitments: CatchUpCommitment[] = [];
  if (!Array.isArray(r.commitments)) {
    issues.push("commitments must be a list.");
  } else if (r.commitments.length > MAX_LIST_ITEMS * 2) {
    issues.push(`commitments has more than ${MAX_LIST_ITEMS * 2} items.`);
  } else {
    r.commitments.forEach((rawItem, index) => {
      const item = asRecord(rawItem);
      if (!nonEmptyString(item.text)) {
        issues.push(`commitments[${index}] needs text.`);
        return;
      }
      const memberId = nonEmptyString(item.memberId) ? item.memberId : undefined;
      if (memberId && !memberIds.has(memberId)) issues.push(`commitments[${index}] names unknown member "${memberId}".`);
      commitments.push({
        memberId,
        text: item.text.trim(),
        due: nonEmptyString(item.due) ? item.due.trim() : undefined,
        relatedTaskId: checkTask(item.relatedTaskId, `commitments[${index}]`),
      });
    });
  }

  if (issues.length > 0) return { ok: false, issues };

  if (!request.notes && !missingInfo.some((s) => /notes/i.test(s))) missingInfo.unshift(NO_NOTES_MESSAGE);
  return {
    ok: true,
    value: {
      headline: (r.headline as string).trim(),
      decided,
      changed,
      yourPart,
      commitments,
      openQuestions,
      missingInfo,
    },
  };
}

const SYSTEM_INSTRUCTION = `You catch a university student up on a team meeting they missed. Write like a helpful teammate, not project-management software.

Answer three questions, in order: What changed? What affects me? What do I need to do?

Rules:
- Use ONLY the meeting details, meeting notes, async updates, and work items provided. Never invent attendance, decisions, discussion, deadlines, or finished work.
- headline: one short plain sentence that tells the absent student whether this affects them, e.g. "One decision was made. Your work hasn't changed." or "Two things changed, and one needs you."
  If there are no meeting notes, the headline must say what is unknown (e.g. "No notes were shared, so nothing from the meeting is confirmed yet.") and must not claim that nothing changed.
- decided: decisions explicitly stated or clearly agreed in the notes. If there are no notes, return an empty list.
- changed: concrete changes to plans, dates, or who is doing what, stated in the notes or updates.
- yourPart: only things the absent student should now do, written to them ("Add cinematography examples to the slides"). Empty if nothing needs them, or if no absent student is named.
- commitments: who agreed to do what, as stated in the inputs. memberId must be a provided member id, or omit it when it was the whole team or unclear. due only if a time was stated.
- openQuestions: things raised but not settled.
- missingInfo: what the student would need that the inputs do not cover.
- relatedTaskId may only be a provided work item id; omit it otherwise.
- Plain language a student in any major understands. Do not use the words task, ticket, dependency, sprint, backlog, or blocked; say "waiting on", "needs to happen first", "next".
- Keep every item to one short sentence. Leave a list empty rather than padding it.
- Neutral tone. Describe the work, never judge or blame people for absence, effort, or speed.`;

function buildPrompt(request: ParsedCatchUpRequest, previousIssues: string[]): string {
  const absent = request.members.find((m) => m.id === request.absentMemberId);
  const lines = [
    `Meeting (JSON):\n${JSON.stringify(request.meeting, null, 2)}`,
    `Members (JSON):\n${JSON.stringify(request.members, null, 2)}`,
    `Absent student: ${absent ? `${absent.name} (${absent.id})` : "not specified"}`,
    `Meeting notes:\n${request.notes ?? "(none provided)"}`,
    `Async updates (JSON):\n${JSON.stringify(describeUpdates(request.asyncUpdates, request.members), null, 2)}`,
    `Work items (JSON):\n${JSON.stringify(describeTasks(request.tasks, request.members), null, 2)}`,
  ];
  if (previousIssues.length > 0) {
    lines.push(`Your previous answer was rejected. Fix every issue:\n- ${previousIssues.join("\n- ")}`);
  }
  lines.push("Return JSON matching the response schema.");
  return lines.join("\n\n");
}

const STRING_LIST = { type: "ARRAY", items: { type: "STRING" } };

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    headline: { type: "STRING" },
    decided: STRING_LIST,
    changed: STRING_LIST,
    yourPart: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { text: { type: "STRING" }, relatedTaskId: { type: "STRING" } },
        required: ["text"],
      },
    },
    commitments: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          memberId: { type: "STRING" },
          text: { type: "STRING" },
          due: { type: "STRING" },
          relatedTaskId: { type: "STRING" },
        },
        required: ["text"],
      },
    },
    openQuestions: STRING_LIST,
    missingInfo: STRING_LIST,
  },
  required: ["headline", "decided", "changed", "yourPart", "commitments", "openQuestions", "missingInfo"],
  propertyOrdering: ["headline", "decided", "changed", "yourPart", "commitments", "openQuestions", "missingInfo"],
};

/** Deterministic, clearly labeled fallback built only from work-item and update data. */
export function buildDemoCatchUp(request: ParsedCatchUpRequest): CatchUp {
  const nameById = new Map(request.members.map((m) => [m.id, m.name]));
  const waiting = request.tasks.filter((t) => t.status === "blocked");
  const yourOpenWork = request.absentMemberId
    ? request.tasks.filter((t) => t.ownerId === request.absentMemberId && t.status !== "done")
    : [];

  const missingInfo = ["Demo catch-up: put together from the plan and updates, not written by Gemini."];
  if (!request.notes) missingInfo.push(NO_NOTES_MESSAGE);

  return {
    headline: yourOpenWork.length > 0
      ? `Nothing new was confirmed. You still have ${yourOpenWork.length === 1 ? "one thing" : `${yourOpenWork.length} things`} in progress.`
      : "Nothing new was confirmed while you were away.",
    decided: [],
    changed: [],
    yourPart: yourOpenWork.slice(0, MAX_LIST_ITEMS).map((task) => ({
      text: `Keep going on "${task.title}"${task.dueDate ? ` (due ${task.dueDate})` : ""}.`,
      relatedTaskId: task.id,
    })),
    commitments: [],
    openQuestions: waiting.slice(0, MAX_LIST_ITEMS).map((task) => {
      const owner = task.ownerId ? nameById.get(task.ownerId) : undefined;
      return `What does "${task.title}" need before ${owner ?? "someone"} can start?`;
    }),
    missingInfo,
  };
}

export async function generateCatchUp(body: unknown): Promise<{ status: number; body: CatchUpResponse }> {
  const parsed = parseCatchUpRequest(body);
  if (!parsed.ok) {
    return { status: 400, body: { ok: false, error: "bad_request", message: "Invalid catch-up request.", issues: parsed.issues } };
  }
  const request = parsed.value;

  if (request.mode === "demo" || isGeminiOffline()) {
    return { status: 200, body: { ok: true, source: "demo", catchUp: buildDemoCatchUp(request) } };
  }

  const result = await generateValidatedGeminiJson<CatchUp>({
    systemInstruction: SYSTEM_INSTRUCTION,
    buildPrompt: (issues) => buildPrompt(request, issues),
    responseSchema: RESPONSE_SCHEMA,
    validate: (data) => validateCatchUp(data, request),
    cacheable: true,
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

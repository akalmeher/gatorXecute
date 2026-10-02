import type {
  DiscussionItem,
  DiscussionKind,
  MeetingBrief,
  MeetingBriefRequest,
  MeetingBriefResponse,
} from "./meeting-brief-types";
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
 * SERVER ONLY. "Worth discussing" meeting brief for POST /api/meeting-brief.
 */

const MAX_ITEMS = 5;
const DEFAULT_DURATION = 30;
const KINDS: DiscussionKind[] = ["decision", "waiting", "deadline", "check-in"];

type ParsedBriefRequest = Required<MeetingBriefRequest>;

export function parseMeetingBriefRequest(body: unknown): ParseResult<ParsedBriefRequest> {
  const issues: string[] = [];
  const b = asRecord(body);
  const p = asRecord(b.project);
  const m = asRecord(b.meeting);

  if (!nonEmptyString(p.name)) issues.push("project.name is required.");
  if (!nonEmptyString(m.title)) issues.push("meeting.title is required.");
  const duration = m.durationMinutes ?? DEFAULT_DURATION;
  if (typeof duration !== "number" || !Number.isInteger(duration) || duration < 10 || duration > 240) {
    issues.push("meeting.durationMinutes must be a whole number between 10 and 240.");
  }
  const members = parseMembers(b.members, issues);
  const tasks = parseTasks(b.tasks, issues);
  const asyncUpdates = parseAsyncUpdates(b.asyncUpdates, issues);
  const mode = parseMode(b.mode, issues);

  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    value: {
      mode,
      project: { name: p.name as string, deadline: typeof p.deadline === "string" ? p.deadline : "" },
      meeting: {
        title: m.title as string,
        durationMinutes: duration as number,
        attendeeIds: isStringArray(m.attendeeIds) ? m.attendeeIds : [],
      },
      tasks,
      asyncUpdates,
      members,
    },
  };
}

export function validateMeetingBrief(raw: unknown, request: ParsedBriefRequest): ParseResult<MeetingBrief> {
  const issues: string[] = [];
  const r = asRecord(raw);
  const taskIds = new Set(request.tasks.map((t) => t.id));

  if (!nonEmptyString(r.headline)) issues.push("headline is required.");
  if (!nonEmptyString(r.everythingElse)) issues.push("everythingElse is required.");
  if (typeof r.meetingNeeded !== "boolean") issues.push("meetingNeeded must be true or false.");

  const items: DiscussionItem[] = [];
  if (!Array.isArray(r.worthDiscussing) || r.worthDiscussing.length > MAX_ITEMS) {
    issues.push(`worthDiscussing must be a list of at most ${MAX_ITEMS} items.`);
  } else {
    r.worthDiscussing.forEach((rawItem, index) => {
      const item = asRecord(rawItem);
      const label = `worthDiscussing[${index}]`;
      if (!nonEmptyString(item.title)) issues.push(`${label} needs a title.`);
      if (!nonEmptyString(item.why)) issues.push(`${label} needs a why.`);
      if (!KINDS.includes(item.kind as DiscussionKind)) issues.push(`${label} kind must be one of ${KINDS.join(", ")}.`);
      if (typeof item.minutes !== "number" || !Number.isInteger(item.minutes) || item.minutes < 1) {
        issues.push(`${label} needs a whole number of minutes (at least 1).`);
      }
      const related = isStringArray(item.relatedTaskIds) ? item.relatedTaskIds : [];
      for (const id of related) {
        if (!taskIds.has(id)) issues.push(`${label} references unknown work item "${id}".`);
      }
      items.push({
        title: typeof item.title === "string" ? item.title.trim() : "",
        why: typeof item.why === "string" ? item.why.trim() : "",
        kind: item.kind as DiscussionKind,
        minutes: typeof item.minutes === "number" ? item.minutes : 0,
        relatedTaskIds: [...new Set(related)],
      });
    });
    const total = items.reduce((sum, item) => sum + item.minutes, 0);
    if (total > request.meeting.durationMinutes) {
      issues.push(`Items total ${total} minutes but the meeting is ${request.meeting.durationMinutes} minutes.`);
    }
    if (items.length === 0 && r.meetingNeeded === true) {
      issues.push("meetingNeeded must be false when nothing is worth discussing.");
    }
  }

  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    value: {
      headline: (r.headline as string).trim(),
      worthDiscussing: items,
      everythingElse: (r.everythingElse as string).trim(),
      meetingNeeded: r.meetingNeeded as boolean,
    },
  };
}

const SYSTEM_INSTRUCTION = `You prepare a short brief before a university student team meeting. Meetings are expensive: only surface what genuinely needs the group together.

Rules:
- Use only the work items and async updates provided.
- worthDiscussing: at most 5 items, most important first. Prioritize decisions the group must make, people waiting on someone else, and deadlines at risk. Skip routine progress that is going fine.
  - title: short and human ("Choose the final film").
  - why: one plain sentence on why it needs the group ("Maya can't start editing until this is settled.").
  - kind: "decision", "waiting", "deadline", or "check-in".
  - minutes: whole number; the total must not exceed the meeting length.
  - relatedTaskIds: only provided work item ids, or an empty list.
- headline: one sentence, e.g. "Three things are worth discussing."
- everythingElse: one sentence about the rest, e.g. "Everything else is on track."
- meetingNeeded: false if nothing actually needs a live conversation; then worthDiscussing may be empty and the headline should say the meeting may not be necessary.
- Plain language any student understands. Do not use the words task, ticket, dependency, sprint, backlog, or blocked; say "waiting on", "needs to happen first", "next".
- Describe the work, never judge or single out people for speed or effort.`;

function buildPrompt(request: ParsedBriefRequest, previousIssues: string[]): string {
  const lines = [
    `Project: ${request.project.name}${request.project.deadline ? ` (due ${request.project.deadline})` : ""}`,
    `Meeting: ${request.meeting.title}, ${request.meeting.durationMinutes} minutes`,
    `Work items (JSON):\n${JSON.stringify(describeTasks(request.tasks, request.members), null, 2)}`,
    `Async updates (JSON):\n${JSON.stringify(describeUpdates(request.asyncUpdates, request.members), null, 2)}`,
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
    headline: { type: "STRING" },
    worthDiscussing: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          why: { type: "STRING" },
          kind: { type: "STRING", enum: KINDS },
          minutes: { type: "INTEGER" },
          relatedTaskIds: { type: "ARRAY", items: { type: "STRING" } },
        },
        required: ["title", "why", "kind", "minutes", "relatedTaskIds"],
        propertyOrdering: ["title", "why", "kind", "minutes", "relatedTaskIds"],
      },
    },
    everythingElse: { type: "STRING" },
    meetingNeeded: { type: "BOOLEAN" },
  },
  required: ["headline", "worthDiscussing", "everythingElse", "meetingNeeded"],
  propertyOrdering: ["headline", "worthDiscussing", "everythingElse", "meetingNeeded"],
};

/** Deterministic, clearly labeled fallback built from work-item states. */
export function buildDemoBrief(request: ParsedBriefRequest): MeetingBrief {
  const nameById = new Map(request.members.map((m) => [m.id, m.name]));
  const byDue = (a: { dueDate?: string }, b: { dueDate?: string }) =>
    (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");
  const open = request.tasks.filter((t) => t.status !== "done");
  const waiting = open.filter((t) => t.status === "blocked").sort(byDue);
  const unowned = open.filter((t) => !t.ownerId && t.status !== "blocked").sort(byDue);

  const items: Omit<DiscussionItem, "minutes">[] = [
    ...waiting.map((task) => ({
      title: `Get "${task.title}" moving`,
      why: `${task.ownerId ? nameById.get(task.ownerId) ?? "Someone" : "Someone"} is waiting on other work before this can start.`,
      kind: "waiting" as const,
      relatedTaskIds: [task.id],
    })),
    ...unowned.map((task) => ({
      title: `Decide who takes "${task.title}"`,
      why: "Nobody has picked this up yet.",
      kind: "decision" as const,
      relatedTaskIds: [task.id],
    })),
  ].slice(0, MAX_ITEMS);

  const perItem = items.length > 0 ? Math.max(1, Math.floor((request.meeting.durationMinutes - 5) / items.length)) : 0;
  return {
    headline: items.length > 0
      ? `Demo brief (not written by Gemini): ${items.length === 1 ? "one thing is" : `${items.length} things are`} worth discussing.`
      : "Demo brief (not written by Gemini): nothing needs the group right now.",
    worthDiscussing: items.map((item) => ({ ...item, minutes: perItem })),
    everythingElse: "Everything else is moving on schedule.",
    meetingNeeded: items.length > 0,
  };
}

export async function generateMeetingBrief(body: unknown): Promise<{ status: number; body: MeetingBriefResponse }> {
  const parsed = parseMeetingBriefRequest(body);
  if (!parsed.ok) {
    return { status: 400, body: { ok: false, error: "bad_request", message: "Invalid meeting brief request.", issues: parsed.issues } };
  }
  const request = parsed.value;

  if (request.mode === "demo" || isGeminiOffline()) {
    return { status: 200, body: { ok: true, source: "demo", brief: buildDemoBrief(request) } };
  }

  const result = await generateValidatedGeminiJson<MeetingBrief>({
    systemInstruction: SYSTEM_INSTRUCTION,
    buildPrompt: (issues) => buildPrompt(request, issues),
    responseSchema: RESPONSE_SCHEMA,
    validate: (data) => validateMeetingBrief(data, request),
    cacheable: true,
    temperature: 0.3,
  });

  if (result.ok) {
    return { status: 200, body: { ok: true, source: "gemini", model: result.model, brief: result.value } };
  }
  return {
    status: result.error === "missing_key" ? 503 : 502,
    body: { ok: false, error: result.error, message: result.message, issues: result.issues },
  };
}

import type { MeetingAgendaItem, MeetingBrief, MeetingBriefRequest, MeetingBriefResponse } from "./meeting-brief-types";
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
 * SERVER ONLY. Meeting agenda generation for POST /api/meeting-brief.
 */

const MIN_ITEMS = 2;
const MAX_ITEMS = 6;
const DEFAULT_DURATION = 30;

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

  if (!nonEmptyString(r.goal)) issues.push("goal is required.");

  const agenda: MeetingAgendaItem[] = [];
  if (!Array.isArray(r.agenda) || r.agenda.length < MIN_ITEMS || r.agenda.length > MAX_ITEMS) {
    issues.push(`agenda must have between ${MIN_ITEMS} and ${MAX_ITEMS} items.`);
  } else {
    r.agenda.forEach((rawItem, index) => {
      const item = asRecord(rawItem);
      if (!nonEmptyString(item.title)) issues.push(`agenda[${index}] needs a title.`);
      if (typeof item.minutes !== "number" || !Number.isInteger(item.minutes) || item.minutes < 1) {
        issues.push(`agenda[${index}] needs a whole number of minutes (at least 1).`);
      }
      const related = isStringArray(item.relatedTaskIds) ? item.relatedTaskIds : [];
      for (const id of related) {
        if (!taskIds.has(id)) issues.push(`agenda[${index}] references unknown task "${id}".`);
      }
      agenda.push({
        title: typeof item.title === "string" ? item.title.trim() : "",
        minutes: typeof item.minutes === "number" ? item.minutes : 0,
        relatedTaskIds: [...new Set(related)],
      });
    });
    const total = agenda.reduce((sum, item) => sum + item.minutes, 0);
    if (total > request.meeting.durationMinutes) {
      issues.push(`Agenda totals ${total} minutes but the meeting is ${request.meeting.durationMinutes} minutes.`);
    }
  }

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: { goal: (r.goal as string).trim(), agenda } };
}

const SYSTEM_INSTRUCTION = `You prepare short, focused agendas for university student project team meetings.

Rules:
- Build the agenda from the provided tasks and async updates only. Prioritize: blocked tasks and reported blockers first, then work due soonest, then in-progress work, then next steps.
- 2 to 6 agenda items. Each has a short action-oriented title, whole-number minutes, and relatedTaskIds drawn only from the provided task ids (empty list if none).
- Total minutes must not exceed the meeting duration. Leave a few minutes of slack.
- goal: one sentence describing what the team should leave the meeting with.
- Neutral tone. Never single out, rank, or judge any member.`;

function buildPrompt(request: ParsedBriefRequest, previousIssues: string[]): string {
  const lines = [
    `Project: ${request.project.name}${request.project.deadline ? ` (deadline ${request.project.deadline})` : ""}`,
    `Meeting: ${request.meeting.title}, ${request.meeting.durationMinutes} minutes`,
    `Tasks (JSON):\n${JSON.stringify(describeTasks(request.tasks, request.members), null, 2)}`,
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
    goal: { type: "STRING" },
    agenda: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          minutes: { type: "INTEGER" },
          relatedTaskIds: { type: "ARRAY", items: { type: "STRING" } },
        },
        required: ["title", "minutes", "relatedTaskIds"],
        propertyOrdering: ["title", "minutes", "relatedTaskIds"],
      },
    },
  },
  required: ["goal", "agenda"],
  propertyOrdering: ["goal", "agenda"],
};

/** Deterministic, clearly labeled fallback agenda built from task states. */
export function buildDemoBrief(request: ParsedBriefRequest): MeetingBrief {
  const open = request.tasks.filter((t) => t.status !== "done");
  const byDue = (a: { dueDate?: string }, b: { dueDate?: string }) =>
    (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");
  const blocked = open.filter((t) => t.status === "blocked");
  const inProgress = open.filter((t) => t.status === "in-progress").sort(byDue);
  const upcoming = open.filter((t) => t.status === "todo").sort(byDue).slice(0, 3);

  const sections: Omit<MeetingAgendaItem, "minutes">[] = [];
  if (blocked.length > 0) sections.push({ title: "Unblock stuck tasks", relatedTaskIds: blocked.map((t) => t.id) });
  if (inProgress.length > 0) sections.push({ title: "Progress check on active work", relatedTaskIds: inProgress.map((t) => t.id) });
  if (upcoming.length > 0) sections.push({ title: "Confirm owners for upcoming tasks", relatedTaskIds: upcoming.map((t) => t.id) });
  sections.push({ title: "Agree on next steps before the next sync", relatedTaskIds: [] });
  if (sections.length < MIN_ITEMS) sections.unshift({ title: "Quick round of updates", relatedTaskIds: [] });

  const perItem = Math.max(1, Math.floor((request.meeting.durationMinutes - 5) / sections.length));
  return {
    goal: "Demo agenda (not AI generated): leave with blockers addressed and clear next steps.",
    agenda: sections.map((section) => ({ ...section, minutes: perItem })),
  };
}

export async function generateMeetingBrief(body: unknown): Promise<{ status: number; body: MeetingBriefResponse }> {
  const parsed = parseMeetingBriefRequest(body);
  if (!parsed.ok) {
    return { status: 400, body: { ok: false, error: "bad_request", message: "Invalid meeting brief request.", issues: parsed.issues } };
  }
  const request = parsed.value;

  if (request.mode === "demo") {
    return { status: 200, body: { ok: true, source: "demo", brief: buildDemoBrief(request) } };
  }

  const result = await generateValidatedGeminiJson<MeetingBrief>({
    systemInstruction: SYSTEM_INSTRUCTION,
    buildPrompt: (issues) => buildPrompt(request, issues),
    responseSchema: RESPONSE_SCHEMA,
    validate: (data) => validateMeetingBrief(data, request),
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

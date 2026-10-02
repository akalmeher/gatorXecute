import type { Task } from "@/types";
import type { PlanMember } from "./plan-types";
import type { PlanChange, ReplanRequest, ReplanResponse, ReplanSuggestion } from "./replan-types";
import { generateValidatedGeminiJson } from "@/features/ai/gemini";
import {
  type ParseResult,
  asRecord,
  isStringArray,
  nonEmptyString,
  parseMode,
  parseTasks,
} from "@/features/ai/ai-parse";
import { addDays, toIsoDay, todayIsoDay } from "./plan-validation";
import { MAX_PLAN_CHANGES, PROBLEM_PHRASE, applyPlanChanges, checkPlanChanges, findPlanProblems } from "./plan-health";
import { formatDay } from "./plan-display";

/**
 * Feature Owner: Divij Anand
 * SERVER ONLY. "We're behind, here's a way forward" for POST /api/replan.
 */

const MAX_CONCERN_CHARS = 500;

type ParsedReplanRequest = Required<Omit<ReplanRequest, "concern">> & { concern?: string };

export function parseReplanRequest(body: unknown): ParseResult<ParsedReplanRequest> {
  const issues: string[] = [];
  const b = asRecord(body);
  const p = asRecord(b.project);

  if (!nonEmptyString(p.id) || !nonEmptyString(p.name)) issues.push("project needs an id and name.");
  const members: PlanMember[] = Array.isArray(p.members)
    ? p.members.flatMap((raw) => {
        const m = asRecord(raw);
        if (!nonEmptyString(m.id) || !nonEmptyString(m.name)) return [];
        return [{
          id: m.id,
          name: m.name,
          skills: isStringArray(m.skills) ? m.skills : [],
          wantsToLearn: isStringArray(m.wantsToLearn) ? m.wantsToLearn : [],
        }];
      })
    : [];
  if (members.length === 0) issues.push("project.members must include at least one member.");
  const tasks = parseTasks(b.tasks, issues);
  if (tasks.length === 0) issues.push("tasks must include at least one step.");
  const mode = parseMode(b.mode, issues);
  if (b.concern !== undefined && typeof b.concern !== "string") issues.push("concern must be a string.");
  if (b.avoid !== undefined && !isStringArray(b.avoid)) issues.push("avoid must be a list of strings.");

  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    value: {
      mode,
      project: {
        id: p.id as string,
        name: p.name as string,
        deadline: typeof p.deadline === "string" ? p.deadline : "",
        members,
      },
      tasks,
      concern: typeof b.concern === "string" && b.concern.trim() ? b.concern.trim().slice(0, MAX_CONCERN_CHARS) : undefined,
      avoid: isStringArray(b.avoid) ? b.avoid.slice(-5) : [],
      notes: Array.isArray(b.notes)
        ? b.notes.flatMap((raw) => {
            const n = asRecord(raw);
            return nonEmptyString(n.from) && nonEmptyString(n.text) ? [{ from: n.from.slice(0, 60), text: n.text.slice(0, 500) }] : [];
          }).slice(0, 6)
        : [],
    },
  };
}

interface ReplanContext {
  memberIds: string[];
  deadline?: string;
  today: string;
}

export function validateReplan(raw: unknown, tasks: Task[], context: ReplanContext): ParseResult<ReplanSuggestion> {
  const issues: string[] = [];
  const r = asRecord(raw);

  for (const field of ["headline", "situation", "proposal", "outcome"] as const) {
    if (!nonEmptyString(r[field])) issues.push(`${field} is required.`);
  }
  if (typeof r.onTrack !== "boolean") issues.push("onTrack must be true or false.");

  const changes: PlanChange[] = [];
  if (!Array.isArray(r.changes)) {
    issues.push("changes must be a list.");
  } else {
    r.changes.forEach((rawChange, index) => {
      const c = asRecord(rawChange);
      if (!nonEmptyString(c.taskId)) {
        issues.push(`changes[${index}] needs a taskId.`);
        return;
      }
      if (!nonEmptyString(c.why)) issues.push(`changes[${index}] needs a why.`);
      changes.push({
        taskId: c.taskId,
        ownerId: nonEmptyString(c.ownerId) ? c.ownerId : undefined,
        dueDate: nonEmptyString(c.dueDate) ? c.dueDate : undefined,
        why: typeof c.why === "string" ? c.why.trim() : "",
      });
    });
  }

  if (r.onTrack === true && changes.length > 0) issues.push("When onTrack is true, changes must be empty.");
  if (issues.length === 0) issues.push(...checkPlanChanges(changes, tasks, context));

  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    value: {
      headline: (r.headline as string).trim(),
      situation: (r.situation as string).trim(),
      proposal: (r.proposal as string).trim(),
      changes,
      outcome: (r.outcome as string).trim(),
      onTrack: r.onTrack as boolean,
    },
  };
}

const SYSTEM_INSTRUCTION = `You help a university student team keep a project on schedule when something changes.
You propose; the students decide. Nothing changes unless they accept.

Rules:
- Propose the SMALLEST set of changes (usually 1 to 3, never more than ${MAX_PLAN_CHANGES}) that keeps the work moving and finishing by the deadline.
- Good moves: give a not-yet-started step to someone with time and relevant skills or learning goals; let people work on something that isn't waiting on anyone; move a due date only when needed and never past the deadline or before today.
- Never change steps that are done. Avoid moving in-progress work to someone else unless the student's note says its owner is unavailable.
- Every changed step must still be due on or after the steps it needs, and before the steps that need it.
- ownerId must be a provided member id; taskId must be a provided step id; dueDate is YYYY-MM-DD. Omit ownerId or dueDate when that part doesn't change.
- If nothing is late, stuck, or concerning, set onTrack to true, changes to an empty list, and say so plainly.
- Not every problem is about who or when. If the real issue is a decision or disagreement the team must settle together (e.g. "we can't agree on a film"), propose settling it together, such as a quick vote or putting it first on the next meeting, with onTrack false and changes empty. Only reassign or move dates when that genuinely helps.
- Explain in human terms, using the team's notes when they say why something is stuck. Never mention internal labels or how something is "marked", and never say things like "even though nothing is blocking it". Keep any dates or times from the notes exactly as written ("until Thursday" stays "until Thursday").
- headline: one short sentence ("The team may be about a day behind." / "You're on track.").
- situation: what is happening to the WORK, in plain words. Never blame, judge, or describe anyone as slow, lazy, or unreliable. Say "Maya's part is running later than planned", not "Maya is behind".
- proposal: the fix in one sentence, naming people and steps ("Sara can draft the documentation today while Omar finishes the database.").
- why (per change): one plain sentence.
- outcome: what the plan looks like after the change ("Everything still finishes by Wed, Oct 14.").
- Plain language for any major. Do not use the words task, ticket, dependency, sprint, backlog, resource, or critical path.`;

function buildPrompt(request: ParsedReplanRequest, context: ReplanContext, previousIssues: string[]): string {
  const nameById = new Map(request.project.members.map((m) => [m.id, m.name]));
  const open = request.tasks.filter((t) => t.status !== "done");
  const workload = request.project.members.map((m) => ({
    id: m.id,
    name: m.name,
    skills: m.skills,
    wantsToLearn: m.wantsToLearn,
    openMinutes: open.filter((t) => t.ownerId === m.id).reduce((sum, t) => sum + (t.estimatedMinutes ?? 60), 0),
  }));
  const steps = request.tasks.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status === "blocked" ? "waiting/stuck" : t.status,
    owner: t.ownerId ? `${nameById.get(t.ownerId) ?? t.ownerId} (${t.ownerId})` : "nobody",
    dueDate: t.dueDate,
    estimatedMinutes: t.estimatedMinutes,
    needsFirst: t.dependencies,
  }));
  const problems = findPlanProblems(request.tasks, context.today).map((p) => ({
    step: p.task.id,
    problem: { late: "past its due date and not done", stuck: "its owner says they are stuck on it (see the team notes for why)", unowned: "nobody is assigned", waiting: "its owner is waiting for an earlier step to finish (normal, on schedule unless that step is late)" }[p.kind],
    holdsUp: p.holdsUp.map((t) => t.id),
  }));

  const lines = [
    `Today: ${context.today}`,
    `Project: ${request.project.name}, deadline ${context.deadline ?? request.project.deadline}`,
    `Team and current workload (JSON):\n${JSON.stringify(workload, null, 2)}`,
    `Steps (JSON):\n${JSON.stringify(steps, null, 2)}`,
    `Problems noticed automatically (JSON):\n${JSON.stringify(problems, null, 2)}`,
    `Note from the student: ${request.concern ?? "(none)"}`,
    `Recent notes from the team (newest first):\n${
      request.notes.length > 0 ? request.notes.map((n) => `- ${n.from}: "${n.text}"`).join("\n") : "(none)"
    }`,
  ];
  if (request.avoid.length > 0) {
    lines.push(`They already saw these proposals and want a different option:\n- ${request.avoid.join("\n- ")}`);
  }
  if (previousIssues.length > 0) {
    lines.push(`Your previous answer was rejected. Fix every issue:\n- ${previousIssues.join("\n- ")}`);
  }
  lines.push("Return JSON matching the response schema.");
  return lines.join("\n\n");
}

const CHANGE_FIELDS = ["taskId", "ownerId", "dueDate", "why"];
const RESPONSE_FIELDS = ["headline", "situation", "proposal", "changes", "outcome", "onTrack"];

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    headline: { type: "STRING" },
    situation: { type: "STRING" },
    proposal: { type: "STRING" },
    changes: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          taskId: { type: "STRING" },
          ownerId: { type: "STRING" },
          dueDate: { type: "STRING" },
          why: { type: "STRING" },
        },
        required: ["taskId", "why"],
        propertyOrdering: CHANGE_FIELDS,
      },
    },
    outcome: { type: "STRING" },
    onTrack: { type: "BOOLEAN" },
  },
  required: RESPONSE_FIELDS,
  propertyOrdering: RESPONSE_FIELDS,
};

/** Deterministic, clearly labeled fallback: give held-up steps a little more time. */
export function buildDemoReplan(request: ParsedReplanRequest, context: ReplanContext): ReplanSuggestion {
  const [problem] = findPlanProblems(request.tasks, context.today);
  if (!problem) {
    return {
      headline: "You're on track.",
      situation: "Nothing is late or stuck right now.",
      proposal: "Keep going with the current plan.",
      changes: [],
      outcome: "No changes needed.",
      onTrack: true,
    };
  }

  const changes: PlanChange[] = problem.holdsUp
    .filter((t) => t.dueDate)
    .map((t) => {
      const pushed = addDays(t.dueDate as string, 2);
      return { taskId: t.id, dueDate: context.deadline && pushed > context.deadline ? context.deadline : pushed, why: "Gives it room while the earlier step catches up." };
    })
    .filter((change) => checkPlanChanges([change], request.tasks, context).length === 0)
    .slice(0, MAX_PLAN_CHANGES);

  const lastDue = applyPlanChanges(request.tasks, changes).map((t) => t.dueDate).filter(Boolean).sort().at(-1);
  return {
    headline: `"${problem.task.title}" ${PROBLEM_PHRASE[problem.kind]}.`,
    situation: problem.holdsUp.length > 0
      ? problem.holdsUp.length === 1 ? "One other step can't start until it moves." : `${problem.holdsUp.length} other steps can't start until it moves.`
      : "Nothing else is waiting on it yet.",
    proposal: changes.length > 0
      ? "Give the steps that are waiting on it a couple more days."
      : "Talk it through at the next meeting; there's no safe date change to suggest.",
    changes,
    outcome: lastDue ? `Everything still finishes by ${formatDay(lastDue)}. (Demo suggestion, not from Gemini.)` : "Demo suggestion, not from Gemini.",
    onTrack: false,
  };
}

export async function generateReplan(body: unknown): Promise<{ status: number; body: ReplanResponse }> {
  const parsed = parseReplanRequest(body);
  if (!parsed.ok) {
    return { status: 400, body: { ok: false, error: "bad_request", message: "Invalid replan request.", issues: parsed.issues } };
  }
  const request = parsed.value;
  const context: ReplanContext = {
    memberIds: request.project.members.map((m) => m.id),
    deadline: toIsoDay(request.project.deadline),
    today: todayIsoDay(),
  };

  if (request.mode === "demo") {
    return { status: 200, body: { ok: true, source: "demo", suggestion: buildDemoReplan(request, context) } };
  }

  const result = await generateValidatedGeminiJson<ReplanSuggestion>({
    systemInstruction: SYSTEM_INSTRUCTION,
    buildPrompt: (issues) => buildPrompt(request, context, issues),
    responseSchema: RESPONSE_SCHEMA,
    validate: (data) => validateReplan(data, request.tasks, context),
    temperature: request.avoid.length > 0 ? 0.7 : 0.3,
  });

  if (result.ok) {
    return { status: 200, body: { ok: true, source: "gemini", model: result.model, suggestion: result.value } };
  }
  return {
    status: result.error === "missing_key" ? 503 : 502,
    body: {
      ok: false,
      error: result.error,
      message: result.error === "missing_key" ? "Gemini is not configured on the server." : "I couldn't find a safe way to change the plan.",
      issues: result.issues,
    },
  };
}

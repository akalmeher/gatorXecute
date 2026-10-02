import type { Task, TaskStatus } from "@/types";
import type { ProgressInterpretation, ProgressUpdateRequest, ProgressUpdateResponse, StatusChange } from "./update-types";
import { generateValidatedGeminiJson } from "@/features/ai/gemini";
import { type ParseResult, asRecord, isStringArray, nonEmptyString, parseMode, parseTasks } from "@/features/ai/ai-parse";

/**
 * Feature Owner: Divij Anand
 * SERVER ONLY. POST /api/progress-update: students say what happened in their own
 * words; Gemini proposes status changes; nothing changes until they confirm.
 */

const MAX_TEXT_CHARS = 1000;
const MAX_CHANGES = 6;
const STATUSES: TaskStatus[] = ["todo", "in-progress", "blocked", "done"];

type ParsedRequest = Required<Omit<ProgressUpdateRequest, "authorId">> & { authorId?: string };

export function parseProgressUpdateRequest(body: unknown): ParseResult<ParsedRequest> {
  const issues: string[] = [];
  const b = asRecord(body);
  const p = asRecord(b.project);
  const mode = parseMode(b.mode, issues);
  if (!nonEmptyString(p.id) || !nonEmptyString(p.name)) issues.push("project needs an id and name.");
  const members = Array.isArray(p.members)
    ? p.members.flatMap((raw) => {
        const m = asRecord(raw);
        return nonEmptyString(m.id) && nonEmptyString(m.name) ? [{ id: m.id, name: m.name }] : [];
      })
    : [];
  if (members.length === 0) issues.push("project.members must include at least one member.");
  const tasks = parseTasks(b.tasks, issues);
  if (tasks.length === 0) issues.push("There are no steps to update yet.");
  if (!nonEmptyString(b.text)) issues.push("Write what's new, e.g. \"finished the research\".");
  else if (b.text.length > MAX_TEXT_CHARS) issues.push(`Keep it under ${MAX_TEXT_CHARS} characters.`);
  const authorId = nonEmptyString(b.authorId) ? b.authorId : undefined;
  if (authorId && !members.some((m) => m.id === authorId)) issues.push("authorId must match a member id.");

  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    value: {
      mode,
      project: { id: p.id as string, name: p.name as string, members },
      tasks,
      text: (b.text as string).trim(),
      authorId,
    },
  };
}

export function validateInterpretation(raw: unknown, tasks: Task[]): ParseResult<ProgressInterpretation> {
  const issues: string[] = [];
  const r = asRecord(raw);
  const byId = new Map(tasks.map((t) => [t.id, t]));
  if (!nonEmptyString(r.summary)) issues.push("summary is required.");

  const changes: StatusChange[] = [];
  const seen = new Set<string>();
  if (!Array.isArray(r.changes) || r.changes.length > MAX_CHANGES) {
    issues.push(`changes must be a list of at most ${MAX_CHANGES}.`);
  } else {
    r.changes.forEach((rawChange, index) => {
      const c = asRecord(rawChange);
      const task = nonEmptyString(c.taskId) ? byId.get(c.taskId) : undefined;
      if (!task) {
        issues.push(`changes[${index}] references unknown step "${String(c.taskId)}".`);
        return;
      }
      if (!STATUSES.includes(c.status as TaskStatus)) issues.push(`changes[${index}].status must be one of ${STATUSES.join(", ")}.`);
      if (seen.has(task.id)) issues.push(`"${task.title}" is changed more than once.`);
      seen.add(task.id);
      // A "change" to the same status is noise; drop it rather than failing the whole answer.
      if (c.status === task.status) return;
      changes.push({ taskId: task.id, status: c.status as TaskStatus, because: nonEmptyString(c.because) ? c.because.trim() : "" });
    });
  }
  const unmatched = isStringArray(r.unmatched) ? r.unmatched.map((u) => u.trim()).filter(Boolean).slice(0, 3) : [];

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: { summary: (r.summary as string).trim(), changes, unmatched } };
}

const SYSTEM_INSTRUCTION = `A university student wrote a quick, casual update about their group project. Turn it into status changes for the project's steps.

Statuses: "done", "in-progress", "blocked" (waiting on someone or something), "todo" (not started).
- Only use what the student actually said. "finished", "done", "submitted", "sent" -> done. "almost done", "mostly done", "started", "working on" -> in-progress. "waiting on", "stuck", "can't start until" -> blocked. "need to redo" -> in-progress.
- Match what they wrote to the step it most clearly means, by meaning, not exact words. If it could be more than one step, don't guess: put that phrase in unmatched.
- "I", "me", "my" mean the author. When the author is known, prefer steps they own for vague phrases. Others' steps change only if the student clearly names them ("Maya finished the sources").
- Never mark something done unless they clearly said it's finished.
- because: the student's own words that justify the change (short quote).
- summary: one friendly sentence restating what you understood, e.g. "Sounds like the research is done and the slides are waiting on Maya's sources." No judgment of anyone's speed or effort. Plain words: say "step" or name it; never "task", "ticket" or "dependency".
- If nothing maps to a change, return an empty changes list and say so kindly in the summary.`;

function buildPrompt(request: ParsedRequest, previousIssues: string[]): string {
  const nameById = new Map(request.project.members.map((m) => [m.id, m.name]));
  const author = request.authorId ? nameById.get(request.authorId) : undefined;
  const steps = request.tasks.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    owner: t.ownerId ? nameById.get(t.ownerId) ?? t.ownerId : "nobody",
  }));
  const lines = [
    `Author: ${author ? `${author} (${request.authorId})` : "unknown"}`,
    `Steps (JSON):\n${JSON.stringify(steps, null, 2)}`,
    `Update:\n"""${request.text}"""`,
  ];
  if (previousIssues.length > 0) lines.push(`Your previous answer was rejected. Fix every issue:\n- ${previousIssues.join("\n- ")}`);
  lines.push("Return JSON matching the response schema.");
  return lines.join("\n\n");
}

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    summary: { type: "STRING" },
    changes: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          taskId: { type: "STRING" },
          status: { type: "STRING", enum: STATUSES },
          because: { type: "STRING" },
        },
        required: ["taskId", "status", "because"],
        propertyOrdering: ["taskId", "status", "because"],
      },
    },
    unmatched: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["summary", "changes", "unmatched"],
  propertyOrdering: ["summary", "changes", "unmatched"],
};

/** Labeled non-AI fallback: only exact step titles plus a few clear verbs. */
export function buildDemoInterpretation(request: ParsedRequest): ProgressInterpretation {
  const text = request.text.toLowerCase();
  const status: TaskStatus | undefined = /\b(finished|done|completed|submitted)\b/.test(text)
    ? "done"
    : /\b(waiting|stuck|blocked)\b/.test(text)
      ? "blocked"
      : /\b(started|working on)\b/.test(text)
        ? "in-progress"
        : undefined;
  const changes = status
    ? request.tasks
        .filter((t) => t.status !== status && text.includes(t.title.toLowerCase()))
        .slice(0, MAX_CHANGES)
        .map((t) => ({ taskId: t.id, status, because: "matched the step name (demo mode)" }))
    : [];
  return {
    summary: changes.length > 0
      ? "Demo mode (not Gemini): matched step names in your update."
      : "Demo mode (not Gemini) only matches exact step names, so nothing was found.",
    changes,
    unmatched: [],
  };
}

export async function interpretProgressUpdate(body: unknown): Promise<{ status: number; body: ProgressUpdateResponse }> {
  const parsed = parseProgressUpdateRequest(body);
  if (!parsed.ok) {
    return { status: 400, body: { ok: false, error: "bad_request", message: "Invalid update.", issues: parsed.issues } };
  }
  const request = parsed.value;

  if (request.mode === "demo") {
    return { status: 200, body: { ok: true, source: "demo", interpretation: buildDemoInterpretation(request) } };
  }

  const result = await generateValidatedGeminiJson<ProgressInterpretation>({
    systemInstruction: SYSTEM_INSTRUCTION,
    buildPrompt: (issues) => buildPrompt(request, issues),
    responseSchema: RESPONSE_SCHEMA,
    validate: (data) => validateInterpretation(data, request.tasks),
    temperature: 0.1,
  });

  if (result.ok) {
    return { status: 200, body: { ok: true, source: "gemini", model: result.model, interpretation: result.value } };
  }
  return {
    status: result.error === "missing_key" ? 503 : 502,
    body: {
      ok: false,
      error: result.error,
      message: result.error === "missing_key" ? result.message : "I couldn't read that update. Try rephrasing, or change the step on the Work tab.",
      issues: result.issues,
    },
  };
}

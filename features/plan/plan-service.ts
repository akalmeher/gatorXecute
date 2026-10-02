import type { Task } from "@/types";
import type { PlanErrorResponse, PlanMember, PlanResponse, PlanUnderstanding, WorkKind } from "./plan-types";
import { type GeminiAttachment, generateValidatedGeminiJson } from "@/features/ai/gemini";
import { PLAN_RESPONSE_SCHEMA, PLAN_SYSTEM_INSTRUCTION, buildPlanPrompt } from "./plan-prompt";
import { buildDemoPlan } from "./plan-fallback";
import {
  type PlanValidationContext,
  type ValidationResult,
  isIsoDay,
  parsePlanRequest,
  toIsoDay,
  todayIsoDay,
  validatePlanTasks,
} from "./plan-validation";

/**
 * Feature Owner: Divij Anand
 * SERVER ONLY. Orchestrates plan generation for POST /api/plan.
 */

const WORK_KINDS: WorkKind[] = ["presentation", "paper", "creative", "study", "lab", "software", "other"];
const MAX_FOUND_ITEMS = 12;

export interface PlanServiceResult {
  status: number;
  body: PlanResponse;
}

/**
 * Gemini names the learning goal a step practices. Keep it only when it is one
 * of the owner's own goals, and surface it in the reason students read.
 */
function withPracticeNotes(rawTasks: unknown, members: PlanMember[]): unknown {
  if (!Array.isArray(rawTasks)) return rawTasks;
  const goalsById = new Map(members.map((m) => [m.id, m.wantsToLearn]));
  return rawTasks.map((raw) => {
    if (typeof raw !== "object" || raw === null) return raw;
    const { practices, ...task } = raw as Record<string, unknown>;
    const goal = (goalsById.get(task.suggestedOwnerId as string) ?? []).find(
      (g) => typeof practices === "string" && g.toLowerCase() === practices.trim().toLowerCase()
    );
    const reason = typeof task.assignmentReason === "string" ? task.assignmentReason.trim() : "";
    if (!goal || reason.toLowerCase().includes(goal.toLowerCase())) return task;
    return { ...task, assignmentReason: `${reason} A chance to practice ${goal}.`.trim() };
  });
}

function validateUnderstanding(raw: unknown, fromAssignment: boolean): ValidationResult<PlanUnderstanding> {
  const issues: string[] = [];
  const u = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const strings = (value: unknown, field: string) => {
    if (!Array.isArray(value) || !value.every((v) => typeof v === "string")) {
      issues.push(`understanding.${field} must be a list of strings.`);
      return [];
    }
    return (value as string[]).map((v) => v.trim()).filter(Boolean).slice(0, MAX_FOUND_ITEMS);
  };

  if (!WORK_KINDS.includes(u.kind as WorkKind)) issues.push(`understanding.kind must be one of ${WORK_KINDS.join(", ")}.`);
  if (typeof u.summary !== "string" || !u.summary.trim()) issues.push("understanding.summary is required.");
  const deliverables = strings(u.deliverables, "deliverables");

  const milestones: PlanUnderstanding["milestones"] = [];
  if (!Array.isArray(u.milestones)) issues.push("understanding.milestones must be a list.");
  else {
    for (const rawMilestone of u.milestones.slice(0, MAX_FOUND_ITEMS)) {
      const m = (rawMilestone ?? {}) as Record<string, unknown>;
      if (typeof m.title !== "string" || !m.title.trim()) continue;
      if (m.date && !isIsoDay(m.date)) issues.push(`Milestone "${m.title}" needs a YYYY-MM-DD date or an empty string.`);
      milestones.push({ title: m.title.trim(), date: isIsoDay(m.date) ? m.date : undefined });
    }
  }
  if (u.finalDeadline && !isIsoDay(u.finalDeadline)) issues.push("understanding.finalDeadline must be YYYY-MM-DD or empty.");

  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    value: {
      kind: u.kind as WorkKind,
      summary: (u.summary as string).trim(),
      deliverables,
      milestones,
      finalDeadline: isIsoDay(u.finalDeadline) ? u.finalDeadline : undefined,
      fromAssignment,
    },
  };
}

function failure(status: number, body: Omit<PlanErrorResponse, "ok">): PlanServiceResult {
  return { status, body: { ok: false, ...body } };
}

export async function generatePlan(requestBody: unknown): Promise<PlanServiceResult> {
  const parsed = parsePlanRequest(requestBody);
  if (!parsed.ok) {
    return failure(400, { error: "bad_request", message: "Invalid plan request.", issues: parsed.issues });
  }

  const { project, mode, assignment } = parsed.value;
  const today = todayIsoDay();
  const deadline = toIsoDay(project.deadline);
  const context: PlanValidationContext = { projectId: project.id, memberIds: project.members.map((m) => m.id), deadline };

  if (mode === "demo") {
    const demo = validatePlanTasks(buildDemoPlan(project, today, deadline), context);
    if (!demo.ok) {
      return failure(500, { error: "gemini_invalid_output", message: "Demo plan failed validation.", issues: demo.issues });
    }
    return { status: 200, body: { ok: true, source: "demo", tasks: demo.value } };
  }

  const attachments: GeminiAttachment[] = assignment?.file
    ? [{ mimeType: assignment.file.mimeType, data: assignment.file.data }]
    : [];

  const result = await generateValidatedGeminiJson<{ tasks: Task[]; understanding: PlanUnderstanding }>({
    systemInstruction: PLAN_SYSTEM_INSTRUCTION,
    buildPrompt: (issues) => buildPlanPrompt(project, today, deadline, issues, assignment),
    responseSchema: PLAN_RESPONSE_SCHEMA,
    attachments,
    validate: (data) => {
      const d = (typeof data === "object" && data !== null ? data : {}) as Record<string, unknown>;
      const understanding = validateUnderstanding(d.understanding, Boolean(assignment));
      if (!understanding.ok) return understanding;
      // Follow the assignment's own due date when it is earlier than the project deadline.
      const found = understanding.value.finalDeadline;
      const effectiveDeadline = found && found >= today && (!deadline || found < deadline) ? found : deadline;
      const tasks = validatePlanTasks(withPracticeNotes(d.tasks, project.members), { ...context, deadline: effectiveDeadline });
      return tasks.ok ? { ok: true, value: { tasks: tasks.value, understanding: understanding.value } } : tasks;
    },
  });

  if (result.ok) {
    return {
      status: 200,
      body: { ok: true, source: "gemini", model: result.model, tasks: result.value.tasks, understanding: result.value.understanding },
    };
  }
  if (result.error === "missing_key") {
    return failure(503, {
      error: "missing_key",
      message: "Gemini is not configured on the server. You can use the labeled demo plan instead.",
    });
  }
  if (result.error === "gemini_invalid_output") {
    return failure(502, {
      error: "gemini_invalid_output",
      message: "Gemini's plan did not pass validation. Your current plan was not changed.",
      issues: result.issues,
    });
  }
  return failure(502, { error: result.error, message: result.message });
}

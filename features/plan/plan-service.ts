import type { Task } from "@/types";
import type { PlanErrorResponse, PlanResponse } from "./plan-types";
import { generateValidatedGeminiJson } from "@/features/ai/gemini";
import { PLAN_RESPONSE_SCHEMA, PLAN_SYSTEM_INSTRUCTION, buildPlanPrompt } from "./plan-prompt";
import { buildDemoPlan } from "./plan-fallback";
import { parsePlanRequest, toIsoDay, todayIsoDay, validatePlanTasks } from "./plan-validation";

/**
 * Feature Owner: Divij Anand
 * SERVER ONLY. Orchestrates plan generation for POST /api/plan.
 */

export interface PlanServiceResult {
  status: number;
  body: PlanResponse;
}

function failure(status: number, body: Omit<PlanErrorResponse, "ok">): PlanServiceResult {
  return { status, body: { ok: false, ...body } };
}

export async function generatePlan(requestBody: unknown): Promise<PlanServiceResult> {
  const parsed = parsePlanRequest(requestBody);
  if (!parsed.ok) {
    return failure(400, { error: "bad_request", message: "Invalid plan request.", issues: parsed.issues });
  }

  const { project, mode } = parsed.value;
  const today = todayIsoDay();
  const deadline = toIsoDay(project.deadline);
  const context = { projectId: project.id, memberIds: project.members.map((m) => m.id), deadline };

  if (mode === "demo") {
    const demo = validatePlanTasks(buildDemoPlan(project, today, deadline), context);
    if (!demo.ok) {
      return failure(500, { error: "gemini_invalid_output", message: "Demo plan failed validation.", issues: demo.issues });
    }
    return { status: 200, body: { ok: true, source: "demo", tasks: demo.value } };
  }

  const result = await generateValidatedGeminiJson<Task[]>({
    systemInstruction: PLAN_SYSTEM_INSTRUCTION,
    buildPrompt: (issues) => buildPlanPrompt(project, today, deadline, issues),
    responseSchema: PLAN_RESPONSE_SCHEMA,
    validate: (data) => validatePlanTasks((data as { tasks?: unknown } | null)?.tasks, context),
  });

  if (result.ok) {
    return { status: 200, body: { ok: true, source: "gemini", model: result.model, tasks: result.value } };
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

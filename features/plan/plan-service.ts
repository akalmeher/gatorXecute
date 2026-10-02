import type { PlanErrorResponse, PlanResponse } from "./plan-types";
import { GeminiError, generateGeminiJson, hasGeminiKey } from "./gemini";
import { PLAN_RESPONSE_SCHEMA, PLAN_SYSTEM_INSTRUCTION, buildPlanPrompt } from "./plan-prompt";
import { buildDemoPlan } from "./plan-fallback";
import { parsePlanRequest, toIsoDay, todayIsoDay, validatePlanTasks } from "./plan-validation";

/**
 * Feature Owner: Divij Anand
 * SERVER ONLY. Orchestrates plan generation for POST /api/plan.
 */

// One initial attempt plus one repair attempt that feeds validation issues back to Gemini.
const MAX_GEMINI_ATTEMPTS = 2;

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

  if (!hasGeminiKey()) {
    return failure(503, {
      error: "missing_key",
      message: "Gemini is not configured on the server. You can use the labeled demo plan instead.",
    });
  }

  let issues: string[] = [];
  for (let attempt = 1; attempt <= MAX_GEMINI_ATTEMPTS; attempt++) {
    try {
      const { data, model } = await generateGeminiJson({
        systemInstruction: PLAN_SYSTEM_INSTRUCTION,
        prompt: buildPlanPrompt(project, today, deadline, issues),
        responseSchema: PLAN_RESPONSE_SCHEMA,
      });
      const rawTasks = (data as { tasks?: unknown } | null)?.tasks;
      const result = validatePlanTasks(rawTasks, context);
      if (result.ok) {
        return { status: 200, body: { ok: true, source: "gemini", model, tasks: result.value } };
      }
      issues = result.issues;
    } catch (error) {
      if (error instanceof GeminiError && (error.code === "invalid_json" || error.code === "empty_response")) {
        issues = [error.message];
        continue;
      }
      const message = error instanceof GeminiError ? error.message : "Unexpected error while calling Gemini.";
      if (!(error instanceof GeminiError)) console.error("[plan] unexpected error", error);
      return failure(502, { error: "gemini_request_failed", message });
    }
  }

  return failure(502, {
    error: "gemini_invalid_output",
    message: "Gemini's plan did not pass validation. Your current plan was not changed.",
    issues,
  });
}

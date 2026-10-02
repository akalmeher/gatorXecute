import type { Member, Task } from "@/types";

/**
 * Feature Owner: Divij Anand
 * Request/response contract for POST /api/plan.
 */

export type PlanMember = Pick<Member, "id" | "name" | "role" | "skills" | "wantsToLearn">;

export interface PlanProjectInput {
  id: string;
  name: string;
  course: string;
  description: string;
  deadline: string;
  members: PlanMember[];
}

// "live" calls Gemini; "demo" returns the clearly labeled offline fallback.
export type PlanMode = "live" | "demo";

export interface PlanRequest {
  project: PlanProjectInput;
  mode?: PlanMode;
}

export type PlanSource = "gemini" | "demo";

export interface PlanSuccessResponse {
  ok: true;
  source: PlanSource;
  model?: string;
  tasks: Task[];
}

export type PlanErrorCode =
  | "bad_request"
  | "missing_key"
  | "gemini_request_failed"
  | "gemini_invalid_output";

export interface PlanErrorResponse {
  ok: false;
  error: PlanErrorCode;
  message: string;
  issues?: string[];
}

export type PlanResponse = PlanSuccessResponse | PlanErrorResponse;

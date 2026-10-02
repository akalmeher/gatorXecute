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

/** The assignment itself: pasted text and/or an uploaded PDF or text file (base64). */
export interface PlanAssignment {
  text?: string;
  file?: { name: string; mimeType: string; data: string };
}

export const ASSIGNMENT_FILE_TYPES = ["application/pdf", "text/plain", "text/markdown"];
export const MAX_ASSIGNMENT_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_ASSIGNMENT_TEXT_CHARS = 40_000;

export interface PlanRequest {
  project: PlanProjectInput;
  mode?: PlanMode;
  assignment?: PlanAssignment;
}

export type PlanSource = "gemini" | "demo";

/** The kind of work shapes the steps: a film plans differently from a lab report. */
export type WorkKind = "presentation" | "paper" | "creative" | "study" | "lab" | "software" | "other";

/** "Got it. I found…": what Gemini understood from the assignment. */
export interface PlanUnderstanding {
  kind: WorkKind;
  /** One plain sentence about what the team is making. */
  summary: string;
  deliverables: string[];
  milestones: { title: string; date?: string }[];
  /** YYYY-MM-DD when the assignment states one. */
  finalDeadline?: string;
  /** True when this came from an attached or pasted assignment, not just the project description. */
  fromAssignment: boolean;
}

export interface PlanSuccessResponse {
  ok: true;
  source: PlanSource;
  model?: string;
  tasks: Task[];
  understanding?: PlanUnderstanding;
}

export type PlanErrorCode =
  | "bad_request"
  | "missing_key"
  | "gemini_request_failed"
  | "gemini_invalid_output"
  | "rate_limited";

export interface PlanErrorResponse {
  ok: false;
  error: PlanErrorCode;
  message: string;
  issues?: string[];
}

export type PlanResponse = PlanSuccessResponse | PlanErrorResponse;

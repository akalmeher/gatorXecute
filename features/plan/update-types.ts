import type { Task, TaskStatus } from "@/types";

/**
 * Feature Owner: Divij Anand
 * Contract for POST /api/progress-update: "finished the research btw" ->
 * proposed status changes. Safe to import from client components.
 */

export interface ProgressUpdateRequest {
  mode?: "live" | "demo";
  project: { id: string; name: string; members: { id: string; name: string }[] };
  tasks: Task[];
  /** What the student wrote, e.g. "finished the research, still waiting on Maya's sources". */
  text: string;
  /** Who is posting, so "I" and "my" resolve to the right person. */
  authorId?: string;
}

export interface StatusChange {
  taskId: string;
  status: TaskStatus;
  /** The words that justify it, e.g. "finished the research". */
  because: string;
}

export interface ProgressInterpretation {
  /** One friendly sentence, e.g. "Sounds like the research is done and the slides are waiting on Maya's sources." */
  summary: string;
  changes: StatusChange[];
  /** Anything that couldn't be matched to a step, e.g. "I couldn't tell which step 'the poster' is." */
  unmatched: string[];
}

export type ProgressUpdateResponse =
  | { ok: true; source: "gemini" | "demo"; model?: string; interpretation: ProgressInterpretation }
  | {
      ok: false;
      error: "bad_request" | "missing_key" | "gemini_request_failed" | "gemini_invalid_output";
      message: string;
      issues?: string[];
    };

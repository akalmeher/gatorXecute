import type { Task } from "@/types";
import type { PlanMember } from "./plan-types";

/**
 * Feature Owner: Divij Anand
 * Contract for POST /api/replan. Safe to import from client components.
 *
 * Gemini proposes a small set of changes to keep the project moving. Nothing is
 * applied until a student chooses "Use suggestion".
 */

export interface ReplanRequest {
  mode?: "live" | "demo";
  project: { id: string; name: string; deadline: string; members: PlanMember[] };
  tasks: Task[];
  /** Optional note from the student, e.g. "Oscar is out sick until Thursday". */
  concern?: string;
  /** Proposals already shown, so "See another option" returns something different. */
  avoid?: string[];
  /** Recent notes from the team (newest first), so proposals can use the real reason. */
  notes?: { from: string; text: string }[];
}

export interface PlanChange {
  taskId: string;
  ownerId?: string;
  dueDate?: string;
  /** One plain sentence, e.g. "Sara is free and has done similar writing." */
  why: string;
}

export interface ReplanSuggestion {
  /** "The team may be about a day behind." or "You're on track." */
  headline: string;
  /** What is happening to the work, without blaming anyone. */
  situation: string;
  /** The one-sentence fix, e.g. "Sara can work on documentation today while Omar finishes the database." */
  proposal: string;
  changes: PlanChange[];
  /** What the plan looks like afterwards, e.g. "Everything still finishes by Wed, Oct 14." */
  outcome: string;
  /** True when nothing needs to change; changes is then empty. */
  onTrack: boolean;
}

export type ReplanResponse =
  | { ok: true; source: "gemini" | "demo"; model?: string; suggestion: ReplanSuggestion }
  | {
      ok: false;
      error: "bad_request" | "missing_key" | "gemini_request_failed" | "gemini_invalid_output" | "rate_limited";
      message: string;
      issues?: string[];
    };

import type { AsyncUpdate, Meeting, Member, Task } from "@/types";

/**
 * Feature Owner: Divij Anand (service) · Consumer: Shreya Rameshwar (meeting UI)
 * Contract for POST /api/catch-up. Safe to import from client components.
 */

export interface CatchUpRequest {
  mode?: "live" | "demo";
  meeting: Pick<Meeting, "id" | "title" | "scheduledTime" | "durationMinutes" | "attendeeIds" | "agendaItems">;
  /** Notes captured during the meeting. Without them, no decisions are reported. */
  notes?: string;
  /** The member catching up; the summary is written for them when provided. */
  absentMemberId?: string;
  asyncUpdates: AsyncUpdate[];
  tasks: Task[];
  members: Pick<Member, "id" | "name" | "role">[];
}

export interface CatchUpActionItem {
  text: string;
  /** Suggestion only; the team decides who actually owns it. */
  suggestedOwnerId?: string;
  relatedTaskId?: string;
}

export interface CatchUp {
  summary: string;
  decisions: string[];
  actionItems: CatchUpActionItem[];
  /** What the inputs did not cover, e.g. missing notes. Show this to the user. */
  missingInfo: string[];
}

export type CatchUpResponse =
  | { ok: true; source: "gemini" | "demo"; model?: string; catchUp: CatchUp }
  | {
      ok: false;
      error: "bad_request" | "missing_key" | "gemini_request_failed" | "gemini_invalid_output";
      message: string;
      issues?: string[];
    };

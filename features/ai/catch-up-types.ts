import type { AsyncUpdate, Meeting, Member, Task } from "@/types";

/**
 * Feature Owner: Divij Anand (service) · Consumer: Shreya Rameshwar (meeting UI)
 * Contract for POST /api/catch-up. Safe to import from client components.
 *
 * Shaped around "Here's what you missed": what was decided, what changed,
 * what the absent student needs to do, and who agreed to what. Not a transcript.
 */

export interface CatchUpRequest {
  mode?: "live" | "demo";
  meeting: Pick<Meeting, "id" | "title" | "scheduledTime" | "durationMinutes" | "attendeeIds" | "agendaItems">;
  /** Notes captured during the meeting. Without them, nothing is reported as decided. */
  notes?: string;
  /** The student catching up. "yourPart" is written for them and is empty without it. */
  absentMemberId?: string;
  asyncUpdates: AsyncUpdate[];
  tasks: Task[];
  members: Pick<Member, "id" | "name" | "role">[];
}

export interface CatchUpAction {
  text: string;
  relatedTaskId?: string;
}

/** An agreement between people, e.g. "Maya will find three sources by Friday". */
export interface CatchUpCommitment {
  /** Omitted when the whole team agreed or the person is unclear. */
  memberId?: string;
  text: string;
  /** As stated in the source, e.g. "Friday". */
  due?: string;
  relatedTaskId?: string;
}

export interface CatchUp {
  /** One plain sentence answering "does this affect me?", e.g. "One decision was made. Your work hasn't changed." */
  headline: string;
  decided: string[];
  changed: string[];
  /** What the absent student should do now. Empty means nothing needs them. */
  yourPart: CatchUpAction[];
  /** Suggestions until the team confirms them. */
  commitments: CatchUpCommitment[];
  openQuestions: string[];
  /** What the inputs did not cover, e.g. missing notes. Show this to the user. */
  missingInfo: string[];
}

export type CatchUpResponse =
  | { ok: true; source: "gemini" | "demo"; model?: string; catchUp: CatchUp }
  | {
      ok: false;
      error: "bad_request" | "missing_key" | "gemini_request_failed" | "gemini_invalid_output" | "rate_limited";
      message: string;
      issues?: string[];
    };

import type { AsyncUpdate, Meeting, Member, Task } from "@/types";

/**
 * Feature Owner: Divij Anand (service) · Consumer: Shreya Rameshwar (meeting UI)
 * Contract for POST /api/meeting-brief. Safe to import from client components.
 *
 * Shaped around "Worth discussing": only the decisions and problems that need
 * the group together, and an honest signal when the meeting may not be needed.
 */

export interface MeetingBriefRequest {
  mode?: "live" | "demo";
  project: { name: string; deadline: string };
  meeting: Pick<Meeting, "title" | "durationMinutes" | "attendeeIds">;
  tasks: Task[];
  asyncUpdates: AsyncUpdate[];
  members: Pick<Member, "id" | "name" | "role">[];
}

export type DiscussionKind = "decision" | "waiting" | "deadline" | "check-in";

export interface DiscussionItem {
  /** Short and human, e.g. "Choose the final film". */
  title: string;
  /** One plain sentence on why it needs the group, e.g. "Maya can't start editing until this is settled." */
  why: string;
  kind: DiscussionKind;
  minutes: number;
  relatedTaskIds: string[];
}

export interface MeetingBrief {
  /** One sentence, e.g. "Three things are worth discussing." */
  headline: string;
  /** Most important first. Total minutes never exceed the meeting length. */
  worthDiscussing: DiscussionItem[];
  /** e.g. "Everything else is on track." */
  everythingElse: string;
  /** False when nothing needs the group live; the UI can offer to skip the meeting. */
  meetingNeeded: boolean;
}

export type MeetingBriefResponse =
  | { ok: true; source: "gemini" | "demo"; model?: string; brief: MeetingBrief }
  | {
      ok: false;
      error: "bad_request" | "missing_key" | "gemini_request_failed" | "gemini_invalid_output" | "rate_limited";
      message: string;
      issues?: string[];
    };

/** Converts a brief into the canonical Meeting.agendaItems strings. */
export function toAgendaItems(brief: MeetingBrief): string[] {
  return brief.worthDiscussing.map((item) => item.title);
}

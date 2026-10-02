import type { AsyncUpdate, Meeting, Member, Task } from "@/types";

/**
 * Feature Owner: Divij Anand (service) · Consumer: Shreya Rameshwar (meeting UI)
 * Contract for POST /api/meeting-brief. Safe to import from client components.
 */

export interface MeetingBriefRequest {
  mode?: "live" | "demo";
  project: { name: string; deadline: string };
  meeting: Pick<Meeting, "title" | "durationMinutes" | "attendeeIds">;
  tasks: Task[];
  asyncUpdates: AsyncUpdate[];
  members: Pick<Member, "id" | "name" | "role">[];
}

export interface MeetingAgendaItem {
  title: string;
  minutes: number;
  relatedTaskIds: string[];
}

export interface MeetingBrief {
  /** One sentence: what this meeting should accomplish. */
  goal: string;
  /** Timeboxed agenda; minutes never exceed the meeting duration in total. */
  agenda: MeetingAgendaItem[];
}

export type MeetingBriefResponse =
  | { ok: true; source: "gemini" | "demo"; model?: string; brief: MeetingBrief }
  | {
      ok: false;
      error: "bad_request" | "missing_key" | "gemini_request_failed" | "gemini_invalid_output";
      message: string;
      issues?: string[];
    };

/** Converts a brief into the canonical Meeting.agendaItems strings. */
export function toAgendaItems(brief: MeetingBrief): string[] {
  return brief.agenda.map((item) => `${item.title} (${item.minutes} min)`);
}

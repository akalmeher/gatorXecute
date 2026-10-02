/**
 * Feature Owner: Divij Anand
 * Contract for POST /api/share-check: before anything a student writes is
 * shared with teammates, decide whether it's personal, what a discreet version
 * would say, whether they're away, and whether to offer support.
 * Safe to import from client components.
 */

export type Wellbeing = "none" | "low" | "crisis";

export interface ShareCheckRequest {
  mode?: "live" | "demo";
  text: string;
  /** The student's name, so the discreet version can say "Divij is away…". */
  authorName: string;
}

export interface ShareCheck {
  /** Health, family, grief or other private details. */
  personal: boolean;
  /** What teammates see by default: the effect on the work, never the reason. */
  shareable: string;
  /** Inclusive YYYY-MM-DD dates the student can't work, if they said so. */
  awayFrom?: string;
  awayTo?: string;
  wellbeing: Wellbeing;
  /** One short, kind line for the student (empty when nothing personal). */
  acknowledgement: string;
}

export type ShareCheckResponse =
  | { ok: true; source: "gemini" | "demo"; model?: string; check: ShareCheck }
  | {
      ok: false;
      error: "bad_request" | "missing_key" | "gemini_request_failed" | "gemini_invalid_output" | "rate_limited";
      message: string;
      issues?: string[];
    };

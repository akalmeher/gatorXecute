/**
 * Feature Owner: Divij Anand
 * Contract for POST /api/coordinate: one box, "What needs coordinating?".
 * Gemini infers the workflow from the student's words; the UI routes there.
 * Safe to import from client components.
 */

export type CoordinateIntent = "meet" | "project" | "update" | "help" | "unclear";

export interface CoordinateRequest {
  mode?: "live" | "demo";
  text: string;
  /** Names of teammates the app already knows, so "Maya" can be recognized. */
  knownPeople?: string[];
}

export interface CoordinateResult {
  intent: CoordinateIntent;
  /** Short name for what this is about, e.g. "Cinema presentation". Empty if none. */
  title: string;
  /** Meeting length in minutes when it's about meeting, otherwise 0. */
  durationMinutes: number;
  people: string[];
  /** One short line confirming what happens next, e.g. "Let's find a time with Maya." */
  reply: string;
}

export type CoordinateResponse =
  | { ok: true; source: "gemini" | "demo"; model?: string; result: CoordinateResult }
  | {
      ok: false;
      error: "bad_request" | "missing_key" | "gemini_request_failed" | "gemini_invalid_output" | "rate_limited";
      message: string;
      issues?: string[];
    };

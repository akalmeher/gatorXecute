import type { AvailabilityBlock } from "@/types";
import { DAYS, END_HOUR, SLOT_MINUTES, START_HOUR } from "@/features/scheduling/scheduling-utils";

/**
 * Feature Owner: Divij Anand (service) · Consumer: Oscar Garcia (availability grid)
 * Contract for POST /api/availability: "tell us when you're free" in plain words.
 * Safe to import from client components.
 */

export type DayOfWeek = AvailabilityBlock["dayOfWeek"];

/** Human availability isn't binary. Optional; grids that only know free/busy can ignore it. */
export type AvailabilityLevel = "preferred" | "available" | "if-needed";

/** Canonical AvailabilityBlock plus the optional level. Assignable to AvailabilityBlock[]. */
export type LeveledAvailabilityBlock = AvailabilityBlock & { level?: AvailabilityLevel };

export interface AvailabilityGrid {
  days: DayOfWeek[];
  startHour: number;
  endHour: number;
  slotMinutes: number;
}

/** Always Oscar's grid (days, hours and cell size come from scheduling-utils), local wall-clock time. */
export const DEFAULT_GRID: AvailabilityGrid = {
  days: [...DAYS],
  startHour: START_HOUR,
  endHour: END_HOUR,
  slotMinutes: SLOT_MINUTES,
};

export interface AvailabilityRequest {
  mode?: "live" | "demo";
  memberId: string;
  /** e.g. "Free after 4 except Wednesdays" or a pasted class schedule. */
  text: string;
  /** The member's current blocks, so edits like "Thursdays don't work anymore" apply on top. */
  current?: AvailabilityBlock[];
  grid?: Partial<AvailabilityGrid>;
}

/** One rule Gemini read from the text. The server turns rules into grid cells. */
export interface AvailabilityRule {
  effect: "available" | "unavailable";
  level?: AvailabilityLevel;
  days: DayOfWeek[];
  start: string; // "HH:MM", 24h
  end: string; // "HH:MM", 24h, after start
  /** e.g. "BIO 230 class". */
  label?: string;
}

export interface AvailabilityResult {
  memberId: string;
  /** Replaces this member's blocks once the student confirms. */
  blocks: LeveledAvailabilityBlock[];
  /** What Gemini understood, one plain sentence, e.g. "Free weekday afternoons from 4, except Wednesdays." */
  summary: string;
  /** What the grid now says, computed from the cells (not AI), e.g. ["Mon, Tue, Thu, Fri: 4 PM–9 PM", "Wed: not free"]. */
  readBack: string[];
  /** Things that couldn't be applied or need a look, e.g. "Saturday isn't on this grid." */
  notes: string[];
  /** The rules as understood, for transparency. */
  rules: AvailabilityRule[];
}

export type AvailabilityResponse =
  | { ok: true; source: "gemini" | "demo"; model?: string; result: AvailabilityResult }
  | {
      ok: false;
      error: "bad_request" | "missing_key" | "gemini_request_failed" | "gemini_invalid_output" | "rate_limited";
      message: string;
      issues?: string[];
    };

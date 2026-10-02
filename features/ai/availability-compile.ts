import type { AvailabilityBlock } from "@/types";
import type {
  AvailabilityGrid,
  AvailabilityLevel,
  AvailabilityRule,
  DayOfWeek,
  LeveledAvailabilityBlock,
} from "./availability-types";

/**
 * Feature Owner: Divij Anand
 * Deterministic: turns availability rules into grid cells and back into blocks.
 * Gemini only reads the student's words into rules; all time math happens here.
 *
 * Rounding is cautious: free time shrinks to whole cells (a 4:10 start becomes
 * 4:30), busy time grows to whole cells (a class ending 10:50 blocks until 11:00).
 */

export const ALL_DAYS: DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_NAMES: Record<DayOfWeek, string> = {
  Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday",
};

type CellMap = Map<string, AvailabilityLevel>;

export function parseClock(value: string): number | undefined {
  const match = /^([01]\d|2[0-4]):([0-5]\d)$/.exec(value);
  if (!match) return undefined;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return minutes <= 24 * 60 ? minutes : undefined;
}

function clock(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** "16:00" -> "4 PM", "09:30" -> "9:30 AM". */
export function friendlyTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h >= 12 ? "PM" : "AM"}`;
}

const key = (day: DayOfWeek, minute: number) => `${day}-${minute}`;

/** Existing blocks -> cells. Blocks without a level count as plain "available". */
export function cellsFromBlocks(blocks: AvailabilityBlock[], grid: AvailabilityGrid): CellMap {
  const cells: CellMap = new Map();
  for (const block of blocks) {
    if (!block.isAvailable) continue;
    const start = parseClock(block.startTime);
    const end = parseClock(block.endTime);
    if (start === undefined || end === undefined) continue;
    const level = (block as LeveledAvailabilityBlock).level ?? "available";
    for (let m = start; m < end; m += grid.slotMinutes) cells.set(key(block.dayOfWeek, m), level);
  }
  return cells;
}

/** Applies rules in order on top of a starting set of cells. Returns notes for anything skipped. */
export function applyRules(start: CellMap, rules: AvailabilityRule[], grid: AvailabilityGrid) {
  const cells: CellMap = new Map(start);
  const notes = new Set<string>();
  const open = grid.startHour * 60;
  const close = grid.endHour * 60;
  const slot = grid.slotMinutes;
  const window = `${friendlyTime(open)}–${friendlyTime(close)}`;

  for (const rule of rules) {
    const what = rule.label ? `"${rule.label}"` : "Some of what you wrote";
    const offGrid = rule.days.filter((d) => !grid.days.includes(d));
    if (offGrid.length > 0) {
      const names = offGrid.map((d) => DAY_NAMES[d]).join(" and ");
      notes.add(`${names} ${offGrid.length === 1 ? "isn't" : "aren't"} on this grid, so ${rule.label ? what : "that part"} was skipped there.`);
    }
    const days = rule.days.filter((d) => grid.days.includes(d));
    const startMin = parseClock(rule.start)!;
    const endMin = parseClock(rule.end)!;

    if (endMin <= open || startMin >= close) {
      if (days.length > 0) notes.add(`${what} is outside the grid hours (${window}), so it doesn't change anything.`);
      continue;
    }
    const isFree = rule.effect === "available";
    const s = Math.max(open, isFree ? Math.ceil(startMin / slot) * slot : Math.floor(startMin / slot) * slot);
    const e = Math.min(close, isFree ? Math.floor(endMin / slot) * slot : Math.ceil(endMin / slot) * slot);
    if (s >= e) continue;

    for (const day of days) {
      for (let m = s; m < e; m += slot) {
        if (isFree) cells.set(key(day, m), rule.level ?? "available");
        else cells.delete(key(day, m));
      }
    }
  }
  return { cells, notes: [...notes] };
}

/** Cells -> merged blocks (one per run of same-level cells). Level is only set when not plain "available". */
export function blocksFromCells(cells: CellMap, memberId: string, grid: AvailabilityGrid): LeveledAvailabilityBlock[] {
  const blocks: LeveledAvailabilityBlock[] = [];
  const open = grid.startHour * 60;
  const close = grid.endHour * 60;
  for (const day of grid.days) {
    let runStart: number | undefined;
    let runLevel: AvailabilityLevel | undefined;
    for (let m = open; m <= close; m += grid.slotMinutes) {
      const level = m < close ? cells.get(key(day, m)) : undefined;
      if (level !== runLevel) {
        if (runLevel && runStart !== undefined) {
          blocks.push({
            id: `av-${memberId}-${day}-${clock(runStart)}`,
            memberId,
            dayOfWeek: day,
            startTime: clock(runStart),
            endTime: clock(m),
            isAvailable: true,
            ...(runLevel !== "available" ? { level: runLevel } : {}),
          });
        }
        runStart = m;
        runLevel = level;
      }
    }
  }
  return blocks;
}

/** Deterministic read-back of what the grid now says, grouping days with identical hours. */
export function describeBlocks(blocks: LeveledAvailabilityBlock[], grid: AvailabilityGrid): string[] {
  const LEVEL_NOTE: Record<AvailabilityLevel, string> = { preferred: " (preferred)", available: "", "if-needed": " (if needed)" };
  const byDay = new Map<DayOfWeek, string>();
  for (const day of grid.days) {
    const ranges = blocks
      .filter((b) => b.dayOfWeek === day)
      .map((b) => `${friendlyTime(parseClock(b.startTime)!)}–${friendlyTime(parseClock(b.endTime)!)}${LEVEL_NOTE[b.level ?? "available"]}`);
    byDay.set(day, ranges.length > 0 ? ranges.join(", ") : "not free");
  }
  const groups = new Map<string, DayOfWeek[]>();
  for (const [day, text] of byDay) groups.set(text, [...(groups.get(text) ?? []), day]);
  return [...groups].map(([text, days]) => `${days.join(", ")}: ${text}`);
}

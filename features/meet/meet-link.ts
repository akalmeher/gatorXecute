import type { AvailabilityBlock } from "@/types";
import {
  DAYS,
  END_HOUR,
  START_HOUR,
  TIME_SLOTS,
  blocksToCells,
  cellsToBlocks,
  findBestMeetingTime,
  timeToMinutes,
  type MeetingRecommendation,
} from "@/features/scheduling/scheduling-utils";
import { MAX_WHERE_CHARS, parseWhere, whereForCalendar } from "./meet-where";

/**
 * Feature Owner: Divij Anand
 * Quick Meet keeps the whole poll inside the link's #fragment, which browsers
 * never send to a server. No accounts, no database: each person adds their
 * times and passes the updated link along.
 *
 * Format v2: base64url(JSON) with each person's grid packed as one hex bitmask
 * per day over Oscar's grid (DAYS, 9 AM–9 PM, 30-minute cells). A confirmed
 * slot carries an explicit date, IANA time zone and the attendee ids.
 * "Where?" is optional free text (see meet-where.ts) and survives time changes.
 */

export type Day = AvailabilityBlock["dayOfWeek"];

export interface MeetPerson {
  id: string;
  name: string;
  blocks: AvailabilityBlock[];
}

export interface MeetChoice {
  day: Day;
  /** YYYY-MM-DD, resolved once by whoever confirmed it, so everyone shares one date. */
  date: string;
  startTime: string;
  endTime: string;
  /** IANA time zone the times are in, e.g. "America/Los_Angeles". */
  timeZone: string;
  /** Who can actually attend; may be fewer than everyone in the poll. */
  attendeeIds: string[];
}

export interface MeetPoll {
  title: string;
  durationMinutes: number;
  people: MeetPerson[];
  chosen?: MeetChoice;
  /** Where to meet, as typed: a place, a link, a phone number or an app name. */
  where?: string;
}

export const MAX_PEOPLE = 12;
export const DURATIONS = [30, 45, 60, 90, 120];
// 24 half-hour cells per day fit in a 32-bit number, so plain bit math is safe.
const HEX_PER_DAY = Math.ceil(TIME_SLOTS.length / 4);
const VERSION = 2;

type PackedChoice = [day: string, date: string, start: string, end: string, timeZone: string, attendees: string];
type PackedPoll = { v: number; t: string; d: number; p: [string, string, string][]; c?: PackedChoice; w?: string };

export function newPersonId(): string {
  return `p${Math.random().toString(36).slice(2, 8)}`;
}

function packCells(blocks: AvailabilityBlock[]): string {
  const cells = blocksToCells(blocks);
  return DAYS.map((day) => {
    let bits = 0;
    TIME_SLOTS.forEach((time, i) => {
      if (cells.has(`${day}-${time}`)) bits |= 1 << i;
    });
    return (bits >>> 0).toString(16).padStart(HEX_PER_DAY, "0");
  }).join("");
}

function unpackCells(personId: string, packed: string): AvailabilityBlock[] {
  const cells = new Set<string>();
  DAYS.forEach((day, d) => {
    const hex = packed.slice(d * HEX_PER_DAY, (d + 1) * HEX_PER_DAY);
    if (!/^[0-9a-f]+$/.test(hex)) return;
    const bits = parseInt(hex, 16);
    TIME_SLOTS.forEach((time, i) => {
      if ((bits >>> i) & 1) cells.add(`${day}-${time}`);
    });
  });
  return cellsToBlocks(personId, cells);
}

export function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

// ---------- Dates and time zones ----------

const WEEKDAY_INDEX: Record<Day, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return timeZone.length > 0 && timeZone.length <= 64;
  } catch {
    return false;
  }
}

export function localTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

/** Wall-clock date and minutes-past-midnight for an instant in a time zone. */
function wallClock(instant: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
    })
      .formatToParts(instant)
      .map((p) => [p.type, p.value])
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    weekday: WEEKDAY_INDEX[parts.weekday as Day],
  };
}

function addDaysIso(isoDay: string, days: number): string {
  const [y, m, d] = isoDay.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function weekdayOf(isoDay: string): number {
  const [y, m, d] = isoDay.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * The next date for a weekday slot in a time zone, including today when the
 * slot hasn't started yet (Monday morning picking Monday 4 PM means today).
 */
export function resolveMeetingDate(day: Day, startTime: string, timeZone: string, now = new Date()): string {
  const local = wallClock(now, timeZone);
  let ahead = (WEEKDAY_INDEX[day] - local.weekday + 7) % 7;
  if (ahead === 0 && timeToMinutes(startTime) <= local.minutes) ahead = 7;
  return addDaysIso(local.date, ahead);
}

/** UTC instant for a wall-clock date and time in a time zone (DST-safe). */
export function zonedTimeToUtc(isoDay: string, time: string, timeZone: string): Date {
  const [y, m, d] = isoDay.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  const target = Date.UTC(y, m - 1, d, h, min);
  let guess = target;
  // Two passes settle the offset even across a daylight-saving change.
  for (let i = 0; i < 2; i++) {
    const wall = wallClock(new Date(guess), timeZone);
    const [wy, wm, wd] = wall.date.split("-").map(Number);
    const wallAsUtc = Date.UTC(wy, wm - 1, wd, Math.floor(wall.minutes / 60), wall.minutes % 60);
    guess += target - wallAsUtc;
  }
  return new Date(guess);
}

// ---------- Validation ----------

const CLOCK = /^([01]\d|2[0-4]):([0-5]\d)$/;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Returns the confirmed slot only if every part of it is consistent; otherwise undefined. */
export function validateChoice(raw: unknown, poll: Pick<MeetPoll, "durationMinutes" | "people">): MeetChoice | undefined {
  if (!Array.isArray(raw) || raw.length !== 6 || !raw.every((x) => typeof x === "string")) return undefined;
  const [day, date, startTime, endTime, timeZone, attendees] = raw as PackedChoice;
  if (!DAYS.includes(day as Day)) return undefined;
  if (!CLOCK.test(startTime) || !CLOCK.test(endTime) || !TIME_SLOTS.includes(startTime)) return undefined;
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (end <= start || start < START_HOUR * 60 || end > END_HOUR * 60) return undefined;
  if (end - start !== poll.durationMinutes) return undefined;
  if (!ISO_DAY.test(date) || Number.isNaN(Date.parse(date)) || addDaysIso(date, 0) !== date) return undefined;
  if (weekdayOf(date) !== WEEKDAY_INDEX[day as Day]) return undefined;
  if (!isValidTimeZone(timeZone)) return undefined;
  const ids = new Set(poll.people.map((p) => p.id));
  const attendeeIds = attendees.split(",").filter(Boolean);
  if (attendeeIds.length === 0 || !attendeeIds.every((id) => ids.has(id))) return undefined;
  return { day: day as Day, date, startTime, endTime, timeZone, attendeeIds: [...new Set(attendeeIds)] };
}

export function encodePoll(poll: MeetPoll): string {
  const c = poll.chosen;
  const packed: PackedPoll = {
    v: VERSION,
    t: poll.title.slice(0, 80),
    d: poll.durationMinutes,
    p: poll.people.slice(0, MAX_PEOPLE).map((person) => [person.id, person.name.slice(0, 40), packCells(person.blocks)]),
    ...(c ? { c: [c.day, c.date, c.startTime, c.endTime, c.timeZone, c.attendeeIds.join(",")] } : {}),
    ...(poll.where?.trim() ? { w: poll.where.trim().slice(0, MAX_WHERE_CHARS) } : {}),
  };
  return toBase64Url(JSON.stringify(packed));
}

/**
 * Returns null for anything that isn't a valid Quick Meet link, so a bad link
 * never crashes the page. An inconsistent confirmed slot is dropped (the poll
 * still loads) so a bad link can never show a meeting as booked.
 */
export function decodePoll(fragment: string): MeetPoll | null {
  try {
    const raw = JSON.parse(fromBase64Url(fragment.replace(/^#/, ""))) as Partial<PackedPoll>;
    if (raw.v !== VERSION || typeof raw.t !== "string" || !DURATIONS.includes(raw.d as number) || !Array.isArray(raw.p)) return null;
    const people = raw.p
      .slice(0, MAX_PEOPLE)
      .filter((p): p is [string, string, string] => Array.isArray(p) && p.length === 3 && p.every((x) => typeof x === "string"))
      .map(([id, name, cells]) => ({ id: id.slice(0, 12), name: name.slice(0, 40), blocks: unpackCells(id, cells) }));
    const where = typeof raw.w === "string" && raw.w.trim() ? raw.w.trim().slice(0, MAX_WHERE_CHARS) : undefined;
    const poll: MeetPoll = { title: raw.t.slice(0, 80), durationMinutes: raw.d as number, people, ...(where ? { where } : {}) };
    const chosen = raw.c === undefined ? undefined : validateChoice(raw.c, poll);
    return chosen ? { ...poll, chosen } : poll;
  } catch {
    return null;
  }
}

// ---------- Recommendation ----------

export interface MeetRecommendation {
  slot: MeetingRecommendation;
  attendees: MeetPerson[];
  /** In the poll but free at other times. */
  busy: MeetPerson[];
  /** In the poll but with no free times marked. */
  noTimes: MeetPerson[];
  everyone: boolean;
}

/**
 * Best time across EVERY person in the poll (people without times still count,
 * so "everyone" is never claimed when someone has no availability). Each
 * person's cells are merged first so adjacent blocks cover longer meetings.
 */
export function recommendMeeting(poll: Pick<MeetPoll, "people" | "durationMinutes">): MeetRecommendation | null {
  if (poll.people.length < 2 || !poll.people.some((p) => p.blocks.length > 0)) return null;
  const merged = poll.people.flatMap((p) => cellsToBlocks(p.id, blocksToCells(p.blocks)));
  const slot = findBestMeetingTime(poll.people.map((p) => p.id), merged, poll.durationMinutes);
  if (!slot) return null;
  const coming = new Set(slot.availableMemberIds);
  const attendees = poll.people.filter((p) => coming.has(p.id));
  const absent = poll.people.filter((p) => !coming.has(p.id));
  return {
    slot,
    attendees,
    busy: absent.filter((p) => p.blocks.length > 0),
    noTimes: absent.filter((p) => p.blocks.length === 0),
    everyone: absent.length === 0,
  };
}

// ---------- Calendar ----------

function icsUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
}

/** A calendar file for the confirmed slot, in UTC so every device shows the same moment. */
export function buildIcs(poll: MeetPoll, choice: MeetChoice, now = new Date()): string {
  const names = (ids: string[]) => poll.people.filter((p) => ids.includes(p.id)).map((p) => p.name);
  const missing = poll.people.filter((p) => !choice.attendeeIds.includes(p.id)).map((p) => p.name);
  const escape = (text: string) => text.replace(/[\\,;]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");
  const where = parseWhere(poll.where);
  const place = where ? whereForCalendar(where) : null;
  const description = [
    place?.url ? `Join: ${place.url}` : "",
    `With ${names(choice.attendeeIds).join(", ")}.`,
    missing.length > 0 ? `Can't make it: ${missing.join(", ")}.` : "",
    `Times chosen in ${choice.timeZone}. Found with gatorXecute Quick Meet.`,
  ]
    .filter(Boolean)
    .join("\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//gatorXecute//Quick Meet//EN",
    "BEGIN:VEVENT",
    `UID:${choice.date}-${choice.startTime.replace(":", "")}-${Math.random().toString(36).slice(2, 10)}@gatorxecute`,
    `DTSTAMP:${icsUtc(now)}`,
    `DTSTART:${icsUtc(zonedTimeToUtc(choice.date, choice.startTime, choice.timeZone))}`,
    `DTEND:${icsUtc(zonedTimeToUtc(choice.date, choice.endTime, choice.timeZone))}`,
    `SUMMARY:${escape(poll.title || "Meeting")}`,
    ...(place?.location ? [`LOCATION:${escape(place.location)}`] : []),
    ...(place?.url ? [`URL:${place.url}`] : []),
    `DESCRIPTION:${escape(description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

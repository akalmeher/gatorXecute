import type { AvailabilityBlock } from "@/types";
import { DAYS, TIME_SLOTS, blocksToCells, cellsToBlocks } from "@/features/scheduling/scheduling-utils";

/**
 * Feature Owner: Divij Anand
 * Quick Meet keeps the whole poll inside the link's #fragment, which browsers
 * never send to a server. No accounts, no database: each person adds their
 * times and passes the updated link along.
 *
 * Format: base64url(JSON) with each person's grid packed as one hex bitmask
 * per day over Oscar's grid (Mon–Fri, 9 AM–9 PM, 30-minute cells).
 */

export interface MeetPerson {
  id: string;
  name: string;
  blocks: AvailabilityBlock[];
}

export interface MeetChoice {
  day: AvailabilityBlock["dayOfWeek"];
  startTime: string;
  endTime: string;
}

export interface MeetPoll {
  title: string;
  durationMinutes: number;
  people: MeetPerson[];
  chosen?: MeetChoice;
}

export const MAX_PEOPLE = 12;
export const DURATIONS = [30, 45, 60, 90, 120];
// 24 half-hour cells per day fit in a 32-bit number, so plain bit math is safe.
const HEX_PER_DAY = Math.ceil(TIME_SLOTS.length / 4);

type PackedPoll = { v: 1; t: string; d: number; p: [string, string, string][]; c?: [string, string, string] };

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

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

export function encodePoll(poll: MeetPoll): string {
  const packed: PackedPoll = {
    v: 1,
    t: poll.title.slice(0, 80),
    d: poll.durationMinutes,
    p: poll.people.slice(0, MAX_PEOPLE).map((person) => [person.id, person.name.slice(0, 40), packCells(person.blocks)]),
    ...(poll.chosen ? { c: [poll.chosen.day, poll.chosen.startTime, poll.chosen.endTime] } : {}),
  };
  return toBase64Url(JSON.stringify(packed));
}

/** Returns null for anything that isn't a valid Quick Meet link, so a bad link never crashes the page. */
export function decodePoll(fragment: string): MeetPoll | null {
  try {
    const raw = JSON.parse(fromBase64Url(fragment.replace(/^#/, ""))) as Partial<PackedPoll>;
    if (raw.v !== 1 || typeof raw.t !== "string" || !DURATIONS.includes(raw.d as number) || !Array.isArray(raw.p)) return null;
    const people = raw.p
      .slice(0, MAX_PEOPLE)
      .filter((p): p is [string, string, string] => Array.isArray(p) && p.every((x) => typeof x === "string"))
      .map(([id, name, cells]) => ({ id: id.slice(0, 12), name: name.slice(0, 40), blocks: unpackCells(id, cells) }));
    const c = raw.c;
    const chosen =
      Array.isArray(c) && DAYS.includes(c[0] as MeetChoice["day"]) && TIME_SLOTS.includes(c[1])
        ? { day: c[0] as MeetChoice["day"], startTime: c[1], endTime: c[2] }
        : undefined;
    return { title: raw.t.slice(0, 80), durationMinutes: raw.d as number, people, chosen };
  } catch {
    return null;
  }
}

/** A calendar file for the next occurrence of the chosen weekday (floating local time). */
export function buildIcs(poll: MeetPoll, choice: MeetChoice, now = new Date()): string {
  const dayIndex = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 }[choice.day];
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  date.setDate(date.getDate() + (((dayIndex - date.getDay()) + 7) % 7 || 7));
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const stamp = (time: string) => `${ymd}T${time.replace(":", "")}00`;
  const names = poll.people.map((p) => p.name).join(", ");
  const escape = (text: string) => text.replace(/[\\,;]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//gatorXecute//Quick Meet//EN",
    "BEGIN:VEVENT",
    `UID:${ymd}-${choice.startTime.replace(":", "")}-${Math.random().toString(36).slice(2, 10)}@gatorxecute`,
    `DTSTAMP:${now.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "")}`,
    `DTSTART:${stamp(choice.startTime)}`,
    `DTEND:${stamp(choice.endTime)}`,
    `SUMMARY:${escape(poll.title || "Meeting")}`,
    `DESCRIPTION:${escape(`With ${names}. Found with gatorXecute Quick Meet.`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

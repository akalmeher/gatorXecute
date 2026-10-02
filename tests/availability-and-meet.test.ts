import { test } from "node:test";
import assert from "node:assert/strict";
import type { AvailabilityBlock } from "@/types";
import { applyRules, blocksFromCells, cellsFromBlocks, describeBlocks } from "@/features/ai/availability-compile";
import { DEFAULT_GRID } from "@/features/ai/availability-types";
import {
  type MeetPerson,
  type MeetPoll,
  buildIcs,
  decodePoll,
  encodePoll,
  recommendMeeting,
  resolveMeetingDate,
  validateChoice,
  zonedTimeToUtc,
} from "@/features/meet/meet-link";

// ---------- Typed availability (time math) ----------

const grid = DEFAULT_GRID;
const compile = (rules: Parameters<typeof applyRules>[1]) => {
  const { cells, notes } = applyRules(new Map(), rules, grid);
  const blocks = blocksFromCells(cells, "me", grid);
  return { blocks, notes, readBack: describeBlocks(blocks, grid) };
};

test("rounds cautiously: busy time grows, free time shrinks", () => {
  const { readBack } = compile([
    { effect: "available", days: ["Mon"], start: "09:00", end: "21:00" },
    { effect: "unavailable", days: ["Mon"], start: "10:00", end: "10:50", label: "BIO 230" },
    { effect: "available", days: ["Tue"], start: "16:10", end: "18:50" },
  ]);
  assert.ok(readBack.includes("Mon: 9 AM–10 AM, 11 AM–9 PM"), readBack.join(" | "));
  assert.ok(readBack.includes("Tue: 4:30 PM–6:30 PM"), readBack.join(" | "));
});

test("later rules override earlier ones, and soft levels survive", () => {
  const { blocks } = compile([
    { effect: "available", days: ["Wed"], start: "17:00", end: "21:00", level: "if-needed" },
    { effect: "available", days: ["Thu"], start: "12:00", end: "14:00", level: "preferred" },
    { effect: "unavailable", days: ["Thu"], start: "13:00", end: "14:00" },
  ]);
  assert.deepEqual(
    blocks.map((b) => [b.dayOfWeek, b.startTime, b.endTime, b.level]),
    [["Wed", "17:00", "21:00", "if-needed"], ["Thu", "12:00", "13:00", "preferred"]]
  );
});

test("the default grid follows the scheduling grid, and off-grid hours are reported, not guessed", () => {
  assert.ok(grid.days.includes("Sat") && grid.days.includes("Sun"));
  const { blocks, notes } = compile([{ effect: "available", days: ["Mon"], start: "06:00", end: "08:00", label: "early mornings" }]);
  assert.equal(blocks.length, 0);
  assert.match(notes.join(), /outside the grid hours/);
});

test("edits apply on top of existing availability", () => {
  const existing = blocksFromCells(applyRules(new Map(), [{ effect: "available", days: ["Mon", "Thu"], start: "16:00", end: "21:00" }], grid).cells, "me", grid);
  const { cells } = applyRules(cellsFromBlocks(existing, grid), [{ effect: "unavailable", days: ["Thu"], start: "09:00", end: "21:00" }], grid);
  assert.deepEqual(blocksFromCells(cells, "me", grid).map((b) => b.dayOfWeek), ["Mon"]);
});

// ---------- Quick Meet attendance ----------

const block = (memberId: string, dayOfWeek: AvailabilityBlock["dayOfWeek"], startTime: string, endTime: string): AvailabilityBlock => ({
  id: `${memberId}-${dayOfWeek}-${startTime}`,
  memberId,
  dayOfWeek,
  startTime,
  endTime,
  isAvailable: true,
});
const person = (id: string, ...blocks: AvailabilityBlock[]): MeetPerson => ({ id, name: id.toUpperCase(), blocks });
const poll = (people: MeetPerson[], durationMinutes = 60) => ({ title: "Study", durationMinutes, people });

test("full overlap: everyone, earliest slot", () => {
  const r = recommendMeeting(poll([person("a", block("a", "Tue", "10:00", "12:00")), person("b", block("b", "Tue", "09:00", "12:00")), person("c", block("c", "Tue", "10:00", "13:00"))]));
  assert.ok(r && r.everyone);
  assert.deepEqual([r.slot.day, r.slot.startTime, r.slot.endTime], ["Tue", "10:00", "11:00"]);
});

test("someone with no times keeps everyone in the count (never 'everyone is free')", () => {
  const r = recommendMeeting(poll([person("a", block("a", "Mon", "16:00", "18:00")), person("b", block("b", "Mon", "16:00", "18:00")), person("c")]));
  assert.ok(r && !r.everyone);
  assert.deepEqual(r.attendees.map((p) => p.id), ["a", "b"]);
  assert.deepEqual(r.noTimes.map((p) => p.id), ["c"]);
  assert.deepEqual(r.slot.availableMemberIds, ["a", "b"]);
});

test("partial attendance with three people names who is busy", () => {
  const r = recommendMeeting(poll([person("a", block("a", "Wed", "13:00", "15:00")), person("b", block("b", "Wed", "13:00", "15:00")), person("c", block("c", "Thu", "13:00", "15:00"))]));
  assert.ok(r && !r.everyone);
  assert.deepEqual(r.busy.map((p) => p.id), ["c"]);
  assert.deepEqual(r.attendees.map((p) => p.id), ["a", "b"]);
});

test("no overlap: nobody shares a slot, so at most one person can attend", () => {
  const r = recommendMeeting(poll([person("a", block("a", "Mon", "09:00", "10:00")), person("b", block("b", "Fri", "17:00", "18:00"))]));
  assert.ok(!r || r.attendees.length < 2);
});

test("adjacent blocks cover a longer meeting (09:00–09:30 + 09:30–10:00 → 60 min)", () => {
  const r = recommendMeeting(
    poll([
      person("a", block("a", "Mon", "09:00", "09:30"), block("a", "Mon", "09:30", "10:00")),
      person("b", block("b", "Mon", "09:00", "09:30"), block("b", "Mon", "09:30", "10:00")),
    ])
  );
  assert.ok(r && r.everyone);
  assert.deepEqual([r.slot.startTime, r.slot.endTime], ["09:00", "10:00"]);
});

test("needs fewer than two respondents? no recommendation", () => {
  assert.equal(recommendMeeting(poll([person("a", block("a", "Mon", "09:00", "12:00"))])), null);
  assert.equal(recommendMeeting(poll([person("a"), person("b")])), null);
});

// ---------- Dates, time zones and calendar ----------

const LA = "America/Los_Angeles";

test("same-day meetings resolve to today; past ones roll to next week", () => {
  // 2026-10-05 is a Monday. 16:00Z = 9:00 AM PDT.
  assert.equal(resolveMeetingDate("Mon", "16:00", LA, new Date("2026-10-05T16:00:00Z")), "2026-10-05");
  // 00:00Z on Oct 6 = 5:00 PM PDT Monday, after a 4 PM start.
  assert.equal(resolveMeetingDate("Mon", "16:00", LA, new Date("2026-10-06T00:00:00Z")), "2026-10-12");
  assert.equal(resolveMeetingDate("Wed", "10:00", LA, new Date("2026-10-05T16:00:00Z")), "2026-10-07");
});

test("wall time converts to UTC correctly in daylight and standard time", () => {
  assert.equal(zonedTimeToUtc("2026-10-05", "16:00", LA).toISOString(), "2026-10-05T23:00:00.000Z"); // PDT, UTC-7
  assert.equal(zonedTimeToUtc("2026-12-07", "16:00", LA).toISOString(), "2026-12-08T00:00:00.000Z"); // PST, UTC-8
});

const twoPeople = [person("p1", block("p1", "Mon", "16:00", "18:00")), person("p2", block("p2", "Mon", "16:00", "18:00")), person("p3")];
const confirmed: MeetPoll = {
  ...poll(twoPeople),
  title: "Cinema presentation",
  chosen: { day: "Mon", date: "2026-10-05", startTime: "16:00", endTime: "17:00", timeZone: LA, attendeeIds: ["p1", "p2"] },
};

test("calendar export uses the confirmed date in UTC and only lists real attendees", () => {
  const ics = buildIcs(confirmed, confirmed.chosen!, new Date("2026-10-05T16:00:00Z"));
  assert.match(ics, /DTSTART:20261005T230000Z/);
  assert.match(ics, /DTEND:20261006T000000Z/);
  assert.match(ics, /With P1\\, P2\./);
  assert.match(ics, /Can't make it: P3\./);
});

test("links round-trip the full confirmed slot", () => {
  const decoded = decodePoll(`#${encodePoll(confirmed)}`);
  assert.ok(decoded);
  assert.deepEqual(decoded.chosen, confirmed.chosen);
  assert.deepEqual(decoded.people[0].blocks.map((b) => [b.dayOfWeek, b.startTime, b.endTime]), [["Mon", "16:00", "18:00"]]);
});

test("inconsistent confirmed slots are rejected, never shown as booked", () => {
  const base = ["Mon", "2026-10-05", "16:00", "17:00", LA, "p1,p2"];
  const check = (c: unknown[]) => validateChoice(c, confirmed);
  assert.ok(check(base));
  assert.equal(check(base.slice(0, 5)), undefined); // missing field
  assert.equal(check(["Mon", "2026-10-05", "16:00", "", LA, "p1"]), undefined); // no end time
  assert.equal(check(["Mon", "2026-10-05", "16:00", "16:30", LA, "p1"]), undefined); // wrong length for 60 min
  assert.equal(check(["Mon", "2026-10-05", "17:00", "16:00", LA, "p1"]), undefined); // end before start
  assert.equal(check(["Mon", "2026-10-05", "20:30", "21:30", LA, "p1"]), undefined); // past the grid
  assert.equal(check(["Tue", "2026-10-05", "16:00", "17:00", LA, "p1"]), undefined); // date isn't a Tuesday
  assert.equal(check(["Mon", "2026-02-30", "16:00", "17:00", LA, "p1"]), undefined); // not a real date
  assert.equal(check(["Mon", "2026-10-05", "16:00", "17:00", "Mars/Olympus", "p1"]), undefined); // bad zone
  assert.equal(check(["Mon", "2026-10-05", "16:00", "17:00", LA, "ghost"]), undefined); // unknown attendee
});

test("garbage and old-format links fail safely", () => {
  assert.equal(decodePoll("#definitely-broken"), null);
  const v1 = Buffer.from(JSON.stringify({ v: 1, t: "x", d: 60, p: [] })).toString("base64url");
  assert.equal(decodePoll(`#${v1}`), null);
  const badChoice = Buffer.from(JSON.stringify({ v: 2, t: "x", d: 60, p: [["p1", "A", ""]], c: ["Mon", "2026-10-05", "16:00"] })).toString("base64url");
  const decoded = decodePoll(`#${badChoice}`);
  assert.ok(decoded && decoded.chosen === undefined);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { applyRules, blocksFromCells, cellsFromBlocks, describeBlocks } from "@/features/ai/availability-compile";
import { DEFAULT_GRID } from "@/features/ai/availability-types";
import { decodePoll, encodePoll } from "@/features/meet/meet-link";

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

test("says so when something is off the grid instead of guessing", () => {
  const { blocks, notes } = compile([{ effect: "available", days: ["Sat"], start: "09:00", end: "12:00", label: "Saturday mornings" }]);
  assert.equal(blocks.length, 0);
  assert.match(notes.join(), /Saturday isn't on this grid/);
});

test("edits apply on top of existing availability", () => {
  const existing = blocksFromCells(applyRules(new Map(), [{ effect: "available", days: ["Mon", "Thu"], start: "16:00", end: "21:00" }], grid).cells, "me", grid);
  const { cells } = applyRules(cellsFromBlocks(existing, grid), [{ effect: "unavailable", days: ["Thu"], start: "09:00", end: "21:00" }], grid);
  assert.deepEqual(blocksFromCells(cells, "me", grid).map((b) => b.dayOfWeek), ["Mon"]);
});

test("Quick Meet links round-trip and reject garbage", () => {
  const poll = {
    title: "Cinema presentation",
    durationMinutes: 60,
    people: [{ id: "p1", name: "Divij", blocks: [{ id: "x", memberId: "p1", dayOfWeek: "Mon" as const, startTime: "16:00", endTime: "18:00", isAvailable: true }] }],
    chosen: { day: "Mon" as const, startTime: "16:00", endTime: "17:00" },
  };
  const decoded = decodePoll(`#${encodePoll(poll)}`);
  assert.ok(decoded);
  assert.equal(decoded.title, "Cinema presentation");
  assert.deepEqual(decoded.people[0].blocks.map((b) => [b.dayOfWeek, b.startTime, b.endTime]), [["Mon", "16:00", "18:00"]]);
  assert.deepEqual(decoded.chosen, poll.chosen);
  assert.ok(encodePoll(poll).length < 200);
  assert.equal(decodePoll("#definitely-broken"), null);
});

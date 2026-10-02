import { test } from "node:test";
import assert from "node:assert/strict";
import type { Task } from "@/types";
import { cacheKey, createRateLimiter, createResponseCache } from "@/features/ai/request-guards";
import { validateCatchUp } from "@/features/ai/catch-up";
import { validateInterpretation } from "@/features/plan/update-service";

test("cache returns fresh entries, expires old ones and evicts least recently used", () => {
  let now = 0;
  const cache = createResponseCache<string>({ ttlMs: 1000, maxEntries: 2, now: () => now });
  cache.set("a", "A");
  cache.set("b", "B");
  assert.equal(cache.get("a"), "A"); // a is now most recent
  cache.set("c", "C"); // evicts b
  assert.equal(cache.get("b"), undefined);
  now = 1500;
  assert.equal(cache.get("a"), undefined);
  assert.equal(cacheKey(["x", 1]), cacheKey(["x", 1]));
  assert.notEqual(cacheKey(["x", 1]), cacheKey(["x", 2]));
});

test("rate limit allows a burst, then asks to wait, then refills per visitor", () => {
  let now = 0;
  const limiter = createRateLimiter({ capacity: 3, windowMs: 3000, now: () => now });
  assert.deepEqual([1, 2, 3].map(() => limiter.check("ana")), [0, 0, 0]);
  assert.equal(limiter.check("ana"), 1);
  assert.equal(limiter.check("ben"), 0); // other visitors unaffected
  now = 1000; // one token refilled
  assert.equal(limiter.check("ana"), 0);
});

const tasks: Task[] = [
  { id: "t1", projectId: "p", title: "Research", description: "", status: "in-progress", dependencies: [] },
  { id: "t2", projectId: "p", title: "Slides", description: "", status: "todo", dependencies: ["t1"] },
];
const catchUpRequest = {
  mode: "live" as const,
  meeting: { id: "m", title: "Sync", scheduledTime: "", durationMinutes: 30, attendeeIds: [], agendaItems: [] },
  asyncUpdates: [],
  tasks,
  members: [{ id: "a", name: "Ana" }],
};
const catchUp = (raw: object, extra: object = {}) =>
  validateCatchUp(
    { headline: "h", decided: [], changed: [], yourPart: [], commitments: [], openQuestions: [], missingInfo: [], ...raw },
    { ...catchUpRequest, ...extra }
  );

test("catch-up never reports decisions without notes, and says notes are missing", () => {
  assert.ok(!catchUp({ decided: ["Use Moonlight"] }).ok);
  const ok = catchUp({});
  assert.ok(ok.ok && ok.value.missingInfo.some((m) => /notes/i.test(m)));
  assert.ok(catchUp({ decided: ["Use Moonlight"] }, { notes: "We picked Moonlight." }).ok);
});

test("catch-up only writes 'your part' for a named absent student, with real ids", () => {
  assert.ok(!catchUp({ yourPart: [{ text: "Do slides" }] }).ok);
  assert.ok(!catchUp({ commitments: [{ memberId: "ghost", text: "x" }] }, { absentMemberId: "a" }).ok);
  assert.ok(catchUp({ yourPart: [{ text: "Do slides", relatedTaskId: "t2" }] }, { absentMemberId: "a" }).ok);
});

test("quick updates drop no-op changes and reject unknown steps", () => {
  const r = validateInterpretation({ summary: "s", changes: [{ taskId: "t1", status: "in-progress", because: "" }, { taskId: "t2", status: "done", because: "" }], unmatched: [] }, tasks);
  assert.ok(r.ok);
  assert.deepEqual(r.value.changes.map((c) => c.taskId), ["t2"]);
  assert.ok(!validateInterpretation({ summary: "s", changes: [{ taskId: "t9", status: "done" }], unmatched: [] }, tasks).ok);
});

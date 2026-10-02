import { test } from "node:test";
import assert from "node:assert/strict";
import type { Task } from "@/types";
import { applyPlanChanges, checkPlanChanges, findPlanProblems, needsAttention } from "@/features/plan/plan-health";

const today = "2026-10-05";
const task = (id: string, overrides: Partial<Task> = {}): Task => ({
  id,
  projectId: "p",
  title: `Step ${id}`,
  description: "",
  ownerId: "a",
  status: "todo",
  dependencies: [],
  dueDate: "2026-10-10",
  ...overrides,
});
const ctx = { memberIds: ["a", "b"], deadline: "2026-10-16", today };

test("finds late, stuck and unowned steps, most urgent first", () => {
  const problems = findPlanProblems(
    [
      task("unowned", { ownerId: undefined }),
      task("stuck", { status: "blocked" }),
      task("late", { dueDate: "2026-10-01" }),
      task("fine"),
      task("done-late", { status: "done", dueDate: "2026-10-01" }),
    ],
    today
  );
  assert.deepEqual(problems.map((p) => [p.task.id, p.kind]), [["late", "late"], ["stuck", "stuck"], ["unowned", "unowned"]]);
});

test("waiting on an unfinished earlier step is reported calmly, not as a problem", () => {
  const [p] = findPlanProblems([task("first"), task("second", { status: "blocked", dependencies: ["first"] })], today);
  assert.equal(p.kind, "waiting");
  assert.equal(needsAttention(p), false);
  assert.deepEqual(p.waitingOn.map((t) => t.id), ["first"]);
});

test("handing a stuck step to someone new starts it fresh (no banner loop)", () => {
  const [after] = applyPlanChanges([task("s", { status: "blocked" })], [{ taskId: "s", ownerId: "b", why: "" }]);
  assert.equal(after.ownerId, "b");
  assert.equal(after.status, "todo");
  const [dateOnly] = applyPlanChanges([task("s", { status: "blocked" })], [{ taskId: "s", dueDate: "2026-10-12", why: "" }]);
  assert.equal(dateOnly.status, "blocked");
});

test("rejects unsafe proposals: done steps, unknown people, out-of-range dates", () => {
  const tasks = [task("done", { status: "done" }), task("open")];
  assert.match(checkPlanChanges([{ taskId: "done", ownerId: "b", why: "" }], tasks, ctx).join(), /already done/);
  assert.match(checkPlanChanges([{ taskId: "open", ownerId: "zzz", why: "" }], tasks, ctx).join(), /unknown member/);
  assert.match(checkPlanChanges([{ taskId: "open", dueDate: "2026-10-01", why: "" }], tasks, ctx).join(), /before today/);
  assert.match(checkPlanChanges([{ taskId: "open", dueDate: "2026-12-01", why: "" }], tasks, ctx).join(), /after the project deadline/);
});

test("keeps steps in order when moving dates", () => {
  const tasks = [task("first", { dueDate: "2026-10-08" }), task("second", { dependencies: ["first"], dueDate: "2026-10-09" })];
  assert.match(checkPlanChanges([{ taskId: "first", dueDate: "2026-10-12", why: "" }], tasks, ctx).join(), /move it too/);
  assert.deepEqual(checkPlanChanges([{ taskId: "second", dueDate: "2026-10-12", why: "" }], tasks, ctx), []);
});

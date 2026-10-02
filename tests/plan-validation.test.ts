import { test } from "node:test";
import assert from "node:assert/strict";
import { findDependencyCycle, parsePlanRequest, toIsoDay, validatePlanTasks } from "@/features/plan/plan-validation";

const ctx = { projectId: "p", memberIds: ["a", "b"], deadline: "2026-10-16" };
const step = (id: string, deps: string[] = [], owner = "a", due = "2026-10-10") => ({
  id,
  title: `Step ${id}`,
  description: "Do it",
  suggestedOwnerId: owner,
  dependencies: deps,
  estimatedMinutes: 60,
  dueDate: due,
  assignmentReason: "Fits their skills.",
});
const issuesOf = (raw: unknown) => {
  const r = validatePlanTasks(raw, ctx);
  return r.ok ? [] : r.issues;
};

test("accepts a valid plan and normalizes it", () => {
  const r = validatePlanTasks([step("t1"), step("t2", ["t1"], "b", "2026-10-12")], ctx);
  assert.ok(r.ok);
  assert.equal(r.value[1].ownerId, "b");
  assert.equal(r.value[1].status, "todo");
  assert.equal(r.value[0].projectId, "p");
});

test("rejects unknown owners, duplicate ids and unknown or self dependencies", () => {
  assert.match(issuesOf([step("t1", [], "zzz")]).join(), /unknown member "zzz"/);
  assert.match(issuesOf([step("t1"), step("t1")]).join(), /duplicate id/);
  assert.match(issuesOf([step("t1", ["t9"])]).join(), /unknown task "t9"/);
  assert.match(issuesOf([step("t1", ["t1"])]).join(), /depends on itself/);
});

test("rejects dependency cycles and names them", () => {
  assert.match(issuesOf([step("t1", ["t3"]), step("t2", ["t1"]), step("t3", ["t2"])]).join(), /cycle: t1 -> t3 -> t2 -> t1/i);
  assert.equal(findDependencyCycle([{ id: "a", dependencies: [] }, { id: "b", dependencies: ["a"] }]), null);
});

test("enforces dates: real dates, within the deadline, after what they need", () => {
  assert.match(issuesOf([step("t1", [], "a", "2026-02-30")]).join(), /YYYY-MM-DD/);
  assert.match(issuesOf([step("t1", [], "a", "2026-11-01")]).join(), /after the project deadline/);
  assert.match(issuesOf([step("t1", [], "a", "2026-10-12"), step("t2", ["t1"], "a", "2026-10-05")]).join(), /due before its dependency/);
});

test("enforces sensible effort and valid statuses", () => {
  assert.match(issuesOf([{ ...step("t1"), estimatedMinutes: 5 }]).join(), /between 15 and 2400/);
  assert.match(issuesOf([{ ...step("t1"), status: "finished" }]).join(), /invalid status/);
});

test("reads human and ISO deadlines without shifting the day", () => {
  assert.equal(toIsoDay("October 16, 2026"), "2026-10-16");
  assert.equal(toIsoDay("2026-10-16"), "2026-10-16");
  assert.equal(toIsoDay("not a date"), undefined);
});

test("checks assignment uploads: type and size", () => {
  const project = { id: "p", name: "n", description: "d", deadline: "October 16, 2026", members: [{ id: "a", name: "A" }] };
  const bad = parsePlanRequest({ project, assignment: { file: { name: "x.exe", mimeType: "application/x-msdownload", data: "AAAA" } } });
  assert.ok(!bad.ok && bad.issues.join().includes("PDF or a text file"));
  const huge = parsePlanRequest({ project, assignment: { file: { name: "a.pdf", mimeType: "application/pdf", data: "A".repeat(6_000_000) } } });
  assert.ok(!huge.ok && huge.issues.join().includes("larger than 4 MB"));
  const ok = parsePlanRequest({ project, assignment: { text: "  12-minute presentation  " } });
  assert.ok(ok.ok && ok.value.assignment?.text === "12-minute presentation");
});

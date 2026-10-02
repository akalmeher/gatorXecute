import { test } from "node:test";
import assert from "node:assert/strict";
import type { Task } from "@/types";
import { discreetNote, guessedPronouns, mentionsCrisis, mentionsPersonal, personalDetailsIn } from "@/features/ai/care";
import { finalizeShareCheck } from "@/features/ai/share-check";
import { checkAbsence, checkPlanChanges } from "@/features/plan/plan-health";

const MESSAGE =
  "i cant work from thurs to fri this week cause im visiting my sick mom she has cancer and is on her death bed im really sad";
const request = { mode: "live" as const, text: MESSAGE, authorName: "Divij Anand" };
const today = "2026-10-01"; // a Thursday

test("personal and crisis language is recognized deterministically", () => {
  assert.ok(mentionsPersonal(MESSAGE));
  assert.ok(!mentionsCrisis(MESSAGE));
  assert.ok(mentionsCrisis("honestly i don't want to be here anymore"));
  assert.ok(mentionsPersonal("i don't want to be here anymore")); // crisis is always personal
  assert.ok(!mentionsPersonal("finished the research, waiting on Maya's sources"));
  assert.deepEqual(personalDetailsIn("Divij is away Thursday–Friday."), []);
  assert.ok(personalDetailsIn("Divij is with his sick mom").includes("sick"));
});

test("the discreet note gives the effect on the work, never the reason", () => {
  assert.equal(discreetNote("Divij Anand", "2026-10-01", "2026-10-02"), "Divij is away Thursday–Friday for a personal matter.");
  assert.equal(discreetNote("Divij"), "Divij needs some time away for a personal matter.");
});

test("a shareable version that leaks personal details is replaced by the discreet note", () => {
  const check = finalizeShareCheck(
    { personal: true, shareable: "Divij's mom has cancer, so he's away.", awayFrom: "2026-10-01", awayTo: "2026-10-02", wellbeing: "none", acknowledgement: "I'm so sorry." },
    request,
    today
  );
  assert.equal(check.shareable, "Divij is away Thursday–Friday for a personal matter.");
  assert.equal(check.wellbeing, "low"); // personal is never "none"
  assert.equal(check.acknowledgement, "I'm so sorry.");
});

test("code marks the message personal even if the model doesn't", () => {
  const check = finalizeShareCheck({ personal: false, shareable: MESSAGE, wellbeing: "none", acknowledgement: "" }, request, today);
  assert.ok(check.personal);
  assert.doesNotMatch(check.shareable, /mom|cancer|sad/);
  assert.ok(check.acknowledgement.length > 0);
});

test("crisis language always forces crisis support and the neutral note", () => {
  const check = finalizeShareCheck(
    { personal: true, shareable: "Divij needs a few days off.", wellbeing: "low", acknowledgement: "That sounds hard." },
    { ...request, text: "i want to die, i can't do this project" },
    today
  );
  assert.equal(check.wellbeing, "crisis");
  assert.equal(check.shareable, "Divij needs some time away for a personal matter.");
});

test("away dates: an ongoing range starts today; past or far-off ranges are dropped", () => {
  const draft = { personal: true, shareable: "Divij is away.", wellbeing: "low" as const, acknowledgement: "" };
  const ongoing = finalizeShareCheck({ ...draft, awayFrom: "2026-10-01", awayTo: "2026-10-02" }, request, "2026-10-02");
  assert.deepEqual([ongoing.awayFrom, ongoing.awayTo], ["2026-10-02", "2026-10-02"]);
  const past = finalizeShareCheck({ ...draft, awayFrom: "2026-09-20", awayTo: "2026-09-21" }, request, today);
  assert.equal(past.awayFrom, undefined);
  const far = finalizeShareCheck({ ...draft, awayFrom: "2027-03-01", awayTo: "2027-03-02" }, request, today);
  assert.equal(far.awayFrom, undefined);
  const backwards = finalizeShareCheck({ ...draft, awayFrom: "2026-10-05", awayTo: "2026-10-03" }, request, today);
  assert.equal(backwards.awayFrom, undefined);
});

test("non-personal messages are shared as written", () => {
  const text = "finished the research, waiting on Maya's sources";
  const check = finalizeShareCheck({ personal: false, shareable: "x", wellbeing: "none", acknowledgement: "ok" }, { ...request, text }, today);
  assert.deepEqual([check.personal, check.shareable, check.acknowledgement, check.wellbeing], [false, text, "", "none"]);
});

test("guessed pronouns are flagged, the student's own words are not", () => {
  const input = 'Student wrote: """my mom said she is proud"""';
  assert.deepEqual(guessedPronouns({ summary: "Divij said he finished." }, input), ["Divij said he finished."]);
  assert.deepEqual(guessedPronouns({ quote: "my mom said she is proud" }, input), []);
  assert.deepEqual(guessedPronouns({ summary: "Divij finished; they will start testing.", items: ["Their draft is done."] }, input), []);
  assert.deepEqual(guessedPronouns({ list: [{ text: "Ask her for sources." }] }, input), ["Ask her for sources."]);
});

const task = (id: string, overrides: Partial<Task> = {}): Task => ({
  id,
  projectId: "p",
  title: `Step ${id}`,
  description: "",
  ownerId: "away",
  status: "todo",
  dependencies: [],
  dueDate: "2026-10-02",
  ...overrides,
});
const away = { memberId: "away", from: "2026-10-01", to: "2026-10-02" };

test("someone who is away never gets new work or earlier deadlines", () => {
  const tasks = [task("theirs"), task("other", { ownerId: "b", dueDate: "2026-10-09" }), task("later", { dueDate: "2026-10-09" })];
  assert.ok(checkAbsence([{ taskId: "other", ownerId: "away", why: "" }], tasks, away).length > 0);
  assert.ok(checkAbsence([{ taskId: "later", dueDate: "2026-10-06", why: "" }], tasks, away).length > 0);
});

test("anything of theirs due while they're away must be handed off or moved after", () => {
  const tasks = [task("theirs")];
  assert.ok(checkAbsence([], tasks, away).length > 0);
  assert.deepEqual(checkAbsence([{ taskId: "theirs", ownerId: "b", why: "" }], tasks, away), []);
  assert.deepEqual(checkAbsence([{ taskId: "theirs", dueDate: "2026-10-05", why: "" }], tasks, away), []);
  assert.deepEqual(checkAbsence([], [task("done", { status: "done" })], away), []);
  const ctx = { memberIds: ["away", "b"], deadline: "2026-10-16", today, away };
  assert.ok(checkPlanChanges([], tasks, ctx).length > 0);
  assert.deepEqual(checkPlanChanges([{ taskId: "theirs", ownerId: "b", why: "Sara is free." }], tasks, ctx), []);
});

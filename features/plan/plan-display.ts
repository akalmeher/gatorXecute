import type { Member, Task } from "@/types";

/**
 * Feature Owner: Divij Anand
 * Deterministic helpers that turn plan data into plain language for students.
 * No AI here: ordering, dates and status wording are simple rules.
 */

export type StepState = "done" | "doing" | "waiting" | "ready" | "later";

export interface PlanStep {
  task: Task;
  owner?: Member;
  state: StepState;
  /** Titles of unfinished steps that need to happen first. */
  waitingOn: string[];
}

export const STEP_STATE_LABEL: Record<StepState, string> = {
  done: "Done",
  doing: "In progress",
  waiting: "Waiting",
  ready: "Ready to start",
  later: "Coming up",
};

/** Orders steps so each comes after the steps it needs, then by due date. */
export function orderSteps(tasks: Task[], members: Member[]): PlanStep[] {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const memberById = new Map(members.map((member) => [member.id, member]));
  const byDue = (a: Task, b: Task) =>
    (a.dueDate ?? "9999-99-99").localeCompare(b.dueDate ?? "9999-99-99") || a.title.localeCompare(b.title);

  const ordered: Task[] = [];
  const placed = new Set<string>();
  const remaining = [...tasks].sort(byDue);
  while (remaining.length > 0) {
    // Pick the earliest-due step whose prerequisites are placed; fall back to
    // the earliest-due step if a cycle slipped through.
    const index = Math.max(
      0,
      remaining.findIndex((task) => task.dependencies.every((id) => placed.has(id) || !byId.has(id)))
    );
    const [next] = remaining.splice(index, 1);
    ordered.push(next);
    placed.add(next.id);
  }

  return ordered.map((task) => {
    const waitingOn = task.dependencies
      .map((id) => byId.get(id))
      .filter((dep): dep is Task => Boolean(dep) && dep!.status !== "done")
      .map((dep) => dep.title);
    let state: StepState;
    if (task.status === "done") state = "done";
    else if (task.status === "in-progress") state = "doing";
    else if (task.status === "blocked") state = "waiting";
    else state = waitingOn.length > 0 ? "later" : "ready";
    return { task, owner: task.ownerId ? memberById.get(task.ownerId) : undefined, state, waitingOn };
  });
}

/** "2026-10-09" -> "Fri, Oct 9". Built from parts so time zones can't shift the day. */
export function formatDay(isoDay?: string): string | undefined {
  if (!isoDay || !/^\d{4}-\d{2}-\d{2}$/.test(isoDay)) return isoDay;
  const [y, m, d] = isoDay.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/** 90 -> "about 1.5 hours", 30 -> "about 30 minutes". */
export function formatEffort(minutes?: number): string | undefined {
  if (!minutes) return undefined;
  if (minutes < 60) return `about ${minutes} minutes`;
  const hours = Math.round((minutes / 60) * 2) / 2;
  return `about ${hours} ${hours === 1 ? "hour" : "hours"}`;
}

/** ["A"] -> "A is", ["A","B"] -> "A and B are", ["A","B","C"] -> "A and 2 other steps are". */
export function describeWaitingOn(titles: string[]): { text: string; verb: "is" | "are" } {
  if (titles.length === 1) return { text: titles[0], verb: "is" };
  if (titles.length === 2) return { text: `${titles[0]} and ${titles[1]}`, verb: "are" };
  return { text: `${titles[0]} and ${titles.length - 1} other steps`, verb: "are" };
}

export function firstName(member?: Pick<Member, "name">): string | undefined {
  return member?.name.split(" ")[0];
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** One-line answer for a draft, e.g. "8 steps, finishing Wed, Oct 14. Everyone has a part." */
export function describeDraft(tasks: Task[], members: Member[]): string {
  const lastDue = tasks.map((t) => t.dueDate).filter(Boolean).sort().at(-1);
  const owners = new Set(tasks.map((t) => t.ownerId).filter(Boolean));
  const left = members.filter((m) => !owners.has(m.id)).map((m) => firstName(m) ?? m.name);
  const parts = [`${tasks.length} ${tasks.length === 1 ? "step" : "steps"}${lastDue ? `, finishing ${formatDay(lastDue)}` : ""}.`];
  parts.push(left.length === 0 ? "Everyone has a part." : `${joinNames(left)} ${left.length === 1 ? "doesn't" : "don't"} have a part yet.`);
  return parts.join(" ");
}

export interface PlanStatus {
  headline: string;
  next?: PlanStep;
  waiting?: PlanStep;
}

/** Answer-first status for an accepted plan. Describes the work, never the people. */
export function describePlanStatus(steps: PlanStep[]): PlanStatus {
  if (steps.length === 0) return { headline: "No plan yet." };
  const done = steps.filter((s) => s.state === "done").length;
  if (done === steps.length) return { headline: "Everything is done." };

  const next = steps.find((s) => s.state === "doing") ?? steps.find((s) => s.state === "ready");
  const waiting = steps.find((s) => s.state === "waiting");
  const headline = done === 0 ? `${steps.length} steps to go.` : `${done} of ${steps.length} steps done.`;
  return { headline, next, waiting };
}

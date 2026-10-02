import type { Task } from "@/types";
import type { PlanChange } from "./replan-types";
import { isIsoDay } from "./plan-validation";

/**
 * Feature Owner: Divij Anand
 * Deterministic plan health: noticing late or stuck work, and applying and
 * checking proposed changes. No AI here; Gemini only proposes the changes.
 */

export const MAX_PLAN_CHANGES = 5;

export type PlanProblemKind = "late" | "stuck" | "unowned" | "waiting";

export interface PlanProblem {
  task: Task;
  kind: PlanProblemKind;
  /** Unfinished steps that can't start until this one moves. */
  holdsUp: Task[];
  /** Unfinished earlier steps this one needs first. */
  waitingOn: Task[];
}

/** Late, stuck and unowned need attention; "waiting" is on schedule but reported by a student. */
export function needsAttention(problem: PlanProblem): boolean {
  return problem.kind !== "waiting";
}

const KIND_ORDER: Record<PlanProblemKind, number> = { late: 0, stuck: 1, unowned: 2, waiting: 3 };

/**
 * Late = past due and not done. Stuck = marked waiting with nothing left to
 * wait for (waiting on unfinished earlier steps is normal, not a problem).
 * Unowned = nobody has it yet. Waiting = marked waiting on an unfinished earlier
 * step: on schedule, but surfaced so a student's "I'm stuck" never goes unanswered.
 * Most urgent first.
 */
export function findPlanProblems(tasks: Task[], today: string): PlanProblem[] {
  const open = tasks.filter((t) => t.status !== "done");
  const problems: PlanProblem[] = [];
  for (const task of open) {
    const waitingOn = open.filter((t) => task.dependencies.includes(t.id));
    const waitingOnOthers = waitingOn.length > 0;
    const kind: PlanProblemKind | undefined =
      task.dueDate && task.dueDate < today
        ? "late"
        : task.status === "blocked" && !waitingOnOthers
          ? "stuck"
          : !task.ownerId
            ? "unowned"
            : task.status === "blocked"
              ? "waiting"
              : undefined;
    if (!kind) continue;
    problems.push({ task, kind, holdsUp: open.filter((t) => t.dependencies.includes(task.id)), waitingOn });
  }
  return problems.sort(
    (a, b) =>
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      b.holdsUp.length - a.holdsUp.length ||
      (a.task.dueDate ?? "").localeCompare(b.task.dueDate ?? "")
  );
}

export const PROBLEM_PHRASE: Record<PlanProblemKind, string> = {
  late: "is behind schedule",
  stuck: "is stuck",
  unowned: "needs an owner",
  waiting: "is waiting on an earlier step",
};

export function applyPlanChanges(tasks: Task[], changes: PlanChange[]): Task[] {
  const byId = new Map(changes.map((change) => [change.taskId, change]));
  return tasks.map((task) => {
    const change = byId.get(task.id);
    if (!change) return task;
    // Someone new taking over a waiting step starts it fresh; otherwise the
    // same "stuck" banner would come straight back after accepting the fix.
    const handedOver = change.ownerId && change.ownerId !== task.ownerId && task.status === "blocked";
    return {
      ...task,
      ...(change.ownerId ? { ownerId: change.ownerId } : {}),
      ...(change.dueDate ? { dueDate: change.dueDate } : {}),
      ...(handedOver ? { status: "todo" as const } : {}),
    };
  });
}

/**
 * Checks a proposal against the current plan. Only the changed steps and their
 * neighbors are checked, so older hand-made steps don't block a good fix.
 */
/** Someone who can't work for a while (inclusive YYYY-MM-DD dates). */
export interface Absence {
  memberId: string;
  from: string;
  to: string;
}

export function checkPlanChanges(
  changes: PlanChange[],
  tasks: Task[],
  context: { memberIds: string[]; deadline?: string; today: string; away?: Absence }
): string[] {
  const issues: string[] = [];
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const memberIds = new Set(context.memberIds);
  const seen = new Set<string>();

  if (changes.length > MAX_PLAN_CHANGES) issues.push(`Propose at most ${MAX_PLAN_CHANGES} changes.`);

  for (const change of changes) {
    const task = byId.get(change.taskId);
    const label = task ? `"${task.title}"` : `Step "${change.taskId}"`;
    if (!task) {
      issues.push(`${label} does not exist.`);
      continue;
    }
    if (seen.has(change.taskId)) issues.push(`${label} is changed more than once.`);
    seen.add(change.taskId);
    if (task.status === "done") issues.push(`${label} is already done and should not change.`);
    if (!change.ownerId && !change.dueDate) issues.push(`${label} needs a new owner or a new due date.`);
    if (change.ownerId && !memberIds.has(change.ownerId)) issues.push(`${label} names unknown member "${change.ownerId}".`);
    if (change.ownerId && change.ownerId === task.ownerId && !change.dueDate) {
      issues.push(`${label} already belongs to that person.`);
    }
    if (change.dueDate) {
      if (!isIsoDay(change.dueDate)) issues.push(`${label} needs a due date in YYYY-MM-DD format.`);
      else if (change.dueDate < context.today) issues.push(`${label} can't be due before today (${context.today}).`);
      else if (context.deadline && change.dueDate > context.deadline) {
        issues.push(`${label} would be due after the project deadline (${context.deadline}).`);
      }
    }
  }
  if (issues.length > 0) return issues;

  // Order: a changed step can't be due before what it needs, or after what needs it.
  const updated = new Map(applyPlanChanges(tasks, changes).map((task) => [task.id, task]));
  for (const change of changes) {
    if (!change.dueDate) continue;
    const task = updated.get(change.taskId)!;
    for (const depId of task.dependencies) {
      const dep = updated.get(depId);
      if (dep && dep.status !== "done" && dep.dueDate && dep.dueDate > change.dueDate) {
        issues.push(`"${task.title}" would be due before "${dep.title}", which needs to happen first.`);
      }
    }
    for (const next of updated.values()) {
      if (next.status !== "done" && next.dependencies.includes(task.id) && next.dueDate && next.dueDate < change.dueDate) {
        issues.push(`"${next.title}" is due before "${task.title}" would be finished; move it too.`);
      }
    }
  }
  if (context.away) issues.push(...checkAbsence(changes, tasks, context.away));
  return issues;
}

/**
 * Someone away gets no new work, no earlier deadlines, and nothing of theirs
 * left due while they're gone (it's handed off or moved after they return).
 */
export function checkAbsence(changes: PlanChange[], tasks: Task[], away: Absence): string[] {
  const issues: string[] = [];
  const before = new Map(tasks.map((t) => [t.id, t]));
  for (const change of changes) {
    const task = before.get(change.taskId);
    if (!task) continue;
    if (change.ownerId === away.memberId && task.ownerId !== away.memberId) {
      issues.push(`They're away ${away.from}–${away.to}; don't give them "${task.title}".`);
    }
    const ownerAfter = change.ownerId ?? task.ownerId;
    if (ownerAfter === away.memberId && change.dueDate && task.dueDate && change.dueDate < task.dueDate) {
      issues.push(`Don't move "${task.title}" earlier for someone who is away; hand it off or give it more time.`);
    }
  }
  for (const task of applyPlanChanges(tasks, changes)) {
    if (task.status === "done" || task.ownerId !== away.memberId || !task.dueDate) continue;
    if (task.dueDate >= away.from && task.dueDate <= away.to) {
      issues.push(`"${task.title}" is due ${task.dueDate}, while its owner is away (${away.from}–${away.to}); hand it to someone else or move it after they're back.`);
    }
  }
  return issues;
}

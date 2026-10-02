import type { Task, TaskStatus } from "@/types";
import type { PlanAssignment, PlanMember, PlanMode, PlanRequest } from "./plan-types";
import { ASSIGNMENT_FILE_TYPES, MAX_ASSIGNMENT_FILE_BYTES, MAX_ASSIGNMENT_TEXT_CHARS } from "./plan-types";

/**
 * Feature Owner: Divij Anand
 * Pure runtime checks for plan input and AI output. No AI here: these rules are
 * deterministic and also safe to reuse on the client when a user edits a plan.
 */

const TASK_STATUSES: TaskStatus[] = ["todo", "in-progress", "blocked", "done"];
const MIN_TASK_MINUTES = 15;
const MAX_TASK_MINUTES = 40 * 60;
const MAX_TASKS = 15;

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; issues: string[] };

export interface PlanValidationContext {
  projectId: string;
  memberIds: string[];
  /** Project deadline as YYYY-MM-DD; due dates may not fall after it. */
  deadline?: string;
}

// ---------- Dates ----------

/** Today as YYYY-MM-DD in the server's local time zone. */
export function todayIsoDay(now = new Date()): string {
  return formatIsoDay(now);
}

function formatIsoDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isIsoDay(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Accepts "2026-10-16" or human strings like "October 16, 2026". */
export function toIsoDay(value: string): string | undefined {
  if (isIsoDay(value)) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : formatIsoDay(parsed);
}

export function addDays(isoDay: string, days: number): string {
  const [y, m, d] = isoDay.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

// ---------- Request ----------

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseAssignment(value: unknown, issues: string[]): PlanAssignment | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object") {
    issues.push("assignment must be an object.");
    return undefined;
  }
  const a = value as Record<string, unknown>;
  const assignment: PlanAssignment = {};
  if (a.text !== undefined) {
    if (typeof a.text !== "string") issues.push("assignment.text must be a string.");
    else if (a.text.length > MAX_ASSIGNMENT_TEXT_CHARS) issues.push("The pasted assignment is too long. Try uploading it as a file.");
    else if (a.text.trim()) assignment.text = a.text.trim();
  }
  if (a.file !== undefined && a.file !== null) {
    const file = a.file as Record<string, unknown>;
    if (!nonEmptyString(file.mimeType) || !ASSIGNMENT_FILE_TYPES.includes(file.mimeType)) {
      issues.push("The assignment file must be a PDF or a text file.");
    } else if (!nonEmptyString(file.data) || !/^[A-Za-z0-9+/]+=*$/.test(file.data)) {
      issues.push("The assignment file could not be read.");
    } else if (Math.floor((file.data.length * 3) / 4) > MAX_ASSIGNMENT_FILE_BYTES) {
      issues.push("The assignment file is larger than 4 MB.");
    } else {
      assignment.file = {
        name: typeof file.name === "string" ? file.name.slice(0, 200) : "assignment",
        mimeType: file.mimeType,
        data: file.data,
      };
    }
  }
  return assignment.text || assignment.file ? assignment : undefined;
}

export function parsePlanRequest(
  body: unknown
): ValidationResult<Required<Omit<PlanRequest, "assignment">> & Pick<PlanRequest, "assignment">> {
  const issues: string[] = [];
  if (typeof body !== "object" || body === null) {
    return { ok: false, issues: ["Request body must be a JSON object."] };
  }

  const { project, mode, assignment: rawAssignment } = body as Record<string, unknown>;
  const assignment = parseAssignment(rawAssignment, issues);
  const parsedMode: PlanMode = mode === "demo" ? "demo" : "live";
  if (mode !== undefined && mode !== "live" && mode !== "demo") {
    issues.push('mode must be "live" or "demo".');
  }

  if (typeof project !== "object" || project === null) {
    return { ok: false, issues: [...issues, "project is required."] };
  }

  const p = project as Record<string, unknown>;
  for (const field of ["id", "name", "description", "deadline"] as const) {
    if (!nonEmptyString(p[field])) issues.push(`project.${field} is required.`);
  }
  if (p.course !== undefined && typeof p.course !== "string") {
    issues.push("project.course must be a string.");
  }

  const members: PlanMember[] = [];
  if (!Array.isArray(p.members) || p.members.length === 0) {
    issues.push("project.members must include at least one member.");
  } else {
    p.members.forEach((raw, index) => {
      const m = (raw ?? {}) as Record<string, unknown>;
      if (!nonEmptyString(m.id) || !nonEmptyString(m.name)) {
        issues.push(`project.members[${index}] needs an id and name.`);
        return;
      }
      members.push({
        id: m.id,
        name: m.name,
        role: typeof m.role === "string" ? m.role : undefined,
        skills: isStringArray(m.skills) ? m.skills : [],
        wantsToLearn: isStringArray(m.wantsToLearn) ? m.wantsToLearn : [],
      });
    });
    if (new Set(members.map((m) => m.id)).size !== members.length) {
      issues.push("project.members contains duplicate ids.");
    }
  }

  if (issues.length > 0) return { ok: false, issues };

  return {
    ok: true,
    value: {
      mode: parsedMode,
      assignment,
      project: {
        id: p.id as string,
        name: p.name as string,
        course: (p.course as string | undefined) ?? "",
        description: p.description as string,
        deadline: p.deadline as string,
        members,
      },
    },
  };
}

// ---------- Plan tasks ----------

/**
 * Validates a list of tasks from Gemini (or from a user's edited plan) and
 * normalizes it into canonical Task objects. Rejects the whole plan on any
 * issue so a half-valid plan never reaches shared state.
 */
export function validatePlanTasks(
  rawTasks: unknown,
  context: PlanValidationContext
): ValidationResult<Task[]> {
  if (!Array.isArray(rawTasks) || rawTasks.length === 0) {
    return { ok: false, issues: ["Plan must contain at least one task."] };
  }
  if (rawTasks.length > MAX_TASKS) {
    return { ok: false, issues: [`Plan has ${rawTasks.length} tasks; the limit is ${MAX_TASKS}.`] };
  }

  const issues: string[] = [];
  const memberIds = new Set(context.memberIds);
  const tasks: Task[] = [];
  const seenIds = new Set<string>();

  rawTasks.forEach((raw, index) => {
    const t = (raw ?? {}) as Record<string, unknown>;
    const label = nonEmptyString(t.id) ? `Task "${t.id}"` : `Task #${index + 1}`;

    if (!nonEmptyString(t.id)) {
      issues.push(`${label} is missing an id.`);
      return;
    }
    if (seenIds.has(t.id)) issues.push(`${label} has a duplicate id.`);
    seenIds.add(t.id);

    if (!nonEmptyString(t.title)) issues.push(`${label} is missing a title.`);
    if (!nonEmptyString(t.description)) issues.push(`${label} is missing a description.`);

    const suggestedOwnerId = nonEmptyString(t.suggestedOwnerId) ? t.suggestedOwnerId : undefined;
    const ownerId = nonEmptyString(t.ownerId) ? t.ownerId : suggestedOwnerId;
    if (suggestedOwnerId && !memberIds.has(suggestedOwnerId)) {
      issues.push(`${label} suggests unknown member "${suggestedOwnerId}".`);
    }
    if (ownerId && ownerId !== suggestedOwnerId && !memberIds.has(ownerId)) {
      issues.push(`${label} is assigned to unknown member "${ownerId}".`);
    }

    const status = t.status ?? "todo";
    if (!TASK_STATUSES.includes(status as TaskStatus)) {
      issues.push(`${label} has invalid status "${String(status)}".`);
    }

    if (t.dependencies !== undefined && !isStringArray(t.dependencies)) {
      issues.push(`${label} dependencies must be a list of task ids.`);
    }
    const dependencies = isStringArray(t.dependencies) ? [...new Set(t.dependencies)] : [];

    const minutes = t.estimatedMinutes;
    if (
      typeof minutes !== "number" ||
      !Number.isInteger(minutes) ||
      minutes < MIN_TASK_MINUTES ||
      minutes > MAX_TASK_MINUTES
    ) {
      issues.push(
        `${label} needs a whole-number estimate between ${MIN_TASK_MINUTES} and ${MAX_TASK_MINUTES} minutes.`
      );
    }

    if (!isIsoDay(t.dueDate)) {
      issues.push(`${label} needs a due date in YYYY-MM-DD format.`);
    } else if (context.deadline && t.dueDate > context.deadline) {
      issues.push(`${label} is due ${t.dueDate}, after the project deadline ${context.deadline}.`);
    }

    tasks.push({
      id: t.id,
      projectId: context.projectId,
      title: nonEmptyString(t.title) ? t.title.trim() : "",
      description: nonEmptyString(t.description) ? t.description.trim() : "",
      ownerId,
      suggestedOwnerId,
      status: status as TaskStatus,
      dependencies,
      estimatedMinutes: typeof minutes === "number" ? minutes : undefined,
      dueDate: typeof t.dueDate === "string" ? t.dueDate : undefined,
      assignmentReason: nonEmptyString(t.assignmentReason) ? t.assignmentReason.trim() : undefined,
    });
  });

  // Dependency references and ordering.
  const byId = new Map(tasks.map((task) => [task.id, task]));
  for (const task of tasks) {
    for (const depId of task.dependencies) {
      const dep = byId.get(depId);
      if (depId === task.id) {
        issues.push(`Task "${task.id}" depends on itself.`);
      } else if (!dep) {
        issues.push(`Task "${task.id}" depends on unknown task "${depId}".`);
      } else if (dep.dueDate && task.dueDate && dep.dueDate > task.dueDate) {
        issues.push(`Task "${task.id}" is due before its dependency "${depId}".`);
      }
    }
  }

  const cycle = findDependencyCycle(tasks);
  if (cycle) issues.push(`Dependency cycle: ${cycle.join(" -> ")}.`);

  return issues.length > 0 ? { ok: false, issues } : { ok: true, value: tasks };
}

/** Returns one cycle as a list of task ids (first id repeated at the end), or null. */
export function findDependencyCycle(tasks: Pick<Task, "id" | "dependencies">[]): string[] | null {
  const deps = new Map(tasks.map((task) => [task.id, task.dependencies]));
  const state = new Map<string, "visiting" | "done">();
  const path: string[] = [];

  const visit = (id: string): string[] | null => {
    if (state.get(id) === "done") return null;
    if (state.get(id) === "visiting") return [...path.slice(path.indexOf(id)), id];
    state.set(id, "visiting");
    path.push(id);
    for (const depId of deps.get(id) ?? []) {
      if (!deps.has(depId) || depId === id) continue; // reported separately
      const cycle = visit(depId);
      if (cycle) return cycle;
    }
    path.pop();
    state.set(id, "done");
    return null;
  };

  for (const task of tasks) {
    const cycle = visit(task.id);
    if (cycle) return cycle;
  }
  return null;
}

import type { AsyncUpdate, Member, Task, TaskStatus } from "@/types";

/**
 * Feature Owner: Divij Anand
 * Lenient runtime parsing of shared types sent to AI routes. Unknown fields are
 * dropped; missing required fields are reported as issues.
 */

export type ParseResult<T> = { ok: true; value: T } | { ok: false; issues: string[] };

export type AiMember = Pick<Member, "id" | "name" | "role">;

const TASK_STATUSES: TaskStatus[] = ["todo", "in-progress", "blocked", "done"];
const UPDATE_TYPES: AsyncUpdate["type"][] = ["cant_attend", "blocker", "progress"];

export function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

export function parseMembers(value: unknown, issues: string[]): AiMember[] {
  if (!Array.isArray(value) || value.length === 0) {
    issues.push("members must include at least one member.");
    return [];
  }
  return value.flatMap((raw, index) => {
    const m = asRecord(raw);
    if (!nonEmptyString(m.id) || !nonEmptyString(m.name)) {
      issues.push(`members[${index}] needs an id and name.`);
      return [];
    }
    return [{ id: m.id, name: m.name, role: typeof m.role === "string" ? m.role : undefined }];
  });
}

export function parseTasks(value: unknown, issues: string[]): Task[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    issues.push("tasks must be a list.");
    return [];
  }
  return value.flatMap((raw, index) => {
    const t = asRecord(raw);
    if (!nonEmptyString(t.id) || !nonEmptyString(t.title)) {
      issues.push(`tasks[${index}] needs an id and title.`);
      return [];
    }
    return [
      {
        id: t.id,
        projectId: typeof t.projectId === "string" ? t.projectId : "",
        title: t.title,
        description: typeof t.description === "string" ? t.description : "",
        ownerId: nonEmptyString(t.ownerId) ? t.ownerId : undefined,
        status: TASK_STATUSES.includes(t.status as TaskStatus) ? (t.status as TaskStatus) : "todo",
        dependencies: isStringArray(t.dependencies) ? t.dependencies : [],
        dueDate: typeof t.dueDate === "string" ? t.dueDate : undefined,
      },
    ];
  });
}

export function parseAsyncUpdates(value: unknown, issues: string[]): AsyncUpdate[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    issues.push("asyncUpdates must be a list.");
    return [];
  }
  return value.flatMap((raw, index) => {
    const u = asRecord(raw);
    if (!nonEmptyString(u.memberId) || !nonEmptyString(u.content)) {
      issues.push(`asyncUpdates[${index}] needs a memberId and content.`);
      return [];
    }
    return [
      {
        id: typeof u.id === "string" ? u.id : `upd-${index}`,
        projectId: typeof u.projectId === "string" ? u.projectId : "",
        memberId: u.memberId,
        meetingId: typeof u.meetingId === "string" ? u.meetingId : undefined,
        type: UPDATE_TYPES.includes(u.type as AsyncUpdate["type"]) ? (u.type as AsyncUpdate["type"]) : "progress",
        content: u.content,
        createdAt: typeof u.createdAt === "string" ? u.createdAt : "",
      },
    ];
  });
}

export function parseMode(value: unknown, issues: string[]): "live" | "demo" {
  if (value !== undefined && value !== "live" && value !== "demo") {
    issues.push('mode must be "live" or "demo".');
  }
  return value === "demo" ? "demo" : "live";
}

/** Compact, prompt-friendly view of tasks with owner names resolved. */
export function describeTasks(tasks: Task[], members: AiMember[]) {
  const nameById = new Map(members.map((m) => [m.id, m.name]));
  return tasks.map((task) => ({
    id: task.id,
    title: task.title,
    status: task.status,
    owner: task.ownerId ? (nameById.get(task.ownerId) ?? task.ownerId) : "unassigned",
    dueDate: task.dueDate,
    dependencies: task.dependencies,
  }));
}

export function describeUpdates(updates: AsyncUpdate[], members: AiMember[]) {
  const nameById = new Map(members.map((m) => [m.id, m.name]));
  return updates.map((update) => ({
    from: nameById.get(update.memberId) ?? update.memberId,
    type: update.type,
    content: update.content,
  }));
}

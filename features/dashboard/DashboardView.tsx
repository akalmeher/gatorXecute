"use client";

import React from "react";
import Link from "next/link";
import { useProject } from "@/context/ProjectContext";
import { TaskStatus } from "@/types";

const COLUMNS: { id: TaskStatus; label: string; accent: string }[] = [
  { id: "todo", label: "To Do", accent: "border-zinc-300 text-zinc-700 bg-zinc-50" },
  { id: "in-progress", label: "In Progress", accent: "border-blue-400 text-blue-700 bg-blue-50/50" },
  { id: "blocked", label: "Blocked", accent: "border-rose-400 text-rose-700 bg-rose-50/50" },
  { id: "done", label: "Done", accent: "border-emerald-400 text-emerald-700 bg-emerald-50/50" },
];

export function DashboardView() {
  const { project, updateTaskStatus, getMemberById } = useProject();

  const getTaskCount = (status: TaskStatus) =>
    project.tasks.filter((t) => t.status === status).length;

  return (
    <div className="space-y-8">
      {/* Dashboard Header */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-100 pb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
              Team Progress Dashboard
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Real-time task tracking, member ownership, and dependency blockers.
            </p>
          </div>

          <Link
            href="/meeting"
            className="inline-flex items-center justify-center rounded-lg bg-[var(--gator-purple)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
          >
            Find Meeting Time & Catch-Up →
          </Link>
        </div>

        {/* Quick Metrics */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {COLUMNS.map((col) => (
            <div
              key={col.id}
              className={`rounded-lg border p-3 flex flex-col justify-between ${col.accent}`}
            >
              <span className="text-xs font-semibold">{col.label}</span>
              <span className="text-2xl font-bold mt-1">
                {getTaskCount(col.id)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Kanban Board Columns */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-zinc-900">
            Sprint Board
          </h2>
          <span className="text-xs text-zinc-500">
            Click status pill on any card to update live state
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {COLUMNS.map((col) => {
            const columnTasks = project.tasks.filter((t) => t.status === col.id);

            return (
              <div
                key={col.id}
                className="flex flex-col rounded-xl border border-zinc-200 bg-zinc-50/60 p-3 min-h-[420px]"
              >
                {/* Column Title */}
                <div className="flex items-center justify-between px-2 py-2 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-700">
                    {col.label}
                  </span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-zinc-600 border border-zinc-200">
                    {columnTasks.length}
                  </span>
                </div>

                {/* Tasks List */}
                <div className="flex flex-col gap-3 flex-1">
                  {columnTasks.length === 0 ? (
                    <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-zinc-200 p-4 text-center text-xs text-zinc-400">
                      No tasks in this lane
                    </div>
                  ) : (
                    columnTasks.map((task) => {
                      const owner = getMemberById(task.ownerId);

                      return (
                        <div
                          key={task.id}
                          className="rounded-lg border border-zinc-200 bg-white p-4 shadow-2xs hover:shadow-xs transition-shadow"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-sm font-semibold text-zinc-900 leading-snug">
                              {task.title}
                            </h3>
                          </div>

                          <p className="mt-1 text-xs text-zinc-500 line-clamp-2">
                            {task.description}
                          </p>

                          {/* Quick Interactive Status Switcher for Live Demo */}
                          <div className="mt-3 pt-2.5 border-t border-zinc-100 flex items-center justify-between text-xs">
                            <select
                              value={task.status}
                              onChange={(e) =>
                                updateTaskStatus(task.id, e.target.value as TaskStatus)
                              }
                              className="rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-[11px] font-medium text-zinc-700 focus:outline-none focus:ring-1 focus:ring-[var(--gator-purple)] cursor-pointer"
                            >
                              <option value="todo">To Do</option>
                              <option value="in-progress">In Progress</option>
                              <option value="blocked">Blocked</option>
                              <option value="done">Done</option>
                            </select>

                            <div
                              title={owner ? owner.name : "Unassigned"}
                              className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--gator-purple)] text-white text-[10px] font-bold"
                            >
                              {owner ? owner.initials : "?"}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

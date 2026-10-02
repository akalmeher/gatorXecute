"use client";

import React from "react";
import { useProject } from "@/context/ProjectContext";
import { TaskStatus } from "@/types";

const COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: "todo", label: "To Do" },
  { id: "in-progress", label: "In Progress" },
  { id: "blocked", label: "Blocked" },
  { id: "done", label: "Done" },
];

export function DashboardView() {
  const { project, updateTaskStatus, getMemberById } = useProject();

  const getTaskCount = (status: TaskStatus) =>
    project.tasks.filter((t) => t.status === status).length;

  return (
    <div className="space-y-10">
      {/* Top Heading */}
      <div className="space-y-2">
        <h1 className="font-heading text-3xl sm:text-[34px] font-bold tracking-tight text-[#F5F2FA]">
          Work
        </h1>
        <p className="text-base text-[#AAA5B4] max-w-2xl leading-relaxed">
          See what everyone is working on and keep tasks moving forward together.
        </p>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {COLUMNS.map((col) => {
          const columnTasks = project.tasks.filter((t) => t.status === col.id);

          return (
            <div
              key={col.id}
              className="flex flex-col rounded-2xl border border-[#2A2E39] bg-[#171A23] p-4 min-h-[480px]"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between px-2 py-2 mb-3">
                <span className="font-heading text-sm font-semibold text-[#F5F2FA]">
                  {col.label}
                </span>
                <span className="rounded-md bg-[#1D202A] border border-[#2A2E39] px-2 py-0.5 text-xs font-medium text-[#AAA5B4]">
                  {getTaskCount(col.id)}
                </span>
              </div>

              {/* Tasks List */}
              <div className="flex flex-col gap-3 flex-1">
                {columnTasks.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-[#2A2E39] p-4 text-center text-xs text-[#AAA5B4]/50">
                    No items here
                  </div>
                ) : (
                  columnTasks.map((task) => {
                    const owner = getMemberById(task.ownerId);

                    return (
                      <div
                        key={task.id}
                        className="rounded-xl border border-[#2A2E39] bg-[#1D202A] p-4 space-y-3 hover:border-[#B8A6FF]/40 transition-colors shadow-xs"
                      >
                        <h3 className="font-heading text-base font-semibold text-[#F5F2FA] leading-snug">
                          {task.title}
                        </h3>

                        {task.dueDate && (
                          <div className="text-xs text-[#AAA5B4]">
                            Due {task.dueDate}
                          </div>
                        )}

                        {/* Card Footer: Assignee & Column Mover */}
                        <div className="pt-2 border-t border-[#2A2E39]/60 flex flex-wrap items-center justify-between gap-2 min-w-0">
                          <div
                            title={owner ? owner.name : "Unassigned"}
                            className="flex items-center gap-2 min-w-0 flex-1"
                          >
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#171A23] border border-[#2A2E39] font-heading text-[#B8A6FF] text-[10px] font-bold">
                              {owner ? owner.initials : "?"}
                            </div>
                            <span className="text-xs text-[#AAA5B4] truncate min-w-0">
                              {owner ? owner.name.split(" ")[0] : "Unassigned"}
                            </span>
                          </div>

                          <select
                            value={task.status}
                            aria-label={`Move ${task.title}`}
                            onChange={(e) =>
                              updateTaskStatus(task.id, e.target.value as TaskStatus)
                            }
                            className="w-[108px] shrink-0 rounded-lg border border-[#2A2E39] bg-[#171A23] px-2 py-1 text-xs text-[#AAA5B4] hover:text-[#F5F2FA] hover:border-[#B8A6FF]/40 focus:outline-none cursor-pointer"
                          >
                            <option value="todo">To Do</option>
                            <option value="in-progress">In Progress</option>
                            <option value="blocked">Blocked</option>
                            <option value="done">Done</option>
                          </select>
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
  );
}

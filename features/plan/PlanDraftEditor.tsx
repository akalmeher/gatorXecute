"use client";

import React from "react";
import type { Member, Task } from "@/types";

/**
 * Feature Owner: Divij Anand
 * Editable review of a generated plan. Every AI suggestion can be changed
 * before it is accepted into shared state.
 */

interface PlanDraftEditorProps {
  tasks: Task[];
  members: Member[];
  disabled?: boolean;
  onChange: (taskId: string, changes: Partial<Task>) => void;
  onRemove: (taskId: string) => void;
}

const fieldClass =
  "w-full rounded-lg border border-[#2A2E39] bg-[#171A23] px-3 py-2 text-sm text-[#F5F2FA] placeholder:text-[#AAA5B4]/50 hover:border-[#B8A6FF]/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]/60 disabled:opacity-60";

const labelClass = "text-[11px] font-medium text-[#AAA5B4]";

export function PlanDraftEditor({ tasks, members, disabled, onChange, onRemove }: PlanDraftEditorProps) {
  const titleById = new Map(tasks.map((task) => [task.id, task.title]));

  return (
    <div className="space-y-4">
      {tasks.map((task, index) => {
        const suggested = members.find((m) => m.id === task.suggestedOwnerId);
        const ownerChanged = task.ownerId !== task.suggestedOwnerId;

        return (
          <div
            key={task.id}
            className="rounded-xl border border-[#2A2E39] bg-[#1D202A] p-5 sm:p-6 space-y-4 hover:border-[#B8A6FF]/40 transition-colors"
          >
            <div className="flex items-start gap-3">
              <span className="mt-2 hidden sm:flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#171A23] border border-[#2A2E39] font-heading text-xs font-semibold text-[#B8A6FF]">
                {index + 1}
              </span>
              <div className="flex-1 min-w-0 space-y-3">
                <input
                  type="text"
                  value={task.title}
                  disabled={disabled}
                  aria-label={`Task ${index + 1} title`}
                  onChange={(e) => onChange(task.id, { title: e.target.value })}
                  className={`${fieldClass} font-heading text-base font-semibold`}
                />
                <textarea
                  value={task.description}
                  disabled={disabled}
                  rows={2}
                  aria-label={`Task ${index + 1} description`}
                  onChange={(e) => onChange(task.id, { description: e.target.value })}
                  className={`${fieldClass} resize-y leading-relaxed text-[#AAA5B4]`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:pl-9">
              <label className="space-y-1">
                <span className={labelClass}>Owner</span>
                <select
                  value={task.ownerId ?? ""}
                  disabled={disabled}
                  onChange={(e) => onChange(task.id, { ownerId: e.target.value || undefined })}
                  className={`${fieldClass} cursor-pointer`}
                >
                  <option value="">Unassigned</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className={labelClass}>Due date</span>
                <input
                  type="date"
                  value={task.dueDate ?? ""}
                  disabled={disabled}
                  onChange={(e) => onChange(task.id, { dueDate: e.target.value || undefined })}
                  className={`${fieldClass} [color-scheme:dark]`}
                />
              </label>
              <label className="space-y-1">
                <span className={labelClass}>Estimate (hours)</span>
                <input
                  type="number"
                  min={0.25}
                  max={40}
                  step={0.25}
                  value={task.estimatedMinutes !== undefined ? task.estimatedMinutes / 60 : ""}
                  disabled={disabled}
                  onChange={(e) =>
                    onChange(task.id, {
                      estimatedMinutes: e.target.value === "" ? undefined : Math.round(Number(e.target.value) * 60),
                    })
                  }
                  className={fieldClass}
                />
              </label>
            </div>

            <div className="sm:pl-9 flex items-end justify-between gap-3">
              <div className="min-w-0 space-y-1.5 text-xs text-[#AAA5B4]">
                {task.dependencies.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span>Needs:</span>
                    {task.dependencies.map((depId) => (
                      <span
                        key={depId}
                        className="rounded bg-[#171A23] border border-[#2A2E39] px-2 py-0.5 text-[#B8A6FF]"
                      >
                        {titleById.get(depId) ?? depId}
                      </span>
                    ))}
                  </div>
                )}
                {task.assignmentReason && (
                  <p className="italic text-[#AAA5B4]/80">
                    {ownerChanged && suggested ? `Suggested ${suggested.name}: ` : "Why: "}
                    {task.assignmentReason}
                  </p>
                )}
            </div>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onRemove(task.id)}
                aria-label={`Remove task ${index + 1}: ${task.title}`}
                className="shrink-0 rounded-lg px-2 py-1 text-xs text-[#AAA5B4] hover:text-[#F5F2FA] hover:bg-[#171A23] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]/60 disabled:opacity-60 cursor-pointer"
              >
                Remove
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

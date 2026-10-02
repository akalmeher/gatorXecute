"use client";

import React from "react";
import { useProject } from "@/context/ProjectContext";

/**
 * Feature Owner: Divij Anand
 * Domain: Gemini integration, AI task decomposition schemas, prompt pipelines.
 * Note: Workspace view for review and editing of team plans and work items.
 */
export function ProjectPlanView() {
  const { project, getMemberById } = useProject();

  return (
    <div className="space-y-10">
      {/* Top Heading */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-[#1D202A] border border-[#2A2E39] px-2.5 py-1 text-xs font-medium text-[#B8A6FF]">
            AI Suggested Breakdown
          </span>
        </div>
        <h1 className="font-heading text-3xl sm:text-[34px] font-bold tracking-tight text-[#F5F2FA]">
          Plan
        </h1>
        <p className="text-base text-[#AAA5B4] max-w-2xl leading-relaxed">
          Here is a balanced breakdown of the project into manageable steps, matched to your team&apos;s strengths and goals.
        </p>
      </div>

      {/* Task List Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-2xl font-semibold text-[#F5F2FA] tracking-tight">
            What needs to get done
          </h2>
          <span className="text-sm text-[#AAA5B4]">
            {project.tasks.length} items
          </span>
        </div>

        <div className="space-y-4">
          {project.tasks.map((task) => {
            const owner = getMemberById(task.ownerId || task.suggestedOwnerId);

            return (
              <div
                key={task.id}
                className="rounded-xl border border-[#2A2E39] bg-[#1D202A] p-6 space-y-4 hover:border-[#B8A6FF]/40 transition-colors"
              >
                {/* Primary Row: Title, Owner, Status */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1.5 max-w-2xl">
                    <h3 className="font-heading text-lg font-semibold text-[#F5F2FA] leading-snug">
                      {task.title}
                    </h3>
                    <p className="text-sm text-[#AAA5B4] leading-relaxed">
                      {task.description}
                    </p>
                  </div>

                  {/* Owner pill */}
                  <div className="shrink-0 flex items-center gap-2.5 rounded-xl bg-[#171A23] border border-[#2A2E39] px-3.5 py-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#2A2E39] font-heading text-[#B8A6FF] font-bold text-xs">
                      {owner ? owner.initials : "?"}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[11px] text-[#AAA5B4] leading-none">
                        Assigned to
                      </span>
                      <span className="text-sm font-medium text-[#F5F2FA] leading-tight mt-0.5">
                        {owner ? owner.name : "Unassigned"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Priority Metadata: Due date, effort, dependencies */}
                <div className="flex flex-wrap items-center gap-y-2 gap-x-5 text-sm text-[#AAA5B4] pt-2 border-t border-[#2A2E39]/60">
                  {task.dueDate && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-[#AAA5B4]">Due</span>
                      <span className="font-medium text-[#F5F2FA]">{task.dueDate}</span>
                    </div>
                  )}

                  {task.estimatedMinutes && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-[#AAA5B4]">Est.</span>
                      <span className="font-medium text-[#F5F2FA]">
                        {Math.floor(task.estimatedMinutes / 60)}h{" "}
                        {task.estimatedMinutes % 60 > 0 ? `${task.estimatedMinutes % 60}m` : ""}
                      </span>
                    </div>
                  )}

                  {task.dependencies.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-[#AAA5B4]">Needs:</span>
                      <span className="rounded bg-[#171A23] border border-[#2A2E39] px-2 py-0.5 text-xs text-[#B8A6FF] font-mono">
                        {task.dependencies.join(", ")}
                      </span>
                    </div>
                  )}
                </div>

                {/* Secondary AI Rationale */}
                {task.assignmentReason && (
                  <div className="pt-1 text-xs text-[#AAA5B4]/80 italic">
                    Reason: {task.assignmentReason}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

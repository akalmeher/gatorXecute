"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useProject } from "@/context/ProjectContext";
import type { Task } from "@/types";
import { PlanDraftEditor } from "./PlanDraftEditor";
import { usePlanGeneration } from "./usePlanGeneration";
import { toIsoDay, validatePlanTasks } from "./plan-validation";

/**
 * Feature Owner: Divij Anand
 * Domain: Gemini integration, AI task decomposition schemas, prompt pipelines.
 * Note: Workspace view for review and editing of team plans and work items.
 */
export function ProjectPlanView() {
  const projectContext = useProject();
  const { project, getMemberById } = projectContext;
  // TODO(divij): drop this cast once Ammar's replaceTasks lands in ProjectContext on main.
  const replaceTasks = (projectContext as typeof projectContext & {
    replaceTasks?: (tasks: Task[]) => void;
  }).replaceTasks;

  const { isGenerating, error, draft, generate, updateDraftTask, removeDraftTask, discardDraft } =
    usePlanGeneration(project);
  const [acceptIssues, setAcceptIssues] = useState<string[]>([]);
  const [justAccepted, setJustAccepted] = useState(false);

  const handleGenerate = (mode: "live" | "demo") => {
    setAcceptIssues([]);
    setJustAccepted(false);
    void generate(mode);
  };

  const handleAccept = () => {
    if (!draft || !replaceTasks) return;
    const result = validatePlanTasks(draft.tasks, {
      projectId: project.id,
      memberIds: project.members.map((m) => m.id),
      deadline: toIsoDay(project.deadline),
    });
    if (!result.ok) {
      setAcceptIssues(result.issues);
      return;
    }
    replaceTasks(result.value);
    setAcceptIssues([]);
    discardDraft();
    setJustAccepted(true);
  };

  const handleDiscard = () => {
    setAcceptIssues([]);
    discardDraft();
  };

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

      {/* Generate Card */}
      <div className="rounded-2xl border border-[#2A2E39] bg-[#171A23] p-6 sm:p-8 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1 max-w-xl">
            <h2 className="font-heading text-xl font-semibold text-[#F5F2FA] tracking-tight">
              {draft ? "Generate again" : "Generate a plan with Gemini"}
            </h2>
            <p className="text-sm text-[#AAA5B4] leading-relaxed">
              Gemini drafts tasks from your assignment, deadline, and each teammate&apos;s skills and learning goals.
              Nothing changes until you review and accept it.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleGenerate("live")}
            disabled={isGenerating}
            aria-busy={isGenerating}
            className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl bg-[#B8A6FF] px-5 py-2.5 text-sm font-semibold text-[#0F1117] hover:bg-[#B8A6FF]/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#171A23] disabled:opacity-60 disabled:cursor-wait cursor-pointer transition-colors"
          >
            {isGenerating && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#0F1117]/30 border-t-[#0F1117]" />
            )}
            <span>{isGenerating ? "Generating…" : draft ? "Regenerate" : "Generate plan"}</span>
          </button>
        </div>

        <p role="status" aria-live="polite" className="sr-only">
          {isGenerating ? "Generating plan" : error ? error.message : draft ? "Plan draft ready for review" : ""}
        </p>

        {error && !isGenerating && (
          <div role="alert" className="rounded-xl border border-[#D5B45C]/40 bg-[#D5B45C]/5 p-4 space-y-3">
            <p className="text-sm font-medium text-[#D5B45C]">{error.message}</p>
            {error.issues && error.issues.length > 0 && (
              <ul className="list-disc pl-5 space-y-0.5 text-xs text-[#AAA5B4]">
                {error.issues.slice(0, 5).map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
                {error.issues.length > 5 && <li>…and {error.issues.length - 5} more</li>}
              </ul>
            )}
            <p className="text-xs text-[#AAA5B4]">Your current plan has not been changed.</p>
            <div className="flex flex-wrap gap-2">
              {error.error !== "missing_key" && error.error !== "bad_request" && (
                <button
                  type="button"
                  onClick={() => handleGenerate("live")}
                  className="rounded-lg border border-[#2A2E39] bg-[#1D202A] px-3 py-1.5 text-xs font-medium text-[#F5F2FA] hover:border-[#B8A6FF]/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]/60 cursor-pointer"
                >
                  Try again
                </button>
              )}
              <button
                type="button"
                onClick={() => handleGenerate("demo")}
                className="rounded-lg border border-[#D5B45C]/40 bg-[#1D202A] px-3 py-1.5 text-xs font-medium text-[#D5B45C] hover:bg-[#D5B45C]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D5B45C]/60 cursor-pointer"
              >
                Use demo plan (not AI)
              </button>
            </div>
          </div>
        )}

        {justAccepted && !draft && (
          <div role="status" className="rounded-xl border border-[#B8A6FF]/40 bg-[#B8A6FF]/5 p-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[#F5F2FA]">Plan accepted. Your team&apos;s tasks are now on the Work board.</p>
            <Link
              href="/dashboard"
              className="rounded-lg bg-[#1D202A] border border-[#2A2E39] px-3 py-1.5 text-xs font-medium text-[#B8A6FF] hover:border-[#B8A6FF]/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]/60"
            >
              Open Work →
            </Link>
          </div>
        )}
      </div>

      {draft ? (
        /* Draft Review Section */
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-heading text-2xl font-semibold text-[#F5F2FA] tracking-tight">
                  Review the suggested plan
                </h2>
                {draft.source === "gemini" ? (
                  <span className="rounded-md bg-[#B8A6FF]/10 border border-[#B8A6FF]/30 px-2 py-0.5 text-xs text-[#B8A6FF]">
                    ✨ Generated by Gemini
                  </span>
                ) : (
                  <span className="rounded-md bg-[#D5B45C]/10 border border-[#D5B45C]/30 px-2 py-0.5 text-xs text-[#D5B45C]">
                    Demo plan · not AI generated
                  </span>
                )}
              </div>
              <p className="text-sm text-[#AAA5B4]">
                These are suggestions. Edit anything, then accept to replace the current plan.
              </p>
            </div>
            <span className="text-sm text-[#AAA5B4]">{draft.tasks.length} items</span>
          </div>

          <PlanDraftEditor
            tasks={draft.tasks}
            members={project.members}
            disabled={isGenerating}
            onChange={(taskId, changes) => {
              setAcceptIssues([]);
              updateDraftTask(taskId, changes);
            }}
            onRemove={(taskId) => {
              setAcceptIssues([]);
              removeDraftTask(taskId);
            }}
          />

          {acceptIssues.length > 0 && (
            <div role="alert" className="rounded-xl border border-[#D5B45C]/40 bg-[#D5B45C]/5 p-4 space-y-2">
              <p className="text-sm font-medium text-[#D5B45C]">Fix these before accepting:</p>
              <ul className="list-disc pl-5 space-y-0.5 text-xs text-[#AAA5B4]">
                {acceptIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-2">
            {!replaceTasks && (
              <span className="text-xs text-[#AAA5B4] sm:mr-auto">
                Accepting is waiting on the shared replaceTasks action.
              </span>
            )}
            <button
              type="button"
              onClick={handleDiscard}
              disabled={isGenerating}
              className="rounded-xl border border-[#2A2E39] bg-[#1D202A] px-4 py-2.5 text-sm font-medium text-[#AAA5B4] hover:text-[#F5F2FA] hover:border-[#B8A6FF]/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]/60 disabled:opacity-60 cursor-pointer"
            >
              Discard draft
            </button>
            <button
              type="button"
              onClick={handleAccept}
              disabled={isGenerating || !replaceTasks || draft.tasks.length === 0}
              className="rounded-xl bg-[#B8A6FF] px-5 py-2.5 text-sm font-semibold text-[#0F1117] hover:bg-[#B8A6FF]/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F1117] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              Accept plan
            </button>
          </div>
        </div>
      ) : (
        /* Current Plan Section */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-2xl font-semibold text-[#F5F2FA] tracking-tight">
              What needs to get done
            </h2>
            <span className="text-sm text-[#AAA5B4]">
              {project.tasks.length} items
            </span>
          </div>

          {project.tasks.length === 0 && (
            <div className="rounded-xl border border-dashed border-[#2A2E39] p-8 text-center text-sm text-[#AAA5B4]">
              No tasks yet. Generate a plan to get started.
            </div>
          )}

          <div className="space-y-4">
            {project.tasks.map((task) => {
              const owner = getMemberById(task.ownerId || task.suggestedOwnerId);
              const titleById = new Map(project.tasks.map((t) => [t.id, t.title]));

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
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs text-[#AAA5B4]">Needs:</span>
                        {task.dependencies.map((depId) => (
                          <span
                            key={depId}
                            className="rounded bg-[#171A23] border border-[#2A2E39] px-2 py-0.5 text-xs text-[#B8A6FF]"
                          >
                            {titleById.get(depId) ?? depId}
                          </span>
                        ))}
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
      )}
    </div>
  );
}

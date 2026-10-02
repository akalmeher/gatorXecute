"use client";

import React, { useState } from "react";
import type { Member, Project, Task, TaskStatus } from "@/types";
import type { useReplan } from "./useReplan";
import { PROBLEM_PHRASE, applyPlanChanges, checkPlanChanges, findPlanProblems, needsAttention } from "./plan-health";
import { describeWaitingOn, firstName, formatDay, orderSteps } from "./plan-display";
import { toIsoDay, todayIsoDay } from "./plan-validation";

/**
 * Feature Owner: Divij Anand
 * What needs me? NEXT (your step, with Done / Need help) and NEEDS ATTENTION
 * (only real problems, with Fix). Fixes come from Gemini via /api/replan and
 * apply only when a student chooses. Shared by Home and the Plan page.
 */

export const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[#D5B45C] px-5 py-2.5 text-sm font-semibold text-[#0F1117] hover:bg-[#E2C36E] active:scale-[0.97] shadow-md shadow-[#D5B45C]/20 hover:shadow-lg hover:shadow-[#D5B45C]/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D5B45C]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F1117] disabled:opacity-60 disabled:cursor-wait cursor-pointer transition-all duration-200";
export const secondaryButton =
  "inline-flex items-center justify-center rounded-xl border border-[#B8A6FF]/40 bg-[#171A23] px-5 py-2.5 text-sm font-medium text-[#F5F2FA] hover:border-[#B8A6FF] hover:bg-[#B8A6FF]/15 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]/60 disabled:opacity-60 cursor-pointer transition-all duration-200";
export const quietButton =
  "inline-flex items-center rounded-lg px-2 py-1 text-sm text-[#AAA5B4] underline-offset-4 hover:text-[#F5F2FA] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]/60 disabled:opacity-60 cursor-pointer";
export const sectionLabel = "text-xs font-semibold uppercase tracking-[0.14em] text-[#AAA5B4]";

interface PlanFocusProps {
  project: Project;
  me?: Member;
  replan: ReturnType<typeof useReplan>;
  replaceTasks: (tasks: Task[]) => void;
  updateTaskStatus: (taskId: string, status: TaskStatus) => void;
  /** Show the calm "waiting on an earlier step" line (Plan page), not just real problems. */
  showWaiting?: boolean;
}

function relativeDay(isoDay: string | undefined, today: string): string | undefined {
  if (!isoDay) return undefined;
  const days = Math.round((Date.parse(isoDay) - Date.parse(today)) / 86_400_000);
  if (days < 0) return `was due ${formatDay(isoDay)}`;
  if (days === 0) return "due today";
  if (days === 1) return "due tomorrow";
  return `due ${formatDay(isoDay)}`;
}

export function PlanFocus({ project, me, replan, replaceTasks, updateTaskStatus, showWaiting }: PlanFocusProps) {
  const { isLoading, error, suggestion, source, request, dismiss } = replan;
  const [notice, setNotice] = useState<string | null>(null);
  const [applyIssues, setApplyIssues] = useState<string[]>([]);

  const today = todayIsoDay();
  const steps = orderSteps(project.tasks, project.members);
  const open = steps.filter((s) => s.state !== "done");
  const mine = me ? open.filter((s) => s.task.ownerId === me.id) : [];
  const next =
    mine.find((s) => s.state === "doing" || s.state === "ready") ??
    mine[0] ??
    open.find((s) => s.state === "doing" || s.state === "ready");
  const problems = findPlanProblems(project.tasks, today);
  const attention = problems.filter(needsAttention).slice(0, 2);
  const waiting = showWaiting ? problems.find((p) => !needsAttention(p)) : undefined;
  const memberName = (id?: string) => firstName(project.members.find((m) => m.id === id)) ?? "No one";

  const ask = (options: Parameters<typeof request>[0] = {}) => {
    setNotice(null);
    setApplyIssues([]);
    void request(options);
  };

  const markDone = (task: Task) => {
    updateTaskStatus(task.id, "done");
    setNotice(`✓ ${task.title}`);
  };

  const applySuggestion = () => {
    if (!suggestion) return;
    const issues = checkPlanChanges(suggestion.changes, project.tasks, {
      memberIds: project.members.map((m) => m.id),
      deadline: toIsoDay(project.deadline),
      today,
    });
    if (issues.length > 0) {
      setApplyIssues(issues);
      return;
    }
    replaceTasks(applyPlanChanges(project.tasks, suggestion.changes));
    dismiss();
    setNotice("✓ Plan updated");
  };

  if (isLoading) {
    return (
      <div role="status" className="flex items-center gap-3 py-6 text-[#F5F2FA]">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#B8A6FF]/30 border-t-[#B8A6FF]" />
        Finding a way forward…
      </div>
    );
  }

  if (suggestion) {
    const settleTogether = !suggestion.onTrack && suggestion.changes.length === 0;
    return (
      <section aria-labelledby="fix-heading" className="space-y-4 rounded-2xl bg-[#171A23] p-6">
        <p className={sectionLabel}>{suggestion.onTrack ? "All good" : settleTogether ? "Settle it together" : "Suggested fix"}</p>
        <h2 id="fix-heading" className="font-heading text-xl font-bold text-[#F5F2FA]">
          {suggestion.onTrack ? suggestion.headline : suggestion.proposal}
        </h2>
        {!suggestion.onTrack && <p className="text-sm text-[#AAA5B4]">{suggestion.situation}</p>}
        {suggestion.changes.length > 0 && (
          <ul className="space-y-1 text-sm">
            {suggestion.changes.map((change) => {
              const task = project.tasks.find((t) => t.id === change.taskId);
              return (
                <li key={change.taskId}>
                  <span className="text-[#F5F2FA]">{task?.title ?? change.taskId}</span>
                  <span className="text-[#B8A6FF]">
                    {change.ownerId && ` · ${memberName(task?.ownerId)} → ${memberName(change.ownerId)}`}
                    {change.dueDate && ` · ${formatDay(task?.dueDate) ?? "no date"} → ${formatDay(change.dueDate)}`}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {applyIssues.length > 0 && (
          <p role="alert" className="text-sm text-[#D5B45C]">
            The plan changed since this was suggested. Try again.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          {suggestion.changes.length > 0 ? (
            <button type="button" onClick={applySuggestion} className={primaryButton}>
              Use this
            </button>
          ) : (
            <button type="button" onClick={dismiss} className={primaryButton}>
              Got it
            </button>
          )}
          {!suggestion.onTrack && (
            <button type="button" onClick={() => ask({ another: true, mode: source === "demo" ? "demo" : "live" })} className={secondaryButton}>
              Another option
            </button>
          )}
          {suggestion.changes.length > 0 && (
            <button type="button" onClick={dismiss} className={quietButton}>
              Keep as is
            </button>
          )}
          <span className="text-xs text-[#AAA5B4]/70">{source === "gemini" ? "Gemini" : "Not AI"} · nothing changes until you choose</span>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-8">
      {notice && (
        <p role="status" className="text-sm text-[#B8A6FF]">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-[#D5B45C]">
          {error.message}{" "}
          <button type="button" onClick={() => ask({ mode: "demo" })} className={quietButton}>
            Use a simple suggestion
          </button>
        </p>
      )}

      {next ? (
        <section aria-labelledby="next-heading" className="space-y-3">
          <p className={sectionLabel}>{next.task.ownerId === me?.id ? "Your next step" : "Next"}</p>
          <h2 id="next-heading" className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-[#F5F2FA]">
            {next.task.title}
          </h2>
          <p className="text-[#AAA5B4]">
            {[next.task.ownerId !== me?.id && firstName(next.owner), relativeDay(next.task.dueDate, today)]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <button type="button" onClick={() => markDone(next.task)} className={primaryButton}>
              Done
            </button>
            <button
              type="button"
              onClick={() =>
                ask({ concern: `${me?.name ?? "A teammate"} needs help with "${next.task.title}".` })
              }
              className={secondaryButton}
            >
              Need help
            </button>
          </div>
        </section>
      ) : (
        <section className="space-y-1">
          <p className={sectionLabel}>Next</p>
          <h2 className="font-heading text-2xl font-bold text-[#F5F2FA]">Everything is done.</h2>
        </section>
      )}

      {attention.length > 0 && (
        <section aria-label="Needs attention" className="space-y-2">
          {attention.map((problem) => (
            <div
              key={problem.task.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#D5B45C]/10 px-4 py-3"
            >
              <p className="text-[#F5F2FA]">
                <span aria-hidden className="mr-2 text-[#D5B45C]">⚠</span>
                {problem.task.title} {PROBLEM_PHRASE[problem.kind]}
              </p>
              <button type="button" onClick={() => ask()} className={`${secondaryButton} py-1.5`}>
                Fix
              </button>
            </div>
          ))}
        </section>
      )}

      {waiting && (
        <p className="text-sm text-[#AAA5B4]">
          <span aria-hidden className="mr-2">‖</span>
          {waiting.task.title} is waiting on {describeWaitingOn(waiting.waitingOn.map((t) => t.title)).text} · on schedule
        </p>
      )}
    </div>
  );
}

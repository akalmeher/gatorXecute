"use client";

import React, { useState } from "react";
import type { Project, Task } from "@/types";
import { useReplan } from "./useReplan";
import { PROBLEM_PHRASE, applyPlanChanges, checkPlanChanges, findPlanProblems, needsAttention } from "./plan-health";
import { describeWaitingOn, firstName, formatDay } from "./plan-display";
import { toIsoDay, todayIsoDay } from "./plan-validation";

/**
 * Feature Owner: Divij Anand
 * Notices late or stuck work (deterministically), asks Gemini for the smallest
 * fix, and applies it only when a student chooses "Use suggestion".
 */

const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[#B8A6FF] px-5 py-3 text-sm font-semibold text-[#0F1117] hover:bg-[#B8A6FF]/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F1117] disabled:opacity-60 disabled:cursor-wait cursor-pointer transition-colors";
const secondaryButton =
  "inline-flex items-center justify-center rounded-xl border border-[#2A2E39] px-5 py-3 text-sm font-medium text-[#F5F2FA] hover:border-[#B8A6FF]/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]/60 disabled:opacity-60 cursor-pointer transition-colors";
const quietButton =
  "inline-flex items-center rounded-lg px-2 py-1 text-sm text-[#AAA5B4] underline-offset-4 hover:text-[#F5F2FA] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]/60 disabled:opacity-60 cursor-pointer";

interface PlanRecoveryProps {
  project: Project;
  replaceTasks: (tasks: Task[]) => void;
}

export function PlanRecovery({ project, replaceTasks }: PlanRecoveryProps) {
  const { isLoading, error, suggestion, source, request, dismiss } = useReplan(project);
  const [isAsking, setIsAsking] = useState(false);
  const [concern, setConcern] = useState("");
  const [applyIssues, setApplyIssues] = useState<string[]>([]);
  const [applied, setApplied] = useState(false);

  const today = todayIsoDay();
  const [problem] = findPlanProblems(project.tasks, today);
  const titleById = new Map(project.tasks.map((t) => [t.id, t.title]));
  const memberName = (id?: string) => firstName(project.members.find((m) => m.id === id)) ?? "No one";

  const find = (options: { concern?: string; another?: boolean; mode?: "live" | "demo" } = {}) => {
    setApplyIssues([]);
    setApplied(false);
    void request(options);
  };

  const handleUse = () => {
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
    setIsAsking(false);
    setConcern("");
    setApplied(true);
  };

  const handleKeep = () => {
    dismiss();
    setIsAsking(false);
    setApplyIssues([]);
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-4 border-l-2 border-[#B8A6FF] pl-5 py-2" role="status">
        <span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-[#B8A6FF]/30 border-t-[#B8A6FF]" />
        <p className="text-[#F5F2FA]">Looking for a way to keep things moving…</p>
      </div>
    );
  }

  if (suggestion) {
    return (
      <section aria-labelledby="replan-heading" className="space-y-5 border-l-2 border-[#B8A6FF] pl-5">
        <div className="space-y-2">
          <h2 id="replan-heading" className="font-heading text-2xl font-bold tracking-tight text-[#F5F2FA]">
            {suggestion.headline}
          </h2>
          <p className="text-[#AAA5B4]">{suggestion.situation}</p>
        </div>

        {!suggestion.onTrack && (
          <div className="space-y-3">
            <p className="text-sm text-[#AAA5B4]">
              {suggestion.changes.length > 0 ? "I found a way to keep things moving:" : "This one is best settled together:"}
            </p>
            <p className="text-lg font-semibold text-[#F5F2FA]">{suggestion.proposal}</p>
            <ul className="space-y-2">
              {suggestion.changes.map((change) => {
                const task = project.tasks.find((t) => t.id === change.taskId);
                const parts = [
                  change.ownerId && `${memberName(task?.ownerId)} → ${memberName(change.ownerId)}`,
                  change.dueDate && `${formatDay(task?.dueDate) ?? "no date"} → ${formatDay(change.dueDate)}`,
                ].filter(Boolean);
                return (
                  <li key={change.taskId} className="text-sm">
                    <span className="text-[#F5F2FA]">{titleById.get(change.taskId) ?? change.taskId}</span>
                    <span className="text-[#B8A6FF]">: {parts.join(", ")}</span>
                    <span className="block text-[#AAA5B4]">{change.why}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <p className="text-[#F5F2FA]/90">{suggestion.outcome}</p>

        {applyIssues.length > 0 && (
          <div role="alert" className="text-sm text-[#AAA5B4]">
            <p className="font-medium text-[#D5B45C]">The plan changed since this was suggested:</p>
            <ul className="list-disc pl-5">
              {applyIssues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-xs text-[#AAA5B4]">
          {source === "gemini" ? "Suggested by Gemini." : "Demo suggestion, not from Gemini."} Nothing changes until you choose.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          {suggestion.onTrack || suggestion.changes.length === 0 ? (
            <>
              <button type="button" onClick={handleKeep} className={primaryButton}>
                Got it
              </button>
              {!suggestion.onTrack && (
                <button type="button" onClick={() => find({ another: true, mode: source === "demo" ? "demo" : "live" })} className={secondaryButton}>
                  See another option
                </button>
              )}
            </>
          ) : (
            <>
              <button type="button" onClick={handleUse} className={primaryButton}>
                Use suggestion
              </button>
              <button type="button" onClick={() => find({ another: true, mode: source === "demo" ? "demo" : "live" })} className={secondaryButton}>
                See another option
              </button>
              <button type="button" onClick={handleKeep} className={quietButton}>
                Keep current plan
              </button>
            </>
          )}
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {applied && (
        <p role="status" className="border-l-2 border-[#B8A6FF] pl-5 text-[#F5F2FA]">
          Plan updated. Everyone can see the change on the Work tab.
        </p>
      )}

      {error && (
        <div role="alert" className="space-y-3 border-l-2 border-[#D5B45C] pl-5">
          <p className="font-medium text-[#F5F2FA]">{error.message} Your plan hasn&apos;t changed.</p>
          <div className="flex flex-wrap gap-3">
            {error.error !== "missing_key" && (
              <button type="button" onClick={() => find({ concern })} className={secondaryButton}>
                Try again
              </button>
            )}
            <button type="button" onClick={() => find({ concern, mode: "demo" })} className={quietButton}>
              Use a simple suggestion instead
            </button>
          </div>
        </div>
      )}

      {problem && !isAsking && !needsAttention(problem) && (
        <div className="space-y-2 border-l-2 border-[#B8A6FF]/50 pl-5">
          <p className="font-heading text-lg font-semibold text-[#F5F2FA]">
            {problem.task.title} is waiting on {describeWaitingOn(problem.waitingOn.map((t) => t.title)).text}.
          </p>
          <p className="text-[#AAA5B4]">
            {(() => {
              const due = problem.waitingOn.map((t) => t.dueDate).filter(Boolean).sort().at(-1);
              const late = problem.waitingOn.some((t) => t.dueDate && t.dueDate < today);
              return late
                ? "That earlier step is running late."
                : `That's on schedule${due ? `: ${problem.waitingOn.length === 1 ? "it's" : "the last of them is"} due ${formatDay(due)}` : ""}. Nothing to fix yet.`;
            })()}{" "}
            <button type="button" onClick={() => find()} className={quietButton}>
              Find a way forward anyway
            </button>
          </p>
        </div>
      )}

      {problem && !isAsking && needsAttention(problem) && (
        <div className="space-y-3 border-l-2 border-[#D5B45C] pl-5">
          <p className="font-heading text-xl font-semibold text-[#F5F2FA]">
            {problem.task.title} {PROBLEM_PHRASE[problem.kind]}.
          </p>
          <p className="text-[#AAA5B4]">
            {problem.holdsUp.length > 0
              ? `This may hold up ${describeWaitingOn(problem.holdsUp.map((t) => t.title)).text}.`
              : "Nothing else is waiting on it yet, but it still needs a path forward."}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => find()} className={primaryButton}>
              Find a way forward
            </button>
            <button type="button" onClick={() => setIsAsking(true)} className={quietButton}>
              Add what&apos;s going on
            </button>
          </div>
        </div>
      )}

      {isAsking ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            find({ concern });
          }}
        >
          <label htmlFor="replan-concern" className="block font-heading text-lg font-semibold text-[#F5F2FA]">
            What changed?
          </label>
          <textarea
            id="replan-concern"
            value={concern}
            onChange={(e) => setConcern(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="e.g. Oscar is out sick until Thursday, or we're behind on the research."
            className="w-full max-w-2xl rounded-xl border border-[#2A2E39] bg-[#171A23] px-4 py-3 text-[#F5F2FA] placeholder:text-[#AAA5B4]/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]/60"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className={primaryButton}>
              Find a way forward
            </button>
            <button type="button" onClick={() => setIsAsking(false)} className={quietButton}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        (!problem || !needsAttention(problem)) && (
          <p className="text-sm text-[#AAA5B4]">
            Falling behind or something changed?{" "}
            <button type="button" onClick={() => setIsAsking(true)} className={quietButton}>
              Help us catch up
            </button>
          </p>
        )
      )}
    </div>
  );
}

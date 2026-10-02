"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useProject } from "@/context/ProjectContext";
import { PlanDraftEditor } from "./PlanDraftEditor";
import { PlanTimeline } from "./PlanTimeline";
import { usePlanGeneration } from "./usePlanGeneration";
import { toIsoDay, validatePlanTasks } from "./plan-validation";
import { PlanFocus } from "./PlanFocus";
import { ProgressRail } from "./ProgressRail";
import { useReplan } from "./useReplan";
import { useCurrentMember } from "@/features/identity/useCurrentMember";
import { PlanQuickUpdate } from "./PlanQuickUpdate";
import { AssignmentInput } from "./AssignmentInput";
import { FoundSummary } from "./FoundSummary";
import type { PlanAssignment } from "./plan-types";
import { describeDraft, orderSteps } from "./plan-display";

/**
 * Feature Owner: Divij Anand
 * Domain: Gemini integration, AI task decomposition schemas, prompt pipelines.
 * Note: Answer-first plan view. The plan reads as "what needs to happen";
 * editing controls appear only when the student asks to review.
 */

const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[#B8A6FF] px-5 py-3 text-sm font-semibold text-[#0F1117] hover:bg-[#B8A6FF]/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F1117] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer transition-colors";
const secondaryButton =
  "inline-flex items-center justify-center rounded-xl border border-[#2A2E39] px-5 py-3 text-sm font-medium text-[#F5F2FA] hover:border-[#B8A6FF]/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]/60 disabled:opacity-60 cursor-pointer transition-colors";
const quietButton =
  "inline-flex items-center rounded-lg px-2 py-1 text-sm text-[#AAA5B4] underline-offset-4 hover:text-[#F5F2FA] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]/60 disabled:opacity-60 cursor-pointer";

export function ProjectPlanView() {
  const { project, replaceTasks, updateTaskStatus } = useProject();
  const { member } = useCurrentMember();
  const replan = useReplan(project);
  const { isGenerating, error, draft, generate, updateDraftTask, removeDraftTask, discardDraft } =
    usePlanGeneration(project);
  const [isReviewing, setIsReviewing] = useState(false);
  const [acceptIssues, setAcceptIssues] = useState<string[]>([]);
  const [justAccepted, setJustAccepted] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [assignment, setAssignment] = useState<PlanAssignment>({});
  const hasAssignment = Boolean(assignment.file || assignment.text?.trim());

  const currentSteps = useMemo(() => orderSteps(project.tasks, project.members), [project.tasks, project.members]);
  const draftSteps = useMemo(
    () => (draft ? orderSteps(draft.tasks, project.members) : []),
    [draft, project.members]
  );
  const hasPlan = project.tasks.length > 0;

  const startDraft = (mode: "live" | "demo") => {
    setAcceptIssues([]);
    setJustAccepted(false);
    setIsReviewing(false);
    setIsComposing(false);
    void generate(mode, hasAssignment ? { file: assignment.file, text: assignment.text?.trim() || undefined } : undefined);
  };

  const handleAccept = () => {
    if (!draft) return;
    const result = validatePlanTasks(draft.tasks, {
      projectId: project.id,
      memberIds: project.members.map((m) => m.id),
      deadline: toIsoDay(project.deadline),
    });
    if (!result.ok) {
      // Show step titles instead of internal ids, e.g. Task "t8" -> "Final review".
      const titleById = new Map(draft.tasks.map((t) => [t.id, t.title || "Untitled step"]));
      setAcceptIssues(
        result.issues.map((issue) =>
          issue.replace(/[Tt]ask "([^"]+)"/g, (match, id: string) => (titleById.has(id) ? `"${titleById.get(id)}"` : match))
        )
      );
      setIsReviewing(true);
      return;
    }
    replaceTasks(result.value);
    setAcceptIssues([]);
    setIsReviewing(false);
    discardDraft();
    setJustAccepted(true);
  };

  const handleDiscard = () => {
    setAcceptIssues([]);
    setIsReviewing(false);
    discardDraft();
  };

  return (
    <div className="space-y-10">
      <h1 className="font-heading text-3xl sm:text-[34px] font-bold tracking-tight text-[#F5F2FA]">Plan</h1>

      <p role="status" aria-live="polite" className="sr-only">
        {isGenerating ? "Drafting a plan" : draft ? "A plan draft is ready" : justAccepted ? "Plan saved" : ""}
      </p>

      {/* Drafting */}
      {isGenerating && (
        <div className="flex items-center gap-4 py-6">
          <span className="h-6 w-6 shrink-0 animate-spin rounded-full border-2 border-[#B8A6FF]/30 border-t-[#B8A6FF]" />
          <div>
            <p className="font-heading text-xl font-semibold text-[#F5F2FA]">
              {hasAssignment ? "Reading the assignment…" : "Drafting a plan…"}
            </p>
            <p className="text-sm text-[#AAA5B4]">Working out the steps and who could take each one.</p>
          </div>
        </div>
      )}

      {/* Couldn't draft */}
      {error && !isGenerating && (
        <div role="alert" className="space-y-4 border-l-2 border-[#D5B45C] pl-5">
          <div className="space-y-1">
            <p className="font-heading text-xl font-semibold text-[#F5F2FA]">I couldn&apos;t draft a plan right now.</p>
            <p className="text-sm text-[#AAA5B4]">
              {error.message} {hasPlan && "Your current plan hasn't changed."}
            </p>
          </div>
          {error.issues && error.issues.length > 0 && (
            <details className="text-xs text-[#AAA5B4]">
              <summary className="cursor-pointer hover:text-[#F5F2FA]">What went wrong</summary>
              <ul className="mt-2 list-disc pl-5 space-y-0.5">
                {error.issues.slice(0, 6).map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </details>
          )}
          <div className="flex flex-wrap gap-3">
            {error.error !== "missing_key" && error.error !== "bad_request" && (
              <button type="button" onClick={() => startDraft("live")} className={primaryButton}>
                Try again
              </button>
            )}
            <button type="button" onClick={() => startDraft("demo")} className={secondaryButton}>
              Use a starter plan
            </button>
          </div>
        </div>
      )}

      {draft && !isGenerating ? (
        /* Draft: answer first, details on request */
        <section className="space-y-8" aria-labelledby="draft-heading">
          {draft.understanding?.fromAssignment && (
            <div className="space-y-4">
              <h2 id="draft-heading" className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-[#F5F2FA]">
                Got it. Here&apos;s what I found.
              </h2>
              <FoundSummary understanding={draft.understanding} projectDeadline={toIsoDay(project.deadline)} />
            </div>
          )}

          <div className="space-y-3">
            {draft.understanding?.fromAssignment ? (
              <h3 className="font-heading text-xl font-semibold text-[#F5F2FA]">I&apos;ve drafted a plan for your team.</h3>
            ) : (
              <h2 id="draft-heading" className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-[#F5F2FA]">
                {draft.source === "gemini" ? "I've drafted a plan for your team." : "Here's a starter plan."}
              </h2>
            )}
            <p className="text-lg text-[#F5F2FA]/90">{describeDraft(draft.tasks, project.members)}</p>
            <p className="text-sm text-[#AAA5B4]">
              {draft.source === "gemini"
                ? "Drafted by Gemini from your assignment, deadline, and everyone's skills and goals."
                : "Starter plan: a simple template, not written by Gemini."}{" "}
              You can change anything{hasPlan ? ", and it replaces the current plan only when you say so" : ""}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={handleAccept} disabled={draft.tasks.length === 0} className={primaryButton}>
              Looks good
            </button>
            <button
              type="button"
              onClick={() => setIsReviewing((open) => !open)}
              aria-expanded={isReviewing}
              className={secondaryButton}
            >
              {isReviewing ? "Done reviewing" : "Review plan"}
            </button>
            <button type="button" onClick={handleDiscard} className={quietButton}>
              Discard
            </button>
          </div>

          {acceptIssues.length > 0 && (
            <div role="alert" className="space-y-2 border-l-2 border-[#D5B45C] pl-5">
              <p className="font-medium text-[#F5F2FA]">A few things need fixing first:</p>
              <ul className="list-disc pl-5 space-y-0.5 text-sm text-[#AAA5B4]">
                {acceptIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-5">
            <h3 className="font-heading text-xl font-semibold text-[#F5F2FA]">Here&apos;s what needs to happen</h3>
            {isReviewing ? (
              <PlanDraftEditor
                tasks={draft.tasks}
                members={project.members}
                onChange={(taskId, changes) => {
                  setAcceptIssues([]);
                  updateDraftTask(taskId, changes);
                }}
                onRemove={(taskId) => {
                  setAcceptIssues([]);
                  removeDraftTask(taskId);
                }}
              />
            ) : (
              <PlanTimeline steps={draftSteps} showReasons />
            )}
          </div>

          {isReviewing && (
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button type="button" onClick={handleAccept} disabled={draft.tasks.length === 0} className={primaryButton}>
                Use this plan
              </button>
              <button type="button" onClick={handleDiscard} className={quietButton}>
                Discard
              </button>
            </div>
          )}
        </section>
      ) : !isGenerating && hasPlan ? (
        /* Current plan: progress, what needs me, then every step */
        <section className="space-y-10">
          <ProgressRail steps={currentSteps} deadline={toIsoDay(project.deadline)} />

          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
            <div className="min-w-0 space-y-8">
              {justAccepted && (
                <p role="status" className="text-sm text-[#7FD1A6]">
                  ✓ Plan saved ·{" "}
                  <Link href="/dashboard" className="underline underline-offset-4 hover:text-[#F5F2FA]">
                    see the board
                  </Link>
                </p>
              )}
              <PlanFocus
                project={project}
                me={member}
                replan={replan}
                replaceTasks={replaceTasks}
                updateTaskStatus={updateTaskStatus}
                showWaiting
              />
              <PlanQuickUpdate project={project} />
            </div>

            <div className="min-w-0 space-y-5 lg:border-l lg:border-[#2A2E39]/70 lg:pl-10">
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-[#AAA5B4]">All steps</h2>
              <PlanTimeline steps={currentSteps} />
              {isComposing ? (
                <div className="space-y-4 border-t border-[#2A2E39] pt-6">
                  <AssignmentInput value={assignment} onChange={setAssignment} />
                  <div className="flex flex-wrap items-center gap-3">
                    <button type="button" onClick={() => startDraft("live")} className={primaryButton}>
                      Draft a fresh plan
                    </button>
                    <button type="button" onClick={() => setIsComposing(false)} className={quietButton}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setIsComposing(true)} className={quietButton}>
                  Draft a fresh plan
                </button>
              )}
            </div>
          </div>
        </section>
      ) : !isGenerating && !error ? (
        /* No plan yet */
        <section className="space-y-5 py-4">
          <div className="space-y-2">
            <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-[#F5F2FA]">No plan yet.</h2>
            <p className="text-lg text-[#AAA5B4] max-w-xl">
              I&apos;ll draft one from your assignment, deadline, and team. You can change anything before it&apos;s used.
            </p>
          </div>
          <AssignmentInput value={assignment} onChange={setAssignment} />
          <button type="button" onClick={() => startDraft("live")} className={primaryButton}>
            Draft a plan
          </button>
        </section>
      ) : null}
    </div>
  );
}

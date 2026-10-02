"use client";

import React, { useRef, useState } from "react";
import { useProject } from "@/context/ProjectContext";
import { useCurrentMember } from "@/features/identity/useCurrentMember";
import type { ShareCheck } from "@/features/ai/share-check-types";
import { mentionsPersonal } from "@/features/ai/care";
import { useShareCheck } from "@/features/care/useShareCheck";
import { SupportNote } from "@/features/care/SupportNote";
import { ShareChoice } from "@/features/care/ShareChoice";
import { WorthDiscussing } from "./WorthDiscussing";
import { CatchUpPanel } from "./CatchUpPanel";

/**
 * Feature Owner: Shreya Rameshwar
 * Domain: Meeting flow, async updates, Can't Attend flow, catch-up interface.
 *
 * Barebones pass: meeting card + empty state, "I can't make it" form, and
 * submitted updates for the current meeting.
 *
 * AI (Divij): "What's worth discussing?" (/api/meeting-brief), "Catch me up"
 * (/api/catch-up), and care for personal reasons in "I can't make it": the
 * team sees a discreet version unless the student chooses otherwise.
 */

// No auth in the MVP: use the remembered identity, else this default.
const DEFAULT_MEMBER_ID = "mem-shreya";

const inputClass =
  "w-full rounded-xl border border-[#2A2E39] bg-[#171A23] px-3 py-2 text-sm text-[#F5F2FA] placeholder:text-[#AAA5B4]/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]";

export function MeetingCatchUpView() {
  const { project, addAsyncUpdate, getMemberById } = useProject();
  const { memberId } = useCurrentMember();
  const CURRENT_MEMBER_ID = memberId ?? DEFAULT_MEMBER_ID;
  const shareCheck = useShareCheck();
  const [care, setCare] = useState<{ check: ShareCheck; content: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [agendaOverride, setAgendaOverride] = useState<string[] | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [progress, setProgress] = useState("");
  const [blockers, setBlockers] = useState("");
  const [questions, setQuestions] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const submitLock = useRef(false);

  const meeting = project.meetings[0];
  const agendaItems = agendaOverride ?? meeting?.agendaItems ?? [];

  const meetingUpdates = meeting
    ? project.asyncUpdates.filter((u) => u.meetingId === meeting.id)
    : [];
  const alreadyReported = meetingUpdates.some(
    (u) => u.memberId === CURRENT_MEMBER_ID && u.type === "cant_attend"
  );

  const post = (content: string) => {
    if (!meeting) return;
    addAsyncUpdate({
      projectId: project.id,
      memberId: CURRENT_MEMBER_ID,
      meetingId: meeting.id,
      type: "cant_attend",
      content,
    });
    setProgress("");
    setBlockers("");
    setQuestions("");
    setError(null);
    setCare(null);
    setFormOpen(false);
    setSuccess(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meeting || submitLock.current) return;

    if (!progress.trim()) {
      setError("Add a short progress update so your team knows where you are.");
      return;
    }

    const parts = [`Progress: ${progress.trim()}`];
    if (blockers.trim()) parts.push(`Blockers: ${blockers.trim()}`);
    if (questions.trim()) parts.push(`Questions: ${questions.trim()}`);
    const content = parts.join("\n");

    const isDuplicate = meetingUpdates.some(
      (u) => u.memberId === CURRENT_MEMBER_ID && u.content === content
    );
    if (isDuplicate) {
      setError("You already sent this exact update.");
      return;
    }

    submitLock.current = true;
    // Personal reasons (illness, family, grief) are never shared as written by
    // default: the student sees what the team will read and chooses.
    if (mentionsPersonal(content)) {
      setChecking(true);
      const name = getMemberById(CURRENT_MEMBER_ID)?.name ?? "A teammate";
      const check = await shareCheck(content, name);
      setChecking(false);
      submitLock.current = false;
      if (check.personal) {
        setCare({ check, content });
        return;
      }
    }
    post(content);
    submitLock.current = false;
  };

  // Cancel closes the form but keeps whatever was typed.
  const handleCancel = () => {
    setError(null);
    setCare(null);
    setFormOpen(false);
  };

  if (!meeting) {
    return (
      <div className="rounded-2xl border border-[#2A2E39] bg-[#171A23] p-6 sm:p-8 space-y-2">
        <h2 className="font-heading text-2xl font-bold tracking-tight text-[#F5F2FA]">
          No meeting scheduled yet
        </h2>
        <p className="text-sm text-[#AAA5B4]">
          Once your team confirms a time, the meeting and its agenda will show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-[#2A2E39] bg-[#171A23] p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5 border-b border-[#2A2E39] pb-6">
          <div className="space-y-1.5 max-w-xl">
            <span className="text-xs font-medium text-[#B8A6FF]">Upcoming Sync</span>
            <h2 className="font-heading text-2xl font-bold tracking-tight text-[#F5F2FA]">
              {meeting.title}
            </h2>
            <p className="text-sm text-[#AAA5B4]">
              {meeting.scheduledTime} • {meeting.durationMinutes} minutes
            </p>
            <p className="text-xs text-[#AAA5B4]">
              Attendees:{" "}
              {meeting.attendeeIds
                .map((id) => getMemberById(id)?.name ?? id)
                .join(", ") || "none yet"}
            </p>
          </div>

          {!formOpen && (
            <div className="shrink-0 flex flex-col items-start sm:items-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setSuccess(false);
                  setFormOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1D202A] border border-[#D5B45C]/50 px-4 py-2.5 text-sm font-medium text-[#D5B45C] hover:bg-[#D5B45C]/10 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]"
              >
                {alreadyReported ? "Add another update" : "I can't make it"}
              </button>
              {alreadyReported && (
                <span className="text-xs text-[#B8A6FF]">✓ Absence recorded</span>
              )}
            </div>
          )}
        </div>

        {success && (
          <p role="status" className="text-sm text-[#B8A6FF]">
            ✓ Update sent. Your team can see it below.
          </p>
        )}

        {formOpen && (
          <form
            onSubmit={handleSubmit}
            noValidate
            className="rounded-xl border border-[#2A2E39] bg-[#1D202A] p-5 space-y-4"
          >
            <h3 className="font-heading text-sm font-semibold text-[#F5F2FA]">
              Can&apos;t make it? Send your update instead
            </h3>

            <div className="space-y-1.5">
              <label htmlFor="update-progress" className="text-xs font-medium text-[#F5F2FA]">
                Progress update <span className="text-[#D5B45C]">(required)</span>
              </label>
              <textarea
                id="update-progress"
                rows={3}
                value={progress}
                onChange={(e) => setProgress(e.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "update-error" : undefined}
                className={inputClass}
                placeholder="What have you done since the last sync?"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="update-blockers" className="text-xs font-medium text-[#F5F2FA]">
                Blockers (optional)
              </label>
              <textarea
                id="update-blockers"
                rows={2}
                value={blockers}
                onChange={(e) => setBlockers(e.target.value)}
                className={inputClass}
                placeholder="Anything stopping you?"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="update-questions" className="text-xs font-medium text-[#F5F2FA]">
                Questions for the team (optional)
              </label>
              <textarea
                id="update-questions"
                rows={2}
                value={questions}
                onChange={(e) => setQuestions(e.target.value)}
                className={inputClass}
                placeholder="Anything you want answered in the meeting?"
              />
            </div>

            {error && (
              <p id="update-error" role="alert" className="text-sm text-[#D5B45C]">
                {error}
              </p>
            )}

            {care && (
              <div className="space-y-3">
                <SupportNote wellbeing={care.check.wellbeing} acknowledgement={care.check.acknowledgement} />
                <ShareChoice
                  shareable={care.check.shareable}
                  original={care.content}
                  onShare={post}
                  onSkip={() => {
                    setCare(null);
                    setFormOpen(false);
                  }}
                />
              </div>
            )}

            <div className={care ? "hidden" : "flex gap-3"}>
              <button
                type="submit"
                disabled={checking}
                className="rounded-xl bg-[#B8A6FF] px-4 py-2.5 text-sm font-semibold text-[#0F1117] hover:bg-[#B8A6FF]/90 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5F2FA]"
              >
                {checking ? "Checking…" : "Send update"}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-xl border border-[#2A2E39] px-4 py-2.5 text-sm font-medium text-[#AAA5B4] hover:text-[#F5F2FA] transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="space-y-3">
          <h3 className="font-heading text-sm font-semibold text-[#F5F2FA]">Agenda items</h3>
          {agendaItems.length === 0 ? (
            <p className="text-sm text-[#AAA5B4]">No agenda has been added yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {agendaItems.map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-[#2A2E39] bg-[#1D202A] p-4 flex items-start gap-3"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#171A23] border border-[#2A2E39] font-heading text-xs font-semibold text-[#B8A6FF]">
                    {idx + 1}
                  </span>
                  <span className="text-sm text-[#F5F2FA] leading-snug">{item}</span>
                </div>
              ))}
            </div>
          )}
          <WorthDiscussing project={project} meeting={meeting} onUse={setAgendaOverride} />
        </div>

        <CatchUpPanel project={project} meeting={meeting} memberId={CURRENT_MEMBER_ID} />
      </div>

      <div className="rounded-2xl border border-[#2A2E39] bg-[#171A23] p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-[#2A2E39] pb-4">
          <div className="space-y-1">
            <span className="text-xs font-medium text-[#B8A6FF]">Async Updates</span>
            <h2 className="font-heading text-2xl font-bold tracking-tight text-[#F5F2FA]">
              Updates for this meeting
            </h2>
          </div>
          <span className="text-xs text-[#AAA5B4]">{meetingUpdates.length} updates</span>
        </div>

        {meetingUpdates.length === 0 ? (
          <p className="text-sm text-[#AAA5B4]">No updates yet.</p>
        ) : (
          <div className="space-y-4">
            {meetingUpdates.map((update) => {
              const member = getMemberById(update.memberId);
              return (
                <div
                  key={update.id}
                  className="rounded-xl border border-[#2A2E39] bg-[#1D202A] p-5 space-y-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#171A23] border border-[#2A2E39] font-heading text-[#B8A6FF] font-bold text-xs">
                        {member?.initials ?? "?"}
                      </div>
                      <strong className="font-heading text-sm font-semibold text-[#F5F2FA] truncate">
                        {member?.name ?? "Unknown member"}
                      </strong>
                      <span className="rounded-md bg-[#D5B45C]/10 border border-[#D5B45C]/30 px-2 py-0.5 text-xs text-[#D5B45C] whitespace-nowrap">
                        {update.type === "cant_attend" ? "Can't attend" : update.type}
                      </span>
                    </div>
                    <span className="text-xs text-[#AAA5B4] shrink-0" suppressHydrationWarning>
                      {new Date(update.createdAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-[#AAA5B4] leading-relaxed whitespace-pre-line break-words">
                    {update.content}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
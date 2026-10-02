"use client";

import React, { useState } from "react";
import { useProject } from "@/context/ProjectContext";

/**
 * Feature Owner: Shreya Rameshwar
 * Domain: Meeting flow, async updates, Can't Attend flow, catch-up interface.
 * Note: Workspace view for upcoming team syncs, agenda review, absence reporting, and catch-up summaries.
 */
export function MeetingCatchUpView() {
  const { project, addAsyncUpdate, getMemberById } = useProject();
  const [hasReportedAbsence, setHasReportedAbsence] = useState(false);

  const meeting = project.meetings[0];

  const handleSimulateCantAttend = () => {
    addAsyncUpdate({
      projectId: project.id,
      memberId: "mem-shreya",
      meetingId: meeting?.id,
      type: "cant_attend",
      content:
        "I have a course lab conflict during this time. I posted my updates on the shared deck and reviewed the testing plan.",
    });
    setHasReportedAbsence(true);
  };

  return (
    <div className="space-y-8">
      {/* Upcoming Meeting & Can't Attend Action Card */}
      <div className="rounded-2xl border border-[#2A2E39] bg-[#171A23] p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5 border-b border-[#2A2E39] pb-6">
          <div className="space-y-1.5 max-w-xl">
            <span className="text-xs font-medium text-[#B8A6FF]">
              Upcoming Sync
            </span>
            <h2 className="font-heading text-2xl font-bold tracking-tight text-[#F5F2FA]">
              {meeting?.title || "Team Sync"}
            </h2>
            <p className="text-sm text-[#AAA5B4]">
              {meeting?.scheduledTime} • {meeting?.durationMinutes} minutes
            </p>
          </div>

          {/* Can't Attend Action Button */}
          <div className="shrink-0">
            {!hasReportedAbsence ? (
              <button
                type="button"
                onClick={handleSimulateCantAttend}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1D202A] border border-[#D5B45C]/50 px-4 py-2.5 text-sm font-medium text-[#D5B45C] hover:bg-[#D5B45C]/10 transition-colors cursor-pointer"
              >
                <span>✋</span>
                <span>I can&apos;t make it</span>
              </button>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-xl bg-[#1D202A] border border-[#B8A6FF]/40 px-4 py-2.5 text-sm font-medium text-[#B8A6FF]">
                <span>✓</span>
                <span>Absence recorded • Catch-up ready</span>
              </div>
            )}
          </div>
        </div>

        {/* Agenda */}
        <div className="space-y-3">
          <h3 className="font-heading text-sm font-semibold text-[#F5F2FA]">
            Agenda items
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {meeting?.agendaItems.map((item, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-[#2A2E39] bg-[#1D202A] p-4 flex items-start gap-3"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#171A23] border border-[#2A2E39] font-heading text-xs font-semibold text-[#B8A6FF]">
                  {idx + 1}
                </span>
                <span className="text-sm text-[#F5F2FA] leading-snug">
                  {item}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Catch-Up Summary: "What you missed" */}
      <div className="rounded-2xl border border-[#2A2E39] bg-[#171A23] p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-[#2A2E39] pb-4">
          <div className="space-y-1">
            <span className="text-xs font-medium text-[#B8A6FF]">
              Meeting Digest
            </span>
            <h2 className="font-heading text-2xl font-bold tracking-tight text-[#F5F2FA]">
              What you missed
            </h2>
            <p className="text-sm text-[#AAA5B4]">
              Brief recap and action items so absent teammates can catch up in under 60 seconds.
            </p>
          </div>
          <span className="text-xs text-[#AAA5B4]">
            {project.asyncUpdates.length} notes
          </span>
        </div>

        <div className="space-y-4">
          {project.asyncUpdates.map((update) => {
            const member = getMemberById(update.memberId);

            return (
              <div
                key={update.id}
                className="rounded-xl border border-[#2A2E39] bg-[#1D202A] p-6 space-y-4"
              >
                {/* Note header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#171A23] border border-[#2A2E39] font-heading text-[#B8A6FF] font-bold text-xs">
                      {member?.initials}
                    </div>
                    <div>
                      <strong className="font-heading text-sm font-semibold text-[#F5F2FA]">
                        {member?.name}
                      </strong>
                      <span className="ml-2 rounded-md bg-[#D5B45C]/10 border border-[#D5B45C]/30 px-2 py-0.5 text-xs text-[#D5B45C]">
                        Can&apos;t attend
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-[#AAA5B4]">
                    {new Date(update.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                <p className="text-sm text-[#AAA5B4] leading-relaxed pl-11">
                  &ldquo;{update.content}&rdquo;
                </p>

                {/* AI Catch-Up Digest */}
                <div className="ml-11 rounded-xl border border-[#2A2E39] bg-[#171A23] p-4 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#B8A6FF]">
                    <span>✨</span>
                    <span>Quick catch-up summary</span>
                  </div>
                  <p className="text-sm text-[#F5F2FA] leading-relaxed">
                    The team reviewed initial milestones and agreed on deliverable ownership. Shreya was excused due to lab section. Next action: review updated plan and verify test specs before next sync.
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

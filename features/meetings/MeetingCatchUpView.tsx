"use client";

import React, { useState } from "react";
import { useProject } from "@/context/ProjectContext";

/**
 * Feature Owner: Shreya Rameshwar
 * Domain: Meeting flow, async updates, Can't Attend flow, catch-up interface.
 * Note: Lightweight placeholder establishing shared interfaces for the MVP demo foundation.
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
        "Conflict with physics lab section. Progress posted: completed design tokens and reviewed test suite specs.",
    });
    setHasReportedAbsence(true);
  };

  return (
    <div className="space-y-6">
      {/* Meeting Brief Card */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-zinc-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-purple-500/10 px-2.5 py-0.5 text-xs font-semibold text-purple-700">
                Meeting Brief & Sync
              </span>
              <span className="text-xs text-zinc-500 font-mono">
                Feature Owner: Shreya Rameshwar
              </span>
            </div>
            <h2 className="mt-2 text-xl font-bold tracking-tight text-zinc-900">
              {meeting?.title || "Upcoming Team Sync"}
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {meeting?.scheduledTime} ({meeting?.durationMinutes} mins)
            </p>
          </div>

          {/* Can't Attend Flow Trigger Button */}
          <div>
            {!hasReportedAbsence ? (
              <button
                type="button"
                onClick={handleSimulateCantAttend}
                className="inline-flex items-center rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition-colors cursor-pointer"
              >
                Simulate: &quot;I Can&apos;t Attend&quot;
              </button>
            ) : (
              <span className="inline-flex items-center rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 border border-emerald-200">
                ✓ Absence & Async Digest Recorded
              </span>
            )}
          </div>
        </div>

        {/* Agenda Items */}
        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
            Target Agenda
          </h3>
          <ul className="space-y-1.5 text-sm text-zinc-700">
            {meeting?.agendaItems.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-zinc-400 font-mono text-xs">{idx + 1}.</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* AI Catch-Up Digest & Async Updates */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-4">
          <div>
            <h3 className="text-base font-bold text-zinc-900">
              AI Meeting Catch-Up & Async Feed
            </h3>
            <p className="text-xs text-zinc-500">
              Asynchronous updates and synthesized catch-up summaries for absent members.
            </p>
          </div>
          <span className="text-xs font-semibold text-[var(--gator-purple)]">
            {project.asyncUpdates.length} Updates
          </span>
        </div>

        <div className="space-y-3">
          {project.asyncUpdates.map((update) => {
            const member = getMemberById(update.memberId);

            return (
              <div
                key={update.id}
                className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 text-xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--gator-purple)] text-white text-[10px] font-bold">
                      {member?.initials}
                    </span>
                    <strong className="text-zinc-900">{member?.name}</strong>
                    <span className="rounded bg-amber-200/60 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900 uppercase">
                      {update.type.replace("_", " ")}
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    {new Date(update.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                <p className="text-zinc-700 leading-relaxed pl-7">
                  {update.content}
                </p>

                {/* AI Catch-Up Digest Box */}
                <div className="ml-7 mt-2 rounded border border-purple-200 bg-purple-50/60 p-2.5 text-zinc-800">
                  <div className="flex items-center gap-1.5 font-semibold text-[var(--gator-purple)] mb-1">
                    <span>✨</span>
                    <span>AI Catch-Up Digest:</span>
                  </div>
                  <p className="text-[11px] text-zinc-600">
                    &quot;Sprint focus was aligned on core interfaces. Shreya was marked excused for physics lab. Action items for Shreya: review testing specs and post asynchronous progress update.&quot;
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

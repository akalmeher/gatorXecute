"use client";

import React, { useEffect, useRef, useState } from "react";
import type { Meeting, Project } from "@/types";
import type { DiscussionItem, MeetingBrief, MeetingBriefRequest, MeetingBriefResponse } from "@/features/ai/meeting-brief-types";
import { modelLabel } from "@/features/ai/model-label";

/**
 * Feature Owner: Shreya Rameshwar (UI) · AI: Divij Anand (/api/meeting-brief)
 * "Worth discussing": only what needs the group together, timeboxed to the
 * meeting length, and an honest "you may not need this meeting". The student
 * edits the list and decides; nothing replaces the agenda until they say so.
 */

const KIND_LABEL: Record<DiscussionItem["kind"], string> = {
  decision: "Decide",
  waiting: "Unblock",
  deadline: "Deadline",
  "check-in": "Check in",
};

const primary =
  "inline-flex items-center gap-2 rounded-xl bg-[#B8A6FF] px-4 py-2.5 text-sm font-semibold text-[#0F1117] hover:bg-[#B8A6FF]/90 disabled:opacity-60 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5F2FA]";
const secondary =
  "inline-flex items-center gap-2 rounded-xl border border-[#2A2E39] px-4 py-2.5 text-sm font-medium text-[#F5F2FA] hover:border-[#B8A6FF]/50 disabled:opacity-60 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]";
const quiet =
  "inline-flex items-center rounded-lg px-2 py-1 text-sm text-[#AAA5B4] underline-offset-4 hover:text-[#F5F2FA] hover:underline cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]";

interface WorthDiscussingProps {
  project: Project;
  meeting: Meeting;
  /** Use the (edited) list as this meeting's agenda. */
  onUse: (agendaItems: string[]) => void;
}

export function WorthDiscussing({ project, meeting, onUse }: WorthDiscussingProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brief, setBrief] = useState<MeetingBrief | null>(null);
  const [items, setItems] = useState<DiscussionItem[]>([]);
  const [label, setLabel] = useState("");
  const inFlight = useRef<AbortController | null>(null);

  useEffect(() => () => inFlight.current?.abort(), []);

  const run = async (mode: "live" | "demo" = "live") => {
    if (inFlight.current) return;
    const controller = new AbortController();
    inFlight.current = controller;
    setIsLoading(true);
    setError(null);
    const body: MeetingBriefRequest = {
      mode,
      project: { name: project.name, deadline: project.deadline },
      meeting: { title: meeting.title, durationMinutes: meeting.durationMinutes, attendeeIds: meeting.attendeeIds },
      tasks: project.tasks,
      asyncUpdates: project.asyncUpdates.slice(0, 20),
      members: project.members.map(({ id, name, role }) => ({ id, name, role })),
    };
    try {
      const response = await fetch("/api/meeting-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const data = (await response.json()) as MeetingBriefResponse;
      if (data.ok) {
        setBrief(data.brief);
        setItems(data.brief.worthDiscussing);
        setLabel(modelLabel(data.model, data.source));
      } else {
        setError(data.message);
      }
    } catch {
      if (!controller.signal.aborted) setError("Couldn't reach the server.");
    } finally {
      if (inFlight.current === controller) inFlight.current = null;
      if (!controller.signal.aborted) setIsLoading(false);
    }
  };

  if (!brief) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void run()} disabled={isLoading} className={secondary}>
          {isLoading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#B8A6FF]/30 border-t-[#B8A6FF]" />}
          {isLoading ? "Looking at the plan…" : "What's worth discussing?"}
        </button>
        {error && (
          <p role="alert" className="text-sm text-[#D5B45C]">
            {error}{" "}
            <button type="button" onClick={() => void run("demo")} className={quiet}>
              Use a simple list (not AI)
            </button>
          </p>
        )}
      </div>
    );
  }

  const minutes = items.reduce((sum, item) => sum + item.minutes, 0);

  return (
    <section aria-labelledby="worth-heading" className="rounded-xl border border-[#2A2E39] bg-[#1D202A] p-5 space-y-4">
      <div className="space-y-1">
        <span className="text-xs font-medium text-[#B8A6FF]">Worth discussing</span>
        <h3 id="worth-heading" className="font-heading text-lg font-semibold text-[#F5F2FA]">
          {brief.headline}
        </h3>
        {!brief.meetingNeeded && (
          <p className="text-sm text-[#D5B45C]">Nothing here needs everyone live. Async updates might be enough this time.</p>
        )}
      </div>

      {items.length > 0 && (
        <ol className="space-y-2">
          {items.map((item, idx) => (
            <li key={item.title} className="flex items-start gap-3 rounded-lg bg-[#171A23] p-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[#2A2E39] font-heading text-xs font-semibold text-[#B8A6FF]">
                {idx + 1}
              </span>
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-sm font-medium text-[#F5F2FA]">
                  {item.title} <span className="text-xs font-normal text-[#AAA5B4]">· {KIND_LABEL[item.kind]} · {item.minutes} min</span>
                </p>
                <p className="text-sm text-[#AAA5B4]">{item.why}</p>
              </div>
              <button
                type="button"
                aria-label={`Remove ${item.title}`}
                onClick={() => setItems((prev) => prev.filter((i) => i !== item))}
                className={`${quiet} shrink-0`}
              >
                ✕
              </button>
            </li>
          ))}
        </ol>
      )}

      <p className="text-sm text-[#AAA5B4]">
        {brief.everythingElse} {items.length > 0 && `About ${minutes} of ${meeting.durationMinutes} minutes.`}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        {items.length > 0 && (
          <button
            type="button"
            onClick={() => {
              onUse(items.map((i) => i.title));
              setBrief(null);
            }}
            className={primary}
          >
            Use as agenda
          </button>
        )}
        <button type="button" onClick={() => setBrief(null)} className={quiet}>
          Keep the current agenda
        </button>
        <span className="text-xs text-[#AAA5B4]/70">{label} · from your plan and updates</span>
      </div>
    </section>
  );
}

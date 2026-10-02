"use client";

import React, { useEffect, useRef, useState } from "react";
import type { Meeting, Project } from "@/types";
import { modelLabel } from "@/features/ai/model-label";
import { type CatchUp, requestCatchUp } from "./CatchUpClient";

/**
 * Feature Owner: Shreya Rameshwar (UI) · AI: Divij Anand (/api/catch-up)
 * "Here's what you missed": the answer first (does this affect me?), then
 * decisions, changes, your part and who agreed to what. Grounded only in the
 * notes and updates given; with no notes, nothing is reported as decided.
 */

const box = "rounded-xl border border-[#2A2E39] bg-[#1D202A] p-5 space-y-3";
const primary =
  "inline-flex items-center gap-2 rounded-xl bg-[#B8A6FF] px-4 py-2.5 text-sm font-semibold text-[#0F1117] hover:bg-[#B8A6FF]/90 disabled:opacity-60 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5F2FA]";
const quiet =
  "inline-flex items-center rounded-lg px-2 py-1 text-sm text-[#AAA5B4] underline-offset-4 hover:text-[#F5F2FA] hover:underline cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]";

interface CatchUpPanelProps {
  project: Project;
  meeting: Meeting;
  /** The student catching up; "your part" is written for them. */
  memberId?: string;
}

function List({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <h4 className="text-xs font-medium text-[#AAA5B4]">{title}</h4>
      <ul className="space-y-1 text-sm text-[#F5F2FA]">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span aria-hidden className="text-[#B8A6FF]">·</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CatchUpPanel({ project, meeting, memberId }: CatchUpPanelProps) {
  const [notes, setNotes] = useState(meeting.summary ?? "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<{ message: string; canDemo: boolean } | null>(null);
  const [result, setResult] = useState<{ catchUp: CatchUp; label: string } | null>(null);
  const inFlight = useRef<AbortController | null>(null);

  useEffect(() => () => inFlight.current?.abort(), []);

  const titleOf = (taskId?: string) => project.tasks.find((t) => t.id === taskId)?.title;
  const nameOf = (id?: string) => project.members.find((m) => m.id === id)?.name.split(" ")[0];

  const run = async (mode: "live" | "demo" = "live") => {
    if (inFlight.current) return;
    const controller = new AbortController();
    inFlight.current = controller;
    setIsLoading(true);
    setError(null);
    try {
      const response = await requestCatchUp(
        {
          mode,
          meeting: {
            id: meeting.id,
            title: meeting.title,
            scheduledTime: meeting.scheduledTime,
            durationMinutes: meeting.durationMinutes,
            attendeeIds: meeting.attendeeIds,
            agendaItems: meeting.agendaItems,
          },
          notes: notes.trim() || undefined,
          absentMemberId: memberId,
          asyncUpdates: project.asyncUpdates.filter((u) => !u.meetingId || u.meetingId === meeting.id).slice(0, 20),
          tasks: project.tasks,
          members: project.members.map(({ id, name, role }) => ({ id, name, role })),
        },
        controller.signal
      );
      if (response.ok) setResult({ catchUp: response.catchUp, label: modelLabel(response.model, response.source) });
      else setError({ message: response.message, canDemo: true });
    } catch {
      // aborted on unmount
    } finally {
      if (inFlight.current === controller) inFlight.current = null;
      if (!controller.signal.aborted) setIsLoading(false);
    }
  };

  if (result) {
    const { catchUp, label } = result;
    return (
      <section aria-labelledby="catchup-heading" className={box}>
        <span className="text-xs font-medium text-[#B8A6FF]">Here&apos;s what you missed</span>
        <h3 id="catchup-heading" className="font-heading text-lg font-semibold text-[#F5F2FA]">
          {catchUp.headline}
        </h3>
        {catchUp.yourPart.length > 0 && (
          <div className="space-y-1.5 rounded-lg border-l-2 border-[#D5B45C] pl-3">
            <h4 className="text-xs font-medium text-[#D5B45C]">Your part</h4>
            <ul className="space-y-1 text-sm text-[#F5F2FA]">
              {catchUp.yourPart.map((action) => (
                <li key={action.text}>
                  {action.text}
                  {titleOf(action.relatedTaskId) && <span className="text-[#AAA5B4]"> · {titleOf(action.relatedTaskId)}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
        <List title="Decided" items={catchUp.decided} />
        <List title="What changed" items={catchUp.changed} />
        <List
          title="Who said they'd do what (until the team confirms)"
          items={catchUp.commitments.map((c) => [nameOf(c.memberId), c.text, c.due && `by ${c.due}`].filter(Boolean).join(" · "))}
        />
        <List title="Still open" items={catchUp.openQuestions} />
        {catchUp.missingInfo.length > 0 && (
          <p className="text-xs text-[#AAA5B4]">Not covered: {catchUp.missingInfo.join(" ")}</p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => setResult(null)} className={quiet}>
            Edit the notes
          </button>
          <span className="text-xs text-[#AAA5B4]/70">{label} · only from the notes and updates above</span>
        </div>
      </section>
    );
  }

  return (
    <form
      className={box}
      onSubmit={(e) => {
        e.preventDefault();
        void run();
      }}
    >
      <label htmlFor="meeting-notes" className="block space-y-1">
        <span className="font-heading text-sm font-semibold text-[#F5F2FA]">Missed it? Get caught up</span>
        <span className="block text-xs text-[#AAA5B4]">
          Paste whatever someone wrote down. Rough notes are fine. Without notes, nothing is reported as decided.
        </span>
      </label>
      <textarea
        id="meeting-notes"
        rows={3}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        maxLength={6000}
        disabled={isLoading}
        placeholder="e.g. agreed on the API contract; Oscar takes overlap logic; demo dry-run Friday"
        className="w-full rounded-xl border border-[#2A2E39] bg-[#171A23] px-3 py-2 text-sm text-[#F5F2FA] placeholder:text-[#AAA5B4]/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={isLoading} className={primary}>
          {isLoading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#0F1117]/30 border-t-[#0F1117]" />}
          {isLoading ? "Reading…" : "Catch me up"}
        </button>
        {error && (
          <p role="alert" className="text-sm text-[#D5B45C]">
            {error.message}{" "}
            {error.canDemo && (
              <button type="button" onClick={() => void run("demo")} className={quiet}>
                Show a simple summary (not AI)
              </button>
            )}
          </p>
        )}
      </div>
    </form>
  );
}

"use client";

import React, { useEffect, useRef, useState } from "react";
import type { Project, TaskStatus } from "@/types";
import { useProject } from "@/context/ProjectContext";
import { useCurrentMember } from "@/features/identity/useCurrentMember";
import type { ProgressInterpretation, ProgressUpdateRequest, ProgressUpdateResponse } from "./update-types";
import { primaryButton, quietButton, secondaryButton } from "./PlanFocus";

/**
 * Feature Owner: Divij Anand
 * "+ Update": students say what happened in their own words instead of
 * maintaining a board. Gemini proposes status changes; nothing changes until
 * they confirm. Never asks who they are twice: it uses the remembered identity.
 * Confirmed updates are shared with the team as meeting context.
 */

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "Not started",
  "in-progress": "In progress",
  blocked: "Waiting",
  done: "Done",
};

const fieldClass =
  "w-full rounded-xl bg-[#171A23] px-4 py-3 text-[#F5F2FA] placeholder:text-[#AAA5B4]/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]/60 disabled:opacity-60";

interface PlanQuickUpdateProps {
  project: Project;
  /** Start expanded (e.g. when opened from + Coordinate) instead of as "+ Update". */
  startOpen?: boolean;
  defaultText?: string;
}

export function PlanQuickUpdate({ project, startOpen = false, defaultText = "" }: PlanQuickUpdateProps) {
  const { updateTaskStatus, addAsyncUpdate } = useProject();
  const { member, setCurrentMember } = useCurrentMember();
  const [isOpen, setIsOpen] = useState(startOpen);
  const [text, setText] = useState(defaultText);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ interpretation: ProgressInterpretation; source: "gemini" | "demo" } | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const inFlight = useRef<AbortController | null>(null);

  useEffect(() => () => inFlight.current?.abort(), []);

  const titleById = new Map(project.tasks.map((t) => [t.id, t.title]));
  const statusById = new Map(project.tasks.map((t) => [t.id, t.status]));

  const submit = async (mode: "live" | "demo" = "live") => {
    if (inFlight.current || !text.trim()) return;
    const controller = new AbortController();
    inFlight.current = controller;
    setIsLoading(true);
    setError(null);
    setConfirmation(null);
    const body: ProgressUpdateRequest = {
      mode,
      project: { id: project.id, name: project.name, members: project.members.map(({ id, name }) => ({ id, name })) },
      tasks: project.tasks,
      text,
      authorId: member?.id,
    };
    try {
      const response = await fetch("/api/progress-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const data = (await response.json()) as ProgressUpdateResponse;
      if (data.ok) setResult({ interpretation: data.interpretation, source: data.source });
      else setError(data.error === "bad_request" && data.issues?.[0] ? data.issues[0] : data.message);
    } catch {
      if (!controller.signal.aborted) setError("Couldn't reach the update service.");
    } finally {
      if (inFlight.current === controller) inFlight.current = null;
      if (!controller.signal.aborted) setIsLoading(false);
    }
  };

  const confirm = () => {
    if (!result) return;
    const { changes } = result.interpretation;
    changes.forEach((change) => updateTaskStatus(change.taskId, change.status));
    if (member) {
      addAsyncUpdate({
        projectId: project.id,
        memberId: member.id,
        type: changes.some((c) => c.status === "blocked") ? "blocker" : "progress",
        content: text.trim(),
      });
    }
    setConfirmation(changes.length === 1 ? "✓ Updated · shared for the next meeting" : `✓ ${changes.length} steps updated · shared for the next meeting`);
    setResult(null);
    setText("");
    setIsOpen(false);
  };

  if (result) {
    const { interpretation, source } = result;
    return (
      <section aria-labelledby="update-heading" className="space-y-3 rounded-2xl bg-[#1A1D27] p-5">
        <h3 id="update-heading" className="font-heading text-lg font-semibold text-[#F5F2FA]">
          {interpretation.summary}
        </h3>
        {interpretation.changes.length > 0 && (
          <ul className="space-y-1 text-sm">
            {interpretation.changes.map((change) => (
              <li key={change.taskId}>
                <span className="text-[#F5F2FA]">{titleById.get(change.taskId)}</span>
                <span className="text-[#AAA5B4]"> · {STATUS_LABEL[statusById.get(change.taskId) ?? "todo"]} → </span>
                <span className="font-semibold text-[#B8A6FF]">{STATUS_LABEL[change.status]}</span>
              </li>
            ))}
          </ul>
        )}
        {interpretation.unmatched.length > 0 && (
          <p className="text-sm text-[#AAA5B4]">Couldn&apos;t match: {interpretation.unmatched.map((u) => `“${u}”`).join(", ")}</p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          {interpretation.changes.length > 0 ? (
            <>
              <button type="button" onClick={confirm} className={primaryButton}>
                Yes, update
              </button>
              <button type="button" onClick={() => setResult(null)} className={quietButton}>
                Not quite
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setResult(null)} className={primaryButton}>
              OK
            </button>
          )}
          <span className="text-xs text-[#AAA5B4]/70">{source === "gemini" ? "Gemini" : "Not AI"} · nothing changes until you confirm</span>
        </div>
      </section>
    );
  }

  if (!isOpen) {
    return (
      <div className="flex flex-wrap items-center gap-4">
        <button type="button" onClick={() => setIsOpen(true)} className={secondaryButton}>
          + Update
        </button>
        {confirmation && (
          <p role="status" className="text-sm text-[#7FD1A6]">
            {confirmation}
          </p>
        )}
      </div>
    );
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {!member && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-[#AAA5B4]">
          <span>You are</span>
          {project.members.map((m) => (
            <button key={m.id} type="button" onClick={() => setCurrentMember(m.id)} className={`${secondaryButton} px-3 py-1.5`}>
              {m.name.split(" ")[0]}
            </button>
          ))}
        </div>
      )}
      <textarea
        aria-label="What's new?"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        maxLength={1000}
        disabled={isLoading}
        autoFocus
        placeholder="What's new? e.g. finished the API, waiting on Ammar's UI"
        className={fieldClass}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={isLoading || !text.trim()} className={primaryButton}>
          {isLoading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#0F1117]/30 border-t-[#0F1117]" />}
          {isLoading ? "Reading…" : "Update"}
        </button>
        <button type="button" onClick={() => setIsOpen(false)} className={quietButton}>
          Cancel
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-[#D5B45C]">
          {error}{" "}
          <button type="button" onClick={() => void submit("demo")} className={quietButton}>
            Try simple matching
          </button>
        </p>
      )}
    </form>
  );
}

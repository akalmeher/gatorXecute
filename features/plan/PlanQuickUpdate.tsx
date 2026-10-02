"use client";

import React, { useEffect, useRef, useState } from "react";
import type { Project, TaskStatus } from "@/types";
import { useProject } from "@/context/ProjectContext";
import type { ProgressInterpretation, ProgressUpdateRequest, ProgressUpdateResponse } from "./update-types";

/**
 * Feature Owner: Divij Anand
 * "What's new?": students say what happened in their own words instead of
 * maintaining a board. Gemini proposes status changes; nothing changes until
 * they confirm. The update is also shared with the team as meeting context.
 */

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "Not started",
  "in-progress": "In progress",
  blocked: "Waiting",
  done: "Done",
};

const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[#B8A6FF] px-5 py-3 text-sm font-semibold text-[#0F1117] hover:bg-[#B8A6FF]/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F1117] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer transition-colors";
const quietButton =
  "inline-flex items-center rounded-lg px-2 py-1 text-sm text-[#AAA5B4] underline-offset-4 hover:text-[#F5F2FA] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]/60 cursor-pointer";
const fieldClass =
  "rounded-xl border border-[#2A2E39] bg-[#171A23] px-4 py-3 text-[#F5F2FA] placeholder:text-[#AAA5B4]/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]/60 disabled:opacity-60";

export function PlanQuickUpdate({ project }: { project: Project }) {
  const { updateTaskStatus, addAsyncUpdate } = useProject();
  const [text, setText] = useState("");
  const [authorId, setAuthorId] = useState("");
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
      authorId: authorId || undefined,
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
      else setError(data.issues?.[0] && data.error === "bad_request" ? data.issues[0] : data.message);
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
    if (authorId) {
      addAsyncUpdate({
        projectId: project.id,
        memberId: authorId,
        type: changes.some((c) => c.status === "blocked") ? "blocker" : "progress",
        content: text.trim(),
      });
    }
    setConfirmation(
      `${changes.length === 1 ? "1 step updated" : `${changes.length} steps updated`}.${
        authorId ? " Your note is shared with the team for the next meeting." : ""
      }`
    );
    setResult(null);
    setText("");
  };

  if (result) {
    const { interpretation, source } = result;
    return (
      <section aria-labelledby="update-heading" className="space-y-4 border-l-2 border-[#B8A6FF] pl-5">
        <h3 id="update-heading" className="font-heading text-lg font-semibold text-[#F5F2FA]">
          {interpretation.summary}
        </h3>
        {interpretation.changes.length > 0 && (
          <ul className="space-y-1.5">
            {interpretation.changes.map((change) => (
              <li key={change.taskId} className="text-sm">
                <span className="text-[#F5F2FA]">{titleById.get(change.taskId)}</span>
                <span className="text-[#AAA5B4]">: {STATUS_LABEL[statusById.get(change.taskId) ?? "todo"]} → </span>
                <span className="font-semibold text-[#B8A6FF]">{STATUS_LABEL[change.status]}</span>
                {change.because && <span className="block text-xs italic text-[#AAA5B4]">“{change.because}”</span>}
              </li>
            ))}
          </ul>
        )}
        {interpretation.unmatched.length > 0 && (
          <p className="text-sm text-[#AAA5B4]">
            I couldn&apos;t match: {interpretation.unmatched.map((u) => `“${u}”`).join(", ")}. You can change those on the
            Work tab.
          </p>
        )}
        <p className="text-xs text-[#AAA5B4]">
          {source === "gemini" ? "Read by Gemini." : "Demo mode, not Gemini."} Nothing changes until you confirm.
        </p>
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
        </div>
      </section>
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
      <label htmlFor="whats-new" className="block font-heading text-lg font-semibold text-[#F5F2FA]">
        What&apos;s new?
      </label>
      <textarea
        id="whats-new"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setConfirmation(null);
        }}
        rows={2}
        maxLength={1000}
        disabled={isLoading}
        placeholder="e.g. finished the research btw, still waiting on Maya's sources"
        className={`${fieldClass} w-full max-w-2xl`}
      />
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-[#AAA5B4]">
          From
          <select
            value={authorId}
            onChange={(e) => setAuthorId(e.target.value)}
            disabled={isLoading}
            className={`${fieldClass} py-2 text-sm cursor-pointer`}
          >
            <option value="">Choose your name</option>
            {project.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={isLoading || !text.trim()} className={primaryButton}>
          {isLoading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#0F1117]/30 border-t-[#0F1117]" />}
          {isLoading ? "Reading…" : "Update the plan"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-[#D5B45C]">
          {error}{" "}
          <button type="button" onClick={() => void submit("demo")} className={quietButton}>
            Try simple matching instead
          </button>
        </p>
      )}
      {confirmation && (
        <p role="status" className="text-sm text-[#F5F2FA]">
          ✓ {confirmation}
        </p>
      )}
    </form>
  );
}

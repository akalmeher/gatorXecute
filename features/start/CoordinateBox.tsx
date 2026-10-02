"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import type { Project } from "@/types";
import type { CoordinateIntent, CoordinateResponse, CoordinateResult } from "@/features/ai/coordinate-types";
import { encodePoll } from "@/features/meet/meet-link";
import { PlanQuickUpdate } from "@/features/plan/PlanQuickUpdate";
import { primaryButton, quietButton } from "@/features/plan/PlanFocus";
import { modelLabel } from "@/features/ai/model-label";
import type { ShareCheck } from "@/features/ai/share-check-types";
import type { ReplanRequest } from "@/features/plan/replan-types";
import { mentionsPersonal } from "@/features/ai/care";
import { useCurrentMember } from "@/features/identity/useCurrentMember";
import { useShareCheck } from "@/features/care/useShareCheck";
import { SupportNote } from "@/features/care/SupportNote";

/**
 * Feature Owner: Divij Anand
 * "+ Coordinate": one box instead of a feature menu. Gemini infers the workflow
 * from what the student types; the box offers the one next step, and the guess
 * is always correctable. Personal messages are checked first: support is
 * offered, and replanning only ever sees the discreet version.
 */

interface CoordinateBoxProps {
  project: Project;
  /** Route "we're behind / someone is out" into the replanning flow on this page. */
  onHelp: (concern: string, away?: ReplanRequest["away"]) => void;
}

export function CoordinateBox({ project, onHelp }: CoordinateBoxProps) {
  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CoordinateResult | null>(null);
  const [answeredBy, setAnsweredBy] = useState<string>("");
  const [submitted, setSubmitted] = useState("");
  const [care, setCare] = useState<ShareCheck | null>(null);
  const busy = useRef(false);
  const { member } = useCurrentMember();
  const shareCheck = useShareCheck();

  const submit = async () => {
    if (busy.current || !text.trim()) return;
    busy.current = true;
    setIsLoading(true);
    setError(null);
    setCare(null);
    // Only personal-sounding messages need the extra check; it runs alongside.
    const careCheck = mentionsPersonal(text) ? shareCheck(text, member?.name ?? "A teammate") : Promise.resolve(null);
    try {
      const response = await fetch("/api/coordinate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, knownPeople: project.members.map((m) => m.name) }),
      });
      const data = (await response.json()) as CoordinateResponse;
      setCare(await careCheck);
      if (data.ok) {
        setSubmitted(text.trim());
        setResult(data.result);
        setAnsweredBy(modelLabel(data.model, data.source));
      } else {
        setError(data.message);
      }
    } catch {
      setCare(await careCheck);
      setError("Couldn't reach the server.");
    } finally {
      busy.current = false;
      setIsLoading(false);
    }
  };

  const choose = (intent: CoordinateIntent) => setResult((prev) => (prev ? { ...prev, intent } : prev));
  const reset = () => {
    setResult(null);
    setCare(null);
    setText("");
  };

  const askForHelp = () => {
    if (!care?.personal) return onHelp(submitted);
    // Teammates (and the plan) see the effect on the work, never the reason.
    const away = member && care.awayFrom && care.awayTo ? { memberId: member.id, from: care.awayFrom, to: care.awayTo } : undefined;
    onHelp(care.shareable, away);
  };

  const meetHref = () =>
    `/meet#${encodePoll({ title: result?.title || submitted.slice(0, 60), durationMinutes: result?.durationMinutes || 60, people: [] })}`;

  return (
    <section id="coordinate" aria-label="Coordinate something" className="scroll-mt-20 space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="flex items-center gap-2 rounded-2xl bg-[#171A23] p-2 pl-4 focus-within:ring-2 focus-within:ring-[#B8A6FF]/50"
      >
        <span aria-hidden className="text-lg text-[#B8A6FF]">+</span>
        <input
          aria-label="What needs coordinating?"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          disabled={isLoading}
          placeholder="Coordinate something… e.g. meet Maya about our Cinema presentation"
          className="min-w-0 flex-1 bg-transparent py-2 text-[#F5F2FA] placeholder:text-[#AAA5B4]/70 focus:outline-none"
        />
        <button type="submit" disabled={isLoading || !text.trim()} className={`${primaryButton} shrink-0`}>
          {isLoading ? "…" : "Go"}
        </button>
      </form>

      {error && (
        <p role="alert" className="text-sm text-[#D5B45C]">
          {error}
        </p>
      )}

      {care?.wellbeing === "crisis" && <SupportNote wellbeing="crisis" acknowledgement={care.acknowledgement} />}

      {result && (
        <div className="space-y-3 pl-1">
          {care && care.wellbeing !== "crisis" && <SupportNote wellbeing={care.wellbeing} acknowledgement={care.acknowledgement} />}
          <p className="text-[#F5F2FA]">
            {result.reply} <span className="text-xs text-[#AAA5B4]/70">· {answeredBy}</span>
          </p>
          {result.intent === "meet" && (
            <Link href={meetHref()} className={primaryButton}>
              Find a time →
            </Link>
          )}
          {result.intent === "project" && (
            <Link href="/plan" className={primaryButton}>
              Start from the assignment →
            </Link>
          )}
          {result.intent === "help" && care?.personal && (
            <p className="text-sm text-[#AAA5B4]">
              The plan will only know: “{care.shareable}”
            </p>
          )}
          {result.intent === "help" && (
            <button
              type="button"
              onClick={() => {
                askForHelp();
                reset();
              }}
              className={primaryButton}
            >
              Find a way forward
            </button>
          )}
          {result.intent === "update" && <PlanQuickUpdate key={submitted} project={project} startOpen defaultText={submitted} />}
          <p className="text-xs text-[#AAA5B4]">
            Not quite?{" "}
            {(["meet", "project", "update", "help"] as const)
              .filter((intent) => intent !== result.intent)
              .map((intent) => (
                <button key={intent} type="button" onClick={() => choose(intent)} className={`${quietButton} text-xs`}>
                  {{ meet: "Find a time", project: "Plan a project", update: "Post an update", help: "We're behind" }[intent]}
                </button>
              ))}
            <button type="button" onClick={reset} className={`${quietButton} text-xs`}>
              Clear
            </button>
          </p>
        </div>
      )}
    </section>
  );
}

"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import type { Project } from "@/types";
import type { CoordinateIntent, CoordinateResponse, CoordinateResult } from "@/features/ai/coordinate-types";
import { encodePoll } from "@/features/meet/meet-link";
import { PlanQuickUpdate } from "@/features/plan/PlanQuickUpdate";
import { primaryButton, quietButton } from "@/features/plan/PlanFocus";

/**
 * Feature Owner: Divij Anand
 * "+ Coordinate": one box instead of a feature menu. Gemini infers the workflow
 * from what the student types; the box offers the one next step, and the guess
 * is always correctable.
 */

interface CoordinateBoxProps {
  project: Project;
  /** Route "we're behind / someone is out" into the replanning flow on this page. */
  onHelp: (concern: string) => void;
}

export function CoordinateBox({ project, onHelp }: CoordinateBoxProps) {
  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CoordinateResult | null>(null);
  const [submitted, setSubmitted] = useState("");
  const busy = useRef(false);

  const submit = async () => {
    if (busy.current || !text.trim()) return;
    busy.current = true;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/coordinate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, knownPeople: project.members.map((m) => m.name) }),
      });
      const data = (await response.json()) as CoordinateResponse;
      if (data.ok) {
        setSubmitted(text.trim());
        setResult(data.result);
      } else {
        setError(data.message);
      }
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      busy.current = false;
      setIsLoading(false);
    }
  };

  const choose = (intent: CoordinateIntent) => setResult((prev) => (prev ? { ...prev, intent } : prev));
  const reset = () => {
    setResult(null);
    setText("");
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

      {result && (
        <div className="space-y-3 pl-1">
          <p className="text-[#F5F2FA]">{result.reply}</p>
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
          {result.intent === "help" && (
            <button
              type="button"
              onClick={() => {
                onHelp(submitted);
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

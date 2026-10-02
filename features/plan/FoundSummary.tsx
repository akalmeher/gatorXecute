"use client";

import React from "react";
import type { PlanUnderstanding, WorkKind } from "./plan-types";
import { formatDay } from "./plan-display";

/**
 * Feature Owner: Divij Anand
 * "Got it. Here's what I found": what Gemini understood from the assignment,
 * shown before the plan so students can check it at a glance.
 */

const KIND_LABEL: Record<WorkKind, string> = {
  presentation: "a presentation",
  paper: "a paper",
  creative: "a creative project",
  study: "studying for an exam",
  lab: "a lab",
  software: "a software project",
  other: "a group project",
};

interface FoundSummaryProps {
  understanding: PlanUnderstanding;
  /** The project page deadline as YYYY-MM-DD, to flag a mismatch. */
  projectDeadline?: string;
}

export function FoundSummary({ understanding, projectDeadline }: FoundSummaryProps) {
  const { deliverables, milestones, finalDeadline } = understanding;
  const earlier = finalDeadline && projectDeadline && finalDeadline < projectDeadline;

  return (
    <div className="space-y-4">
      <p className="text-lg text-[#F5F2FA]/90">
        Looks like {KIND_LABEL[understanding.kind]}. {understanding.summary}
      </p>

      <dl className="grid gap-x-10 gap-y-4 sm:grid-cols-2">
        {deliverables.length > 0 && (
          <div>
            <dt className="text-sm text-[#AAA5B4]">
              {deliverables.length === 1 ? "1 thing to hand in" : `${deliverables.length} things to hand in`}
            </dt>
            <dd>
              <ul className="mt-1 space-y-1 text-[#F5F2FA]">
                {deliverables.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span aria-hidden className="text-[#B8A6FF]">·</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        )}
        {(milestones.length > 0 || finalDeadline) && (
          <div>
            <dt className="text-sm text-[#AAA5B4]">Key dates</dt>
            <dd>
              <ul className="mt-1 space-y-1 text-[#F5F2FA]">
                {milestones.map((m) => (
                  <li key={m.title} className="flex gap-2">
                    <span aria-hidden className="text-[#B8A6FF]">·</span>
                    <span>
                      {m.title}
                      {m.date && <span className="text-[#AAA5B4]"> · {formatDay(m.date)}</span>}
                    </span>
                  </li>
                ))}
                {finalDeadline && (
                  <li className="flex gap-2 font-semibold">
                    <span aria-hidden className="text-[#D5B45C]">★</span>
                    <span>Final deadline · {formatDay(finalDeadline)}</span>
                  </li>
                )}
              </ul>
            </dd>
          </div>
        )}
      </dl>

      {earlier && (
        <p className="text-sm text-[#AAA5B4]">
          Your project page says {formatDay(projectDeadline)}, but the assignment says {formatDay(finalDeadline)}. I planned
          for the earlier date. Update the project deadline if that&apos;s wrong.
        </p>
      )}
    </div>
  );
}

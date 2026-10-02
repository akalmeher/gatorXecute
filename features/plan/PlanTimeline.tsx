"use client";

import React from "react";
import {
  type PlanStep,
  type StepState,
  STEP_STATE_LABEL,
  describeWaitingOn,
  firstName,
  formatDay,
  formatEffort,
} from "./plan-display";

/**
 * Feature Owner: Divij Anand
 * "Here's what needs to happen": the plan as a simple vertical timeline.
 * State is shown by marker shape and a text label, never by color alone.
 */

const MARKER: Record<StepState, { symbol: string; className: string }> = {
  done: { symbol: "✓", className: "bg-[#B8A6FF] text-[#0F1117] border-[#B8A6FF]" },
  doing: { symbol: "●", className: "bg-[#171A23] text-[#B8A6FF] border-[#B8A6FF]" },
  waiting: { symbol: "‖", className: "bg-[#171A23] text-[#D5B45C] border-[#D5B45C]" },
  ready: { symbol: "○", className: "bg-[#171A23] text-[#F5F2FA] border-[#AAA5B4]" },
  later: { symbol: "○", className: "bg-[#171A23] text-[#AAA5B4]/70 border-[#2A2E39]" },
};

interface PlanTimelineProps {
  steps: PlanStep[];
  /** Show the one-line reason each person was suggested (useful when reviewing a draft). */
  showReasons?: boolean;
}

export function PlanTimeline({ steps, showReasons }: PlanTimelineProps) {
  return (
    <ol className="relative">
      {steps.map((step, index) => {
        const marker = MARKER[step.state];
        const isLast = index === steps.length - 1;
        const owner = firstName(step.owner);
        const due = formatDay(step.task.dueDate);
        const effort = formatEffort(step.task.estimatedMinutes);

        return (
          <li key={step.task.id} className="relative flex gap-4 sm:gap-5 pb-7 last:pb-0">
            {!isLast && (
              <span aria-hidden className="absolute left-[15px] top-9 bottom-1 w-px bg-[#2A2E39]" />
            )}
            <span
              aria-hidden
              className={`relative z-10 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold ${marker.className}`}
            >
              {marker.symbol}
            </span>

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3
                  className={`font-heading text-lg font-semibold leading-snug ${
                    step.state === "done" ? "text-[#AAA5B4] line-through decoration-[#AAA5B4]/50" : "text-[#F5F2FA]"
                  }`}
                >
                  {step.task.title}
                </h3>
                <span
                  className={`text-xs font-medium ${
                    step.state === "waiting" ? "text-[#D5B45C]" : step.state === "later" ? "text-[#AAA5B4]/70" : "text-[#B8A6FF]"
                  }`}
                >
                  {STEP_STATE_LABEL[step.state]}
                </span>
              </div>

              <p className="text-sm text-[#AAA5B4]">
                {[owner ?? "No one yet", due && `due ${due}`, effort].filter(Boolean).join(" · ")}
              </p>

              {step.waitingOn.length > 0 && step.state !== "done" && (
                <p className="text-sm text-[#AAA5B4]">
                  Starts after <span className="text-[#F5F2FA]">{describeWaitingOn(step.waitingOn).text}</span>.
                </p>
              )}

              {showReasons && step.task.assignmentReason && (
                <p className="text-xs italic text-[#AAA5B4]/80">{step.task.assignmentReason}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

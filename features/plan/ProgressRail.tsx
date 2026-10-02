"use client";

import React from "react";
import type { PlanStep } from "./plan-display";
import { formatDay } from "./plan-display";

/**
 * Feature Owner: Divij Anand
 * The whole plan at a glance: ✓ done, ● now, ○ later, ★ deadline.
 * Shape and label carry the state, not color alone.
 */

export function ProgressRail({ steps, deadline }: { steps: PlanStep[]; deadline?: string }) {
  const done = steps.filter((s) => s.state === "done").length;
  const nowIndex = steps.findIndex((s) => s.state === "doing" || s.state === "ready");

  return (
    <div className="space-y-2" aria-label={`${done} of ${steps.length} steps done`}>
      <ol className="flex items-center">
        {steps.map((step, i) => {
          const isDone = step.state === "done";
          const isNow = i === nowIndex;
          return (
            <li key={step.task.id} className="flex flex-1 items-center" title={step.task.title}>
              <span
                aria-hidden
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition ${
                  isDone
                    ? "bg-[#B8A6FF] text-[#0F1117]"
                    : isNow
                      ? "bg-[#0F1117] text-[#B8A6FF] ring-2 ring-[#B8A6FF] ring-offset-2 ring-offset-[#0F1117]"
                      : step.state === "waiting"
                        ? "bg-[#1D202A] text-[#D5B45C]"
                        : "bg-[#1D202A] text-[#AAA5B4]"
                }`}
              >
                {isDone ? "✓" : step.state === "waiting" ? "‖" : isNow ? "●" : ""}
              </span>
              <span aria-hidden className={`h-0.5 flex-1 ${isDone ? "bg-[#B8A6FF]/60" : "bg-[#2A2E39]"}`} />
            </li>
          );
        })}
        <li className="shrink-0" title="Deadline">
          <span aria-hidden className="flex h-6 w-6 items-center justify-center text-[#D5B45C]">★</span>
        </li>
      </ol>
      <div className="flex justify-between text-sm text-[#AAA5B4]">
        <span>
          <span className="font-semibold text-[#F5F2FA]">{done}</span> of {steps.length} done
        </span>
        {deadline && <span>Due {formatDay(deadline)}</span>}
      </div>
    </div>
  );
}

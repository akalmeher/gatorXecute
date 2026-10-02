"use client";

import React from "react";
import type { PlanStep } from "./plan-display";
import { formatDay } from "./plan-display";

/**
 * Feature Owner: Divij Anand
 * The whole plan at a glance:
 * - Color gradient progression: Dull purple -> Radiant Royal Bright Purple -> SFSU Gold.
 * - Star Milestone: Scales up, spins, and twinkles with sparkles when all tasks are achieved.
 * - Shape and label carry state, not color alone (✓ done, ● now, ‖ waiting, ○ later).
 */

interface NodeStyle {
  rgb: string;
  background: string;
  textColor: string;
  boxShadow: string;
}

function getNodeColor(index: number, total: number): NodeStyle {
  const t = total <= 1 ? 1 : Math.min(1, Math.max(0, index / (total - 1)));

  // Interpolate RGB from dull deep purple (91, 69, 130) to royal bright purple (196, 181, 253)
  const r = Math.round(91 + (196 - 91) * t);
  const g = Math.round(69 + (181 - 69) * t);
  const b = Math.round(130 + (253 - 130) * t);

  // Subtle diagonal shift for tactile depth
  const r2 = Math.min(255, Math.round(r + 16));
  const g2 = Math.min(255, Math.round(g + 16));
  const b2 = Math.min(255, Math.round(b + 18));

  // Contrast text color
  const textColor = t > 0.45 ? "#0F1117" : "#F5F2FA";
  const glowAlpha = (0.28 + 0.45 * t).toFixed(2);
  const glowSize = Math.round(6 + 10 * t);

  return {
    rgb: `rgb(${r}, ${g}, ${b})`,
    background: `linear-gradient(135deg, rgb(${r}, ${g}, ${b}) 0%, rgb(${r2}, ${g2}, ${b2}) 100%)`,
    textColor,
    boxShadow: `0 0 ${glowSize}px rgba(${r}, ${g}, ${b}, ${glowAlpha})`,
  };
}

export function ProgressRail({ steps, deadline }: { steps: PlanStep[]; deadline?: string }) {
  const total = steps.length;
  const done = steps.filter((s) => s.state === "done").length;
  const allDone = total > 0 && done === total;
  const nowIndex = steps.findIndex((s) => s.state === "doing" || s.state === "ready");

  return (
    <div
      className="space-y-2.5 rounded-2xl border border-[#2A2E39] bg-[#161820]/70 p-4 backdrop-blur-md transition-all duration-500"
      aria-label={`${done} of ${total} steps done${allDone ? ", all milestones completed" : ""}`}
    >
      <ol className="flex items-center">
        {steps.map((step, i) => {
          const isDone = step.state === "done";
          const isNow = i === nowIndex;
          const nodeColor = getNodeColor(i, total);

          // Calculate line style to next node or milestone
          let lineStyle: React.CSSProperties = { background: "#2A2E39" };
          let isPulseBeam = false;

          if (isDone) {
            if (i < total - 1) {
              const nextIsDone = steps[i + 1]?.state === "done";
              const nextIsNow = i + 1 === nowIndex;
              const nextColor = getNodeColor(i + 1, total);

              if (nextIsDone) {
                lineStyle = {
                  background: `linear-gradient(to right, ${nodeColor.rgb}, ${nextColor.rgb})`,
                  boxShadow: `0 0 6px ${nodeColor.rgb}40`,
                };
              } else if (nextIsNow) {
                lineStyle = {
                  background: `linear-gradient(to right, ${nodeColor.rgb}, rgba(184, 166, 255, 0.45))`,
                };
              } else {
                lineStyle = {
                  background: `linear-gradient(to right, ${nodeColor.rgb}, #2A2E39)`,
                };
              }
            } else {
              // Final segment leading to the milestone star
              if (allDone) {
                lineStyle = {
                  background: `linear-gradient(to right, ${nodeColor.rgb}, #D5B45C)`,
                  boxShadow: "0 0 8px rgba(213, 180, 92, 0.5)",
                };
                isPulseBeam = true;
              } else {
                lineStyle = {
                  background: `linear-gradient(to right, ${nodeColor.rgb}, #2A2E39)`,
                };
              }
            }
          }

          return (
            <li
              key={step.task.id}
              className="flex flex-1 items-center"
              title={`${step.task.title} (${isDone ? "Done" : isNow ? "Current" : step.state})`}
            >
              {/* Step Node */}
              <span
                aria-hidden
                style={
                  isDone
                    ? {
                        background: nodeColor.background,
                        color: nodeColor.textColor,
                        boxShadow: nodeColor.boxShadow,
                      }
                    : undefined
                }
                className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${
                  isDone
                    ? "font-extrabold"
                    : isNow
                      ? "bg-[#0F1117] text-[#B8A6FF] ring-2 ring-[#B8A6FF] ring-offset-2 ring-offset-[#0F1117] animate-pulse"
                      : step.state === "waiting"
                        ? "bg-[#1D202A] text-[#D5B45C] border border-[#D5B45C]/40"
                        : "bg-[#1D202A] text-[#AAA5B4] border border-[#2A2E39]"
                }`}
              >
                {isDone ? "✓" : step.state === "waiting" ? "‖" : isNow ? "●" : ""}
              </span>

              {/* Connecting Track Segment */}
              <span
                aria-hidden
                style={lineStyle}
                className={`h-1 flex-1 rounded-full mx-1 transition-all duration-500 ${
                  isPulseBeam ? "rail-beam-pulse" : ""
                }`}
              />
            </li>
          );
        })}

        {/* Milestone Star */}
        <li
          className="relative shrink-0 flex items-center justify-center"
          title={allDone ? "🎉 Milestone Achieved! All steps completed!" : deadline ? `Milestone: Due ${formatDay(deadline)}` : "Milestone Target"}
        >
          <div
            className={`relative flex items-center justify-center transition-transform duration-700 ${
              allDone ? "scale-125 sm:scale-135 z-10" : ""
            }`}
          >
            {/* Orbiting Sparkles and Celebration Halo when allDone */}
            {allDone && (
              <>
                {/* Twinkling sparkle 1 - top left (Gold) */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute -top-3.5 -left-3 sparkle-twinkle-1 text-[#FFE082]"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
                  </svg>
                </span>

                {/* Twinkling sparkle 2 - top right (Electric Purple) */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute -top-4 -right-3.5 sparkle-twinkle-2 text-[#C4B5FD]"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
                  </svg>
                </span>

                {/* Twinkling sparkle 3 - bottom right (SFSU Gold) */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute -bottom-3 -right-3.5 sparkle-twinkle-3 text-[#D5B45C]"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
                  </svg>
                </span>

                {/* Ambient halo glow */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-r from-[#D5B45C]/35 to-[#C4B5FD]/35 blur-md animate-ping opacity-60"
                />
              </>
            )}

            {/* The Star Element */}
            <span
              aria-hidden
              className={`flex h-9 w-9 items-center justify-center rounded-full transition-all duration-500 shadow-md ${
                allDone
                  ? "star-spin-twinkle bg-gradient-to-tr from-[#D5B45C] via-[#FFE082] to-[#FFF3B0] text-[#0F1117] ring-2 ring-[#FFE082]/90 ring-offset-2 ring-offset-[#0F1117]"
                  : "bg-[#1D202A] text-[#D5B45C] border border-[#D5B45C]/40 hover:border-[#D5B45C] hover:scale-105"
              }`}
            >
              <svg
                className={`h-5 w-5 ${allDone ? "fill-[#0F1117] drop-shadow-sm" : "fill-current"}`}
                viewBox="0 0 24 24"
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </span>
          </div>
        </li>
      </ol>

      {/* Progress & Milestone Label */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[#AAA5B4] pt-1">
        <div className="flex items-center gap-2">
          {allDone ? (
            <span className="inline-flex items-center gap-1.5 font-semibold text-[#D5B45C] animate-fade-in">
              <span className="text-base" aria-hidden>🎉</span>
              <span>All {done} of {total} steps achieved! Milestone unlocked!</span>
            </span>
          ) : (
            <span>
              <span className="font-semibold text-[#F5F2FA]">{done}</span> of {total} done
            </span>
          )}
        </div>
        {deadline && (
          <span className={allDone ? "text-[#C4B5FD] font-medium" : "text-[#AAA5B4]"}>
            {allDone ? `Achieved for ${formatDay(deadline)}` : `Due ${formatDay(deadline)}`}
          </span>
        )}
      </div>
    </div>
  );
}

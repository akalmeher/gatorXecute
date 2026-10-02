"use client";

import React from "react";
import { useProject } from "@/context/ProjectContext";

/**
 * Feature Owner: Oscar Garcia
 * Domain: Availability interface, schedule intersection, deterministic overlap algorithm.
 * Note: Lightweight placeholder establishing shared interfaces for the MVP demo foundation.
 */
export function AvailabilityView() {
  const { project } = useProject();

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-zinc-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-indigo-500/10 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
              Deterministic Scheduling
            </span>
            <span className="text-xs text-zinc-500 font-mono">
              Feature Owner: Oscar Garcia
            </span>
          </div>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-zinc-900">
            Find Optimal Meeting Time
          </h2>
          <p className="text-xs text-zinc-500">
            Deterministic calendar intersection algorithm (no LLM required for slot math).
          </p>
        </div>

        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
          ✓ Optimal Overlap Found: <strong>Thu 3:30 PM – 4:15 PM</strong>
        </div>
      </div>

      {/* Member Availability Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        {project.members.map((member) => {
          const blocks = project.availability.filter((a) => a.memberId === member.id);

          return (
            <div
              key={member.id}
              className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-3 text-xs"
            >
              <div className="flex items-center gap-2 mb-2 font-semibold text-zinc-900">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--gator-purple)] text-white text-[10px]">
                  {member.initials}
                </span>
                <span>{member.name.split(" ")[0]}</span>
              </div>

              <div className="space-y-1 text-zinc-600">
                {blocks.map((block) => (
                  <div key={block.id} className="flex justify-between text-[11px]">
                    <span className="font-medium text-zinc-700">{block.dayOfWeek}</span>
                    <span>
                      {block.startTime} – {block.endTime}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

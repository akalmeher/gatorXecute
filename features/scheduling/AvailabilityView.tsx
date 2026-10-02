"use client";

import React from "react";
import { useProject } from "@/context/ProjectContext";

/**
 * Feature Owner: Oscar Garcia
 * Domain: Availability interface, schedule intersection, deterministic overlap algorithm.
 * Note: Workspace view for locating optimal team meeting windows without manual coordination.
 */
export function AvailabilityView() {
  const { project } = useProject();

  return (
    <div className="rounded-2xl border border-[#2A2E39] bg-[#171A23] p-6 sm:p-8 space-y-6">
      {/* Best Meeting Time Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#2A2E39] pb-6">
        <div className="space-y-1">
          <h2 className="font-heading text-2xl font-bold tracking-tight text-[#F5F2FA]">
            Find a time everyone can meet
          </h2>
          <p className="text-sm text-[#AAA5B4]">
            Optimal time window based on everyone&apos;s open blocks this week.
          </p>
        </div>

        {/* Highlighted best time */}
        <div className="rounded-xl border border-[#D5B45C]/40 bg-[#D5B45C]/10 px-4 py-3 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#D5B45C]/20 text-[#D5B45C] text-sm">
            📅
          </div>
          <div>
            <div className="text-[11px] font-medium text-[#D5B45C] leading-none">
              Best time for everyone
            </div>
            <div className="font-heading text-base font-bold text-[#F5F2FA] mt-0.5">
              Thursday • 3:30 PM – 4:15 PM
            </div>
          </div>
        </div>
      </div>

      {/* Member Availability Overview */}
      <div className="space-y-3">
        <span className="text-xs font-medium text-[#AAA5B4]">
          Team availability windows
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {project.members.map((member) => {
            const blocks = project.availability.filter((a) => a.memberId === member.id);

            return (
              <div
                key={member.id}
                className="rounded-xl border border-[#2A2E39] bg-[#1D202A] p-4 space-y-2.5"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#171A23] border border-[#2A2E39] font-heading text-[#B8A6FF] text-xs font-bold">
                    {member.initials}
                  </div>
                  <span className="font-heading text-sm font-semibold text-[#F5F2FA]">
                    {member.name.split(" ")[0]}
                  </span>
                </div>

                <div className="space-y-1 text-xs text-[#AAA5B4]">
                  {blocks.map((block) => (
                    <div key={block.id} className="flex justify-between text-xs">
                      <span className="text-[#F5F2FA] font-medium">{block.dayOfWeek}</span>
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
    </div>
  );
}

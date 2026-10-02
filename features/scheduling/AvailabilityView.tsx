"use client";

import React, { useState } from "react";

import { useProject } from "@/context/ProjectContext";
import { AvailabilityGrid } from "./AvailabilityGrid";

/**
 * Feature Owner: Oscar Garcia
 * Domain: Availability interface, schedule intersection,
 * deterministic overlap display.
 *
 * This view lets the user:
 * - see each teammate's current availability
 * - choose which teammate to edit
 * - update availability with the interactive calendar
 * - view team overlap in the same calendar
 */
export function AvailabilityView() {
  const {
    project,
    updateMemberAvailability,
  } = useProject();

  /*
   * Start by editing the first teammate in the project.
   */
  const [selectedMemberId, setSelectedMemberId] =
    useState(project.members[0]?.id ?? "");

  /*
   * Find the currently selected teammate.
   */
  const selectedMember =
    project.members.find(
      (member) =>
        member.id === selectedMemberId
    );

  /*
   * Get only the selected teammate's
   * current availability blocks.
   */
  const selectedMemberBlocks =
    project.availability.filter(
      (block) =>
        block.memberId === selectedMemberId
    );

  return (
    <div className="rounded-2xl border border-[#2A2E39] bg-[#171A23] p-6 sm:p-8 space-y-6">

      {/* Page heading */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#2A2E39] pb-6">

        <div className="space-y-1">
          <h2 className="font-heading text-2xl font-bold tracking-tight text-[#F5F2FA]">
            Find a time everyone can meet
          </h2>

          <p className="text-sm text-[#AAA5B4]">
            View the team&apos;s availability and update
            each teammate&apos;s open time blocks.
          </p>
        </div>

        {/* Demo scheduling banner */}
        <div className="rounded-xl border border-[#D5B45C]/40 bg-[#D5B45C]/10 px-4 py-3 flex items-center gap-3">

          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#D5B45C]/20 text-[#D5B45C] text-sm">
            📅
          </div>

          <div>
            <div className="text-[11px] font-medium text-[#D5B45C] leading-none">
              Example meeting opportunity
            </div>

            <div className="font-heading text-base font-bold text-[#F5F2FA] mt-0.5">
              Thursday • 3:30 PM – 4:15 PM
            </div>
          </div>
        </div>
      </div>


      {/* Team availability summary cards */}
      <div className="space-y-3">

        <span className="text-xs font-medium text-[#AAA5B4]">
          Team availability windows
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">

          {project.members.map((member) => {
            /*
             * Find all availability blocks
             * belonging to this teammate.
             */
            const blocks =
              project.availability.filter(
                (block) =>
                  block.memberId === member.id
              );

            return (
              <div
                key={member.id}
                className="rounded-xl border border-[#2A2E39] bg-[#1D202A] p-4 space-y-2.5"
              >

                {/* Teammate name */}
                <div className="flex items-center gap-2.5">

                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#171A23] border border-[#2A2E39] font-heading text-[#B8A6FF] text-xs font-bold">
                    {member.initials}
                  </div>

                  <span className="font-heading text-sm font-semibold text-[#F5F2FA]">
                    {member.name.split(" ")[0]}
                  </span>
                </div>


                {/* Availability blocks */}
                <div className="space-y-1 text-xs text-[#AAA5B4]">

                  {blocks.length > 0 ? (
                    blocks.map((block) => (
                      <div
                        key={block.id}
                        className="flex justify-between gap-3 text-xs"
                      >

                        <span className="text-[#F5F2FA] font-medium">
                          {block.dayOfWeek}
                        </span>

                        <span>
                          {block.startTime} – {block.endTime}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-[#6F6A79]">
                      No availability added
                    </div>
                  )}
                </div>
              </div>
            );
          })}

        </div>
      </div>


      {/* Interactive calendar section */}
      <div className="border-t border-[#2A2E39] pt-6 space-y-4">

        {/* Teammate selector */}
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">

          <div className="space-y-1">

            <label
              htmlFor="availability-member"
              className="block text-xs font-medium text-[#AAA5B4]"
            >
              Editing availability for
            </label>

            <select
              id="availability-member"
              value={selectedMemberId}
              onChange={(event) =>
                setSelectedMemberId(
                  event.target.value
                )
              }
              className="
                rounded-lg
                border border-[#2A2E39]
                bg-[#1D202A]
                px-3 py-2
                text-sm
                text-[#F5F2FA]
                focus:outline-none
                focus:ring-2
                focus:ring-[#B8A6FF]
              "
            >

              {project.members.map((member) => (
                <option
                  key={member.id}
                  value={member.id}
                >
                  {member.name}
                </option>
              ))}

            </select>
          </div>


          {selectedMember && (
            <div className="text-xs text-[#AAA5B4] pb-2">
              Changes update the team schedule immediately
              during this session.
            </div>
          )}
        </div>


        {/* Combined editable + overlap calendar */}
        {selectedMemberId && (
          <AvailabilityGrid
            memberId={selectedMemberId}
            blocks={selectedMemberBlocks}
            members={project.members}
            allAvailability={
              project.availability
            }
            onChange={(blocks) =>
              updateMemberAvailability(
                selectedMemberId,
                blocks
              )
            }
          />
        )}

      </div>
    </div>
  );
}
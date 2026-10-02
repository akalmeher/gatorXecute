"use client";

import React, { useEffect, useState } from "react";

import type {
    AvailabilityBlock,
    Member,
} from "@/types";

import {
    DAYS,
    TIME_SLOTS,
    SLOT_MINUTES,
    formatTime,
    timeToMinutes,
    blocksToCells,
    cellsToBlocks,
} from "./scheduling-utils";


/*
 * Information this calendar needs from AvailabilityView.
 */
interface AvailabilityGridProps {
    // The teammate currently being edited.
    memberId: string;

    // That teammate's existing availability.
    blocks: AvailabilityBlock[];

    // Everyone on the team.
    members: Member[];

    // Availability belonging to the entire team.
    allAvailability: AvailabilityBlock[];

    // Saves changes back into ProjectContext.
    onChange: (
        blocks: AvailabilityBlock[]
    ) => void;
}


/*
 * During a drag, we are either:
 *
 * add    = painting availability
 * remove = erasing availability
 */
type DragMode = "add" | "remove";


export function AvailabilityGrid({
    memberId,
    blocks,
    members,
    allAvailability,
    onChange,
}: AvailabilityGridProps) {
    /*
     * Store the selected 30-minute squares.
     *
     * Example:
     *
     * Mon-09:00
     * Mon-09:30
     * Thu-14:00
     */
    const [selectedCells, setSelectedCells] =
        useState<Set<string>>(() =>
            blocksToCells(blocks)
        );


    /*
     * Tracks whether the user is currently
     * dragging across the calendar.
     */
    const [isDragging, setIsDragging] =
        useState(false);


    /*
     * Remembers whether the current drag
     * is adding or removing availability.
     */
    const [dragMode, setDragMode] =
        useState<DragMode | null>(null);


    /*
     * When the selected teammate changes,
     * load that teammate's availability.
     */
    useEffect(() => {
        setSelectedCells(
            blocksToCells(blocks)
        );
    }, [memberId, blocks]);


    /*
     * Stop dragging even if the user releases
     * the mouse outside of the calendar.
     */
    useEffect(() => {
        function stopDragging() {
            setIsDragging(false);
            setDragMode(null);
        }

        window.addEventListener(
            "pointerup",
            stopDragging
        );

        return () => {
            window.removeEventListener(
                "pointerup",
                stopDragging
            );
        };
    }, []);


    /*
     * Give each calendar square a unique ID.
     *
     * Example:
     *
     * Thu + 14:30
     * becomes
     * Thu-14:30
     */
    function getCellId(
        day: string,
        time: string
    ) {
        return `${day}-${time}`;
    }


    /*
     * Find every teammate available during
     * one specific 30-minute square.
     */
    function getAvailableMembers(
        day: AvailabilityBlock["dayOfWeek"],
        time: string
    ) {
        const cellStart =
            timeToMinutes(time);

        const cellEnd =
            cellStart + SLOT_MINUTES;

        return members.filter(
            (member) =>
                allAvailability.some(
                    (block) => {
                        /*
                         * Ignore blocks belonging to
                         * somebody else.
                         */
                        if (
                            block.memberId !== member.id
                        ) {
                            return false;
                        }

                        /*
                         * Ignore blocks on another day.
                         */
                        if (
                            block.dayOfWeek !== day
                        ) {
                            return false;
                        }

                        /*
                         * Ignore unavailable blocks.
                         */
                        if (!block.isAvailable) {
                            return false;
                        }

                        const blockStart =
                            timeToMinutes(
                                block.startTime
                            );

                        const blockEnd =
                            timeToMinutes(
                                block.endTime
                            );

                        /*
                         * The entire 30-minute calendar
                         * square must fit inside the block.
                         */
                        return (
                            cellStart >= blockStart &&
                            cellEnd <= blockEnd
                        );
                    }
                )
        );
    }


    /*
     * Choose the background intensity based
     * on how much of the team is available.
     */
    function getOverlapClass(
        count: number
    ) {
        if (members.length === 0) {
            return "bg-[#1D202A]";
        }

        const ratio =
            count / members.length;

        // Nobody available.
        if (ratio === 0) {
            return "bg-[#1D202A]";
        }

        // Roughly 25% of the team.
        if (ratio <= 0.25) {
            return "bg-[#40385A]";
        }

        // Roughly half of the team.
        if (ratio <= 0.5) {
            return "bg-[#594B80]";
        }

        // Most of the team.
        if (ratio < 1) {
            return "bg-[#7561B5]";
        }

        // Everybody available.
        return "bg-[#9B87F5]";
    }

    /*
    * Find the earliest 30-minute time where
    * every teammate is available.
    *
    * This becomes the gold "best time" cell.
    */
    

    /*
     * Add or remove one calendar square.
     */
    function updateCell(
        day: string,
        time: string,
        mode: DragMode
    ) {
        const cellId =
            getCellId(day, time);

        /*
         * Copy the current Set so we do not
         * directly modify React state.
         */
        const updated =
            new Set(selectedCells);

        if (mode === "add") {
            updated.add(cellId);
        } else {
            updated.delete(cellId);
        }

        /*
         * Update what is shown in this calendar.
         */
        setSelectedCells(updated);

        /*
         * Convert the little calendar squares
         * back into AvailabilityBlocks and send
         * them to ProjectContext.
         */
        onChange(
            cellsToBlocks(
                memberId,
                updated
            )
        );
    }


    /*
     * Begin clicking or dragging.
     */
    function handlePointerDown(
        day: string,
        time: string
    ) {
        const cellId =
            getCellId(day, time);

        /*
         * Start on an empty cell:
         * paint availability.
         *
         * Start on a selected cell:
         * erase availability.
         */
        const mode: DragMode =
            selectedCells.has(cellId)
                ? "remove"
                : "add";

        setIsDragging(true);
        setDragMode(mode);

        updateCell(
            day,
            time,
            mode
        );
    }


    /*
     * Called whenever the pointer enters another
     * cell while the user is dragging.
     */
    function handlePointerEnter(
        day: string,
        time: string
    ) {
        if (
            !isDragging ||
            !dragMode
        ) {
            return;
        }

        updateCell(
            day,
            time,
            dragMode
        );
    }


    /*
     * Keyboard support.
     *
     * Enter or Space toggles a square.
     */
    function handleKeyDown(
        event: React.KeyboardEvent,
        day: string,
        time: string
    ) {
        if (
            event.key !== "Enter" &&
            event.key !== " "
        ) {
            return;
        }

        event.preventDefault();

        const cellId =
            getCellId(day, time);

        const mode: DragMode =
            selectedCells.has(cellId)
                ? "remove"
                : "add";

        updateCell(
            day,
            time,
            mode
        );
    }


    return (
        <div className="space-y-4">

            {/* Calendar title */}
            <div>
                <h3 className="font-heading text-base font-semibold text-[#F5F2FA]">
                    Team availability
                </h3>

                <p className="text-xs text-[#AAA5B4]">
                    Click and drag to edit this teammate&apos;s availability.
                    Darker blocks mean more teammates are available.
                </p>
            </div>


            {/* Calendar */}
            <div className="overflow-x-auto">
                <div className="min-w-[850px] select-none">

                    {/* Day headings */}
                    <div className="grid grid-cols-[80px_repeat(7,1fr)] gap-1 mb-1">
                        <div />

                        {DAYS.map((day) => (
                            <div
                                key={day}
                                className="text-center text-xs font-medium text-[#AAA5B4] py-2"
                            >
                                {day}
                            </div>
                        ))}
                    </div>


                    {/* Time rows */}
                    {TIME_SLOTS.map(
                        (time) => (
                            <div
                                key={time}
                                className="grid grid-cols-[80px_repeat(7,1fr)] gap-1 mb-1"
                            >

                                {/* Time label */}
                                <div className="text-right pr-3 text-[11px] text-[#AAA5B4] flex items-center justify-end">
                                    {formatTime(time)}
                                </div>


                                {/* Monday through Friday cells */}
                                {DAYS.map(
                                    (day) => {
                                        const cellId =
                                            getCellId(
                                                day,
                                                time
                                            );

                                        /*
                                         * Is the teammate currently
                                         * being edited available?
                                         */
                                        const selected =
                                            selectedCells.has(
                                                cellId
                                            );


                                        /*
                                         * Who on the entire team is
                                         * available at this time?
                                         */
                                        const availableMembers =
                                            getAvailableMembers(
                                                day,
                                                time
                                            );

                                        const overlapCount =
                                            availableMembers.length;

                                        const isFullTeamAvailable =
                                            members.length > 0 &&
                                            overlapCount === members.length;

                                        const availableNames =
                                            availableMembers
                                                .map(
                                                    (member) =>
                                                        member.name
                                                )
                                                .join(", ");


                                        /*
                                         * Tooltip text.
                                         */
                                        const tooltip =
                                            overlapCount === 0
                                                ? `${day} ${formatTime(
                                                    time
                                                )}: nobody available`
                                                : `${day} ${formatTime(
                                                    time
                                                )}: ${overlapCount} of ${members.length
                                                } available — ${availableNames}`;


                                        return (
                                            <button
                                                key={cellId}
                                                type="button"

                                                /*
                                                 * Accessibility.
                                                 */
                                                aria-label={
                                                    tooltip
                                                }
                                                aria-pressed={
                                                    selected
                                                }

                                                /*
                                                 * Native browser tooltip.
                                                 */
                                                title={
                                                    tooltip
                                                }

                                                /*
                                                 * Mouse / trackpad controls.
                                                 */
                                                onPointerDown={() =>
                                                    handlePointerDown(
                                                        day,
                                                        time
                                                    )
                                                }

                                                onPointerEnter={() =>
                                                    handlePointerEnter(
                                                        day,
                                                        time
                                                    )
                                                }

                                                /*
                                                 * Keyboard controls.
                                                 */
                                                onKeyDown={(
                                                    event
                                                ) =>
                                                    handleKeyDown(
                                                        event,
                                                        day,
                                                        time
                                                    )
                                                }

                                                /*
                                                 * Cell appearance.
                                                 *
                                                 * Background =
                                                 * total team overlap.
                                                 *
                                                 * Bright border =
                                                 * selected teammate is
                                                 * available.
                                                 */
                                                className={`
                          h-7
                          rounded-sm
                          border
                          transition
                          ${isFullTeamAvailable
                                                        ? "bg-[#D5B45C]/80"
                                                        : getOverlapClass(
                                                            overlapCount
                                                        )}

                          ${selected
                                                        ? "border-[#F5F2FA] ring-1 ring-[#B8A6FF]"
                                                        : "border-[#2A2E39]"
                                                    }

                          hover:brightness-125

                          focus:outline-none
                          focus:ring-2
                          focus:ring-[#B8A6FF]
                        `}
                                            />
                                        );
                                    }
                                )}
                            </div>
                        )
                    )}
                </div>
            </div>


            {/* Legend */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-[#AAA5B4]">

                <span>
                    Team overlap:
                </span>

                {Array.from(
                    {
                        length:
                            members.length + 1,
                    },
                    (_, index) => index
                ).map((count) => (
                    <div
                        key={count}
                        className="flex items-center gap-1.5"
                    >
                        <div
                            className={`
                h-3
                w-3
                rounded-sm
                border
                border-[#2A2E39]
                ${getOverlapClass(
                                count
                            )}
              `}
                        />

                        <span>
                            {count} of{" "}
                            {members.length}
                        </span>
                    </div>
                ))}


                {/* Selected teammate indicator */}
                <div className="flex items-center gap-1.5 ml-2">
                    <div
                        className="
              h-3
              w-3
              rounded-sm
              border
              border-[#F5F2FA]
              ring-1
              ring-[#B8A6FF]
            "
                    />

                    <span>
                        selected teammate
                    </span>
                </div>
            </div>


            {/* Instructions */}
            <div className="text-xs text-[#AAA5B4]">
                Drag from an empty block to add availability.
                Drag from a selected block to erase it.
                Hover over a block to see who is available.
            </div>

        </div>
    );
}
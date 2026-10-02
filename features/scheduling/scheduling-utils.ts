import type { AvailabilityBlock } from "@/types";

/*
 * These match the official dayOfWeek values
 * used by AvailabilityBlock in types/index.ts.
 */
export const DAYS: AvailabilityBlock["dayOfWeek"][] = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
];

export const START_HOUR = 9;
export const END_HOUR = 21;
export const SLOT_MINUTES = 30;

/*
 * Convert minutes after midnight into a 24-hour time.
 *
 * Example:
 * 570 -> "09:30"
 */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  return `${hours.toString().padStart(2, "0")}:${mins
    .toString()
    .padStart(2, "0")}`;
}

/*
 * Convert a 24-hour time into minutes after midnight.
 *
 * Example:
 * "09:30" -> 570
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);

  return hours * 60 + minutes;
}

/*
 * Generate every 30-minute starting time between
 * 9 AM and 9 PM.
 */
export function createTimeSlots(): string[] {
  const slots: string[] = [];

  const startMinutes = START_HOUR * 60;
  const endMinutes = END_HOUR * 60;

  for (
    let minutes = startMinutes;
    minutes < endMinutes;
    minutes += SLOT_MINUTES
  ) {
    slots.push(minutesToTime(minutes));
  }

  return slots;
}

export const TIME_SLOTS = createTimeSlots();

/*
 * Change 24-hour time into something easier to read.
 *
 * "09:30" -> "9:30 AM"
 * "15:30" -> "3:30 PM"
 */
export function formatTime(time: string): string {
  const [hourString, minute] = time.split(":");

  const hour = Number(hourString);
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${minute} ${period}`;
}

/*
 * Convert existing AvailabilityBlocks into individual
 * 30-minute calendar cells.
 *
 * Example:
 *
 * 09:00 - 10:30
 *
 * becomes:
 *
 * Mon-09:00
 * Mon-09:30
 * Mon-10:00
 */
export function blocksToCells(
  blocks: AvailabilityBlock[]
): Set<string> {
  const cells = new Set<string>();

  blocks
    .filter((block) => block.isAvailable)
    .forEach((block) => {
      const start = timeToMinutes(block.startTime);
      const end = timeToMinutes(block.endTime);

      for (
        let minutes = start;
        minutes < end;
        minutes += SLOT_MINUTES
      ) {
        cells.add(
          `${block.dayOfWeek}-${minutesToTime(minutes)}`
        );
      }
    });

  return cells;
}

/*
 * Convert individual selected cells back into
 * AvailabilityBlocks.
 *
 * Consecutive cells are combined automatically.
 *
 * Example:
 *
 * Mon-09:00
 * Mon-09:30
 * Mon-10:00
 *
 * becomes one block:
 *
 * Mon 09:00 - 10:30
 */
export function cellsToBlocks(
  memberId: string,
  cells: Set<string>
): AvailabilityBlock[] {
  const blocks: AvailabilityBlock[] = [];

  DAYS.forEach((day) => {
    const times = TIME_SLOTS.filter((time) =>
      cells.has(`${day}-${time}`)
    );

    if (times.length === 0) {
      return;
    }

    const sortedTimes = [...times].sort(
      (a, b) => timeToMinutes(a) - timeToMinutes(b)
    );

    let blockStart = sortedTimes[0];
    let previousTime = sortedTimes[0];

    for (let i = 1; i <= sortedTimes.length; i++) {
      const currentTime = sortedTimes[i];

      const isConsecutive =
        currentTime !== undefined &&
        timeToMinutes(currentTime) ===
        timeToMinutes(previousTime) + SLOT_MINUTES;

      if (isConsecutive) {
        previousTime = currentTime;
        continue;
      }

      const endTime = minutesToTime(
        timeToMinutes(previousTime) + SLOT_MINUTES
      );

      blocks.push({
        id: `availability-${memberId}-${day}-${blockStart.replace(
          ":",
          ""
        )}`,
        memberId,
        dayOfWeek: day,
        startTime: blockStart,
        endTime,
        isAvailable: true,
      });

      if (currentTime !== undefined) {
        blockStart = currentTime;
        previousTime = currentTime;
      }
    }
  });

  return blocks;
}

/*
 * Represents one meeting time found by
 * the scheduling algorithm.
 */
export interface MeetingRecommendation {
  day: AvailabilityBlock["dayOfWeek"];
  startTime: string;
  endTime: string;

  // Which teammates can attend this entire window.
  availableMemberIds: string[];

  // True when everybody can attend.
  isFullTeam: boolean;
}

/*
 * Find the best meeting window for the team.
 *
 * Rules:
 *
 * 1. The same teammates must be available for
 *    the entire requested meeting duration.
 *
 * 2. Prefer a meeting where everybody can attend.
 *
 * 3. If several full-team times work, choose
 *    the earliest one.
 *
 * 4. If no full-team time exists, choose the
 *    option with the most attendees.
 *
 * 5. Break partial-attendance ties by choosing
 *    the earliest option.
 */
export function findBestMeetingTime(
  memberIds: string[],
  availability: AvailabilityBlock[],
  durationMinutes: number
): MeetingRecommendation | null {
  if (
    memberIds.length === 0 ||
    durationMinutes <= 0
  ) {
    return null;
  }

  const candidates: MeetingRecommendation[] = [];

  /*
   * Try every possible starting time on
   * Monday through Friday.
   */
  DAYS.forEach((day) => {
    TIME_SLOTS.forEach((startTime) => {
      const startMinutes =
        timeToMinutes(startTime);

      const endMinutes =
        startMinutes + durationMinutes;

      /*
       * Do not allow meetings to run beyond
       * the calendar's ending time.
       */
      if (endMinutes > END_HOUR * 60) {
        return;
      }

      /*
       * Find which members are available for
       * this ENTIRE proposed meeting window.
       */
      const availableMemberIds =
        memberIds.filter((memberId) => {
          return availability.some((block) => {
            if (
              block.memberId !== memberId ||
              block.dayOfWeek !== day ||
              !block.isAvailable
            ) {
              return false;
            }

            const blockStart =
              timeToMinutes(block.startTime);

            const blockEnd =
              timeToMinutes(block.endTime);

            return (
              startMinutes >= blockStart &&
              endMinutes <= blockEnd
            );
          });
        });

      /*
       * Ignore a meeting that nobody
       * can attend.
       */
      if (availableMemberIds.length === 0) {
        return;
      }

      candidates.push({
        day,
        startTime,
        endTime:
          minutesToTime(endMinutes),

        availableMemberIds,

        isFullTeam:
          availableMemberIds.length ===
          memberIds.length,
      });
    });
  });

  if (candidates.length === 0) {
    return null;
  }

  /*
   * Sort the candidates.
   *
   * First:
   * most attendees.
   *
   * Then:
   * earliest day.
   *
   * Then:
   * earliest time.
   */
  candidates.sort((a, b) => {
    const attendanceDifference =
      b.availableMemberIds.length -
      a.availableMemberIds.length;

    if (attendanceDifference !== 0) {
      return attendanceDifference;
    }

    const dayDifference =
      DAYS.indexOf(a.day) -
      DAYS.indexOf(b.day);

    if (dayDifference !== 0) {
      return dayDifference;
    }

    return (
      timeToMinutes(a.startTime) -
      timeToMinutes(b.startTime)
    );
  });

  return candidates[0];
}
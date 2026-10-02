import { AvailabilityView } from "@/features/scheduling/AvailabilityView";
import { MeetingCatchUpView } from "@/features/meetings/MeetingCatchUpView";

export default function MeetingPage() {
  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <h1 className="font-heading text-3xl sm:text-[34px] font-bold tracking-tight text-[#F5F2FA]">
          Meetings
        </h1>
        <p className="text-base text-[#AAA5B4] max-w-2xl leading-relaxed">
          Find time together, review agenda items, and quickly catch up if someone can&apos;t make it.
        </p>
      </div>

      {/* Best meeting time & availability matrix (Oscar) */}
      <AvailabilityView />

      {/* Upcoming meeting, can't attend action, catch-up digest (Shreya) */}
      <MeetingCatchUpView />
    </div>
  );
}

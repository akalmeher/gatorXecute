import { AvailabilityView } from "@/features/scheduling/AvailabilityView";
import { MeetingCatchUpView } from "@/features/meetings/MeetingCatchUpView";

export default function MeetingPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          Meeting Coordination & Async Catch-Up
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Find common availability, review meeting briefs, and catch up asynchronously when conflicts arise.
        </p>
      </div>

      {/* Oscar Garcia's Availability Interface & Overlap Algorithm */}
      <AvailabilityView />

      {/* Shreya Rameshwar's Meeting Brief, Can't Attend Flow & Catch-Up Interface */}
      <MeetingCatchUpView />
    </div>
  );
}

"use client";

import React from "react";
import type { Wellbeing } from "@/features/ai/share-check-types";
import { SUPPORT } from "@/features/ai/care";

/**
 * Feature Owner: Divij Anand
 * A kind word, and support when it might help. Never diagnoses, never follows
 * up, never blocks the student from continuing. In a crisis, resources come first.
 */
export function SupportNote({ wellbeing, acknowledgement }: { wellbeing: Wellbeing; acknowledgement: string }) {
  if (wellbeing === "crisis") {
    return (
      <div role="alert" className="space-y-2 rounded-2xl bg-[#D5B45C]/10 p-5 ring-1 ring-[#D5B45C]/40">
        <p className="font-heading text-lg font-semibold text-[#F5F2FA]">You don&apos;t have to handle this alone.</p>
        <p className="text-[#F5F2FA]">
          <strong>{SUPPORT.crisisLine}</strong>
        </p>
        <p className="text-sm text-[#AAA5B4]">
          At SF State:{" "}
          <a href={SUPPORT.campus.url} target="_blank" rel="noreferrer" className="text-[#B8A6FF] underline underline-offset-4">
            {SUPPORT.campus.name}, {SUPPORT.campus.detail}
          </a>
          . Nothing here is shared with your team.
        </p>
      </div>
    );
  }
  if (!acknowledgement) return null;
  return (
    <p className="text-[#F5F2FA]">
      {acknowledgement}{" "}
      {wellbeing === "low" && (
        <a href={SUPPORT.campus.url} target="_blank" rel="noreferrer" className="text-sm text-[#AAA5B4] underline underline-offset-4 hover:text-[#F5F2FA]">
          Support at SF State
        </a>
      )}
    </p>
  );
}

"use client";

import React, { useState } from "react";
import { primaryButton, quietButton, secondaryButton } from "@/features/plan/PlanFocus";

/**
 * Feature Owner: Divij Anand
 * The student decides what teammates see. Default: the effect on the work,
 * never the reason. Their own words are shared only if they choose.
 */
interface ShareChoiceProps {
  shareable: string;
  original: string;
  onShare: (text: string) => void;
  onSkip: () => void;
}

export function ShareChoice({ shareable, original, onShare, onSkip }: ShareChoiceProps) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(shareable);

  return (
    <section aria-labelledby="share-heading" className="space-y-3 rounded-2xl bg-[#171A23] p-5">
      <h3 id="share-heading" className="text-sm font-semibold text-[#AAA5B4]">
        Your team will see
      </h3>
      {editing ? (
        <textarea
          aria-label="What your team will see"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          maxLength={200}
          className="w-full rounded-xl bg-[#1D202A] px-4 py-3 text-[#F5F2FA] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]/60"
        />
      ) : (
        <p className="text-lg text-[#F5F2FA]">“{text}”</p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => onShare(text.trim() || shareable)} className={primaryButton}>
          {editing ? "Share this" : "Share that"}
        </button>
        {!editing && (
          <button type="button" onClick={() => setEditing(true)} className={secondaryButton}>
            Edit
          </button>
        )}
        <button type="button" onClick={() => onShare(original)} className={quietButton}>
          Share my own words
        </button>
        <button type="button" onClick={onSkip} className={quietButton}>
          Don&apos;t share anything
        </button>
      </div>
      <p className="text-xs text-[#AAA5B4]">What you wrote stays private unless you choose to share it.</p>
    </section>
  );
}

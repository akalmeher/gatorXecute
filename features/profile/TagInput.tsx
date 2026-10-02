"use client";

import React, { useState } from "react";
import { MAX_TAGS, MAX_TAG_CHARS, normalizeTags } from "./profile";

/**
 * Feature Owner: Divij Anand
 * Skill tags: type and press Enter (or comma), tap a suggestion, remove with ✕
 * or Backspace. Suggestions are a starting point, never a requirement.
 */

interface TagInputProps {
  id: string;
  label: string;
  hint?: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
}

export function TagInput({ id, label, hint, tags, onChange, suggestions = [], placeholder }: TagInputProps) {
  const [draft, setDraft] = useState("");
  const add = (values: string[]) => onChange(normalizeTags([...tags, ...values]));
  const remaining = suggestions.filter((s) => !tags.some((t) => t.toLowerCase() === s.toLowerCase()));

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm text-[#AAA5B4]">
        {label}
        {hint && <span className="block text-xs text-[#AAA5B4]/80">{hint}</span>}
      </label>
      <div className="flex min-h-12 flex-wrap items-center gap-2 rounded-xl border border-[#2A2E39] bg-[#171A23] px-3 py-2 focus-within:ring-2 focus-within:ring-[#B8A6FF]/60">
        {tags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-[#B8A6FF]/15 py-1 pl-3 pr-1 text-sm text-[#F5F2FA]">
            {tag}
            <button
              type="button"
              aria-label={`Remove ${tag}`}
              onClick={() => onChange(tags.filter((t) => t !== tag))}
              className="flex h-5 w-5 items-center justify-center rounded-full text-[#AAA5B4] hover:bg-[#2A2E39] hover:text-[#F5F2FA] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]"
            >
              ✕
            </button>
          </span>
        ))}
        {tags.length < MAX_TAGS && (
          <input
            id={id}
            value={draft}
            maxLength={MAX_TAG_CHARS * 3}
            onChange={(e) => {
              const value = e.target.value;
              // A comma finishes a tag, so pasted lists work too.
              if (value.includes(",")) {
                add(value.split(","));
                setDraft("");
              } else setDraft(value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (draft.trim()) add([draft]);
                setDraft("");
              } else if (e.key === "Backspace" && !draft && tags.length > 0) {
                onChange(tags.slice(0, -1));
              }
            }}
            onBlur={() => {
              if (draft.trim()) add([draft]);
              setDraft("");
            }}
            placeholder={tags.length === 0 ? placeholder : "Add another…"}
            className="min-w-32 flex-1 bg-transparent py-1 text-[#F5F2FA] placeholder:text-[#AAA5B4]/60 focus:outline-none"
          />
        )}
      </div>
      {remaining.length > 0 && tags.length < MAX_TAGS && (
        <div className="flex flex-wrap gap-1.5">
          {remaining.slice(0, 10).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add([s])}
              className="rounded-full border border-[#2A2E39] px-2.5 py-1 text-xs text-[#AAA5B4] hover:border-[#B8A6FF]/50 hover:text-[#F5F2FA] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

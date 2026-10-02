"use client";

import React, { useRef, useState } from "react";
import { MAX_WHERE_CHARS, WHERE_SUGGESTIONS, parseWhere, type Where } from "./meet-where";

/**
 * Feature Owner: Divij Anand
 * "Where?" as one field: type a place, paste any meeting link or a phone
 * number, or tap a suggestion. It shows how it was read as you type, and
 * once set it becomes the action itself: Join, Open in Maps, or Call.
 */

const chip =
  "inline-flex items-center gap-1.5 rounded-full border border-[#2A2E39] px-3 py-1.5 text-sm text-[#F5F2FA] hover:border-[#B8A6FF]/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]/60 cursor-pointer transition-colors";
const action =
  "inline-flex items-center gap-1.5 rounded-xl bg-[#B8A6FF] px-4 py-2 text-sm font-semibold text-[#0F1117] hover:bg-[#B8A6FF]/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]/60";
const quiet =
  "inline-flex items-center rounded-lg px-2 py-1 text-sm text-[#AAA5B4] underline-offset-4 hover:text-[#F5F2FA] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]/60 cursor-pointer";

function KindIcon({ kind, className = "h-4 w-4" }: { kind: Where["kind"] | "phone-chip" | "place-chip" | "online-chip"; className?: string }) {
  const common = { className, fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, viewBox: "0 0 24 24", "aria-hidden": true };
  if (kind === "phone" || kind === "phone-chip") {
    return (
      <svg {...common}>
        <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
      </svg>
    );
  }
  if (kind === "online" || kind === "online-chip") {
    return (
      <svg {...common}>
        <rect x="3" y="6" width="13" height="12" rx="2" />
        <path d="m16 10 5-3v10l-5-3" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M12 21s-7-5.6-7-11a7 7 0 0 1 14 0c0 5.4-7 11-7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

/** How the typed text was understood, shown live under the field. */
function readBack(where: Where | null): string {
  if (!where) return "";
  switch (where.kind) {
    case "place":
      return `In person · ${where.label}`;
    case "hybrid":
      return `In person at ${where.place}, or join on ${where.platform ?? "the link"}`;
    case "phone":
      return where.phone ? `Phone call · ${where.phone}` : "Phone call · add a number, or share it in your group chat";
    case "online":
      if (where.url) return `${where.label} · link ready ✓`;
      if (where.meetingId) return `${where.label} · ID ${where.meetingId}`;
      return `${where.label} · paste the link here when you have one`;
  }
}

interface WhereFieldProps {
  value?: string;
  onChange: (value: string | undefined) => void;
}

export function WhereField({ value, onChange }: WhereFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const input = useRef<HTMLInputElement>(null);
  const where = parseWhere(value);
  const preview = parseWhere(draft);

  const save = (text: string) => {
    const trimmed = text.trim();
    onChange(trimmed && parseWhere(trimmed) ? trimmed.slice(0, MAX_WHERE_CHARS) : undefined);
    setEditing(false);
  };
  const startEditing = () => {
    setDraft(value ?? "");
    setEditing(true);
  };

  // Set: the place is the action.
  if (where && !editing) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 text-[#F5F2FA]">
          <KindIcon kind={where.kind} className="h-5 w-5 text-[#D5B45C]" />
          <span className="font-medium">{where.label}</span>
          {where.meetingId && <span className="text-sm text-[#AAA5B4]">ID {where.meetingId}</span>}
        </span>
        {where.url && (
          <a href={where.url} target="_blank" rel="noopener noreferrer" className={action}>
            Join{where.platform ? ` ${where.platform}` : ""}
          </a>
        )}
        {where.mapsUrl && (
          <a href={where.mapsUrl} target="_blank" rel="noopener noreferrer" className={where.url ? quiet : action}>
            Open in Maps
          </a>
        )}
        {where.phone && (
          <a href={`tel:${where.phone}`} className={where.url || where.mapsUrl ? quiet : action}>
            Call {where.phone}
          </a>
        )}
        <button type="button" onClick={startEditing} className={quiet}>
          Change
        </button>
      </div>
    );
  }

  // Not set yet: one quiet line, never a blocker.
  if (!editing) {
    return (
      <button type="button" onClick={startEditing} className={`${quiet} -ml-2 gap-2`}>
        <KindIcon kind="place" />
        Where? Add a place, a link or a call
      </button>
    );
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        save(draft);
      }}
    >
      <label htmlFor="where" className="text-sm text-[#AAA5B4]">
        Where?
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id="where"
          ref={input}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={MAX_WHERE_CHARS}
          autoFocus
          placeholder="Library 2nd floor, a Zoom/Meet/Discord link, or a phone number"
          className="w-full rounded-xl border border-[#2A2E39] bg-[#171A23] px-4 py-3 text-[#F5F2FA] placeholder:text-[#AAA5B4]/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]/60"
        />
        <button type="submit" className={`${action} shrink-0 justify-center py-3`}>
          {draft.trim() ? "Done" : "Decide later"}
        </button>
      </div>

      <p aria-live="polite" className="min-h-5 text-sm text-[#AAA5B4]">
        {preview && (
          <span className="inline-flex items-center gap-2">
            <KindIcon kind={preview.kind} className="h-4 w-4 text-[#D5B45C]" />
            {readBack(preview)}
          </span>
        )}
      </p>
      {preview?.phone && <p className="-mt-2 text-xs text-[#AAA5B4]">Anyone with the Quick Meet link can see this number.</p>}

      {!draft.trim() && (
        <div className="flex flex-wrap gap-2">
          {WHERE_SUGGESTIONS.map((s) => (
            <button
              key={s.label}
              type="button"
              className={chip}
              onClick={() => {
                if (s.needsLink) {
                  // Keep editing so the link can be pasted right after the app name.
                  setDraft(`${s.value} `);
                  input.current?.focus();
                } else {
                  setDraft(s.value);
                  save(s.value);
                }
              }}
            >
              <KindIcon kind={s.needsLink ? "online-chip" : s.value === "Phone call" ? "phone-chip" : "place-chip"} className="h-3.5 w-3.5 text-[#AAA5B4]" />
              {s.label}
            </button>
          ))}
        </div>
      )}
    </form>
  );
}

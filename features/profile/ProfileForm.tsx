"use client";

import React, { useState } from "react";
import type { SkillsResponse } from "@/features/ai/skills";
import { modelLabel } from "@/features/ai/model-label";
import { MAX_NAME_CHARS, type Profile, SKILL_SUGGESTIONS, newProfileId, normalizeTags } from "./profile";
import { TagInput } from "./TagInput";

/**
 * Feature Owner: Divij Anand
 * Create or edit a profile. Skills can be tapped, typed, or just said in your
 * own words ("I edit videos and I'm okay at writing") and turned into tags,
 * which the student checks before saving.
 */

const field =
  "w-full rounded-xl border border-[#2A2E39] bg-[#171A23] px-4 py-3 text-[#F5F2FA] placeholder:text-[#AAA5B4]/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]/60";
const primary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[#B8A6FF] px-5 py-3 text-sm font-semibold text-[#0F1117] hover:bg-[#B8A6FF]/90 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]/60";
const secondary =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-[#2A2E39] px-4 py-3 text-sm font-medium text-[#F5F2FA] hover:border-[#B8A6FF]/50 disabled:opacity-60 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]/60";

interface ProfileFormProps {
  initial?: Profile | null;
  onSave: (profile: Profile) => void;
  submitLabel?: string;
}

export function ProfileForm({ initial, onSave, submitLabel = "Save profile" }: ProfileFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [major, setMajor] = useState(initial?.major ?? "");
  const [skills, setSkills] = useState<string[]>(initial?.skills ?? []);
  const [wantsToLearn, setWantsToLearn] = useState<string[]>(initial?.wantsToLearn ?? []);
  const [about, setAbout] = useState("");
  const [reading, setReading] = useState(false);
  const [readNote, setReadNote] = useState<string | null>(null);

  const readAbout = async () => {
    if (!about.trim() || reading) return;
    setReading(true);
    setReadNote(null);
    try {
      const response = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: about }),
      });
      const data = (await response.json()) as SkillsResponse;
      if (!data.ok) {
        setReadNote(data.message);
        return;
      }
      const added = data.result.skills.length + data.result.wantsToLearn.length;
      setSkills((prev) => normalizeTags([...prev, ...data.result.skills]));
      setWantsToLearn((prev) => normalizeTags([...prev, ...data.result.wantsToLearn]));
      setReadNote(
        added > 0
          ? `Added what I heard. Remove anything that isn't right. · ${modelLabel(data.model, data.source)}`
          : "I didn't catch any skills there. Try naming a few things you've done."
      );
      setAbout("");
    } catch {
      setReadNote("Couldn't reach the server. You can still tap or type your skills.");
    } finally {
      setReading(false);
    }
  };

  const canSave = name.trim().length > 0;

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSave) return;
        onSave({
          id: initial?.id ?? newProfileId(),
          name: name.trim().slice(0, MAX_NAME_CHARS),
          ...(major.trim() ? { major: major.trim() } : {}),
          skills,
          wantsToLearn,
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-sm text-[#AAA5B4]">Your name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={MAX_NAME_CHARS} required placeholder="Divij Anand" className={field} />
        </label>
        <label className="space-y-1">
          <span className="text-sm text-[#AAA5B4]">Major (optional)</span>
          <input value={major} onChange={(e) => setMajor(e.target.value)} maxLength={60} placeholder="Computer Science" className={field} />
        </label>
      </div>

      <div className="space-y-2">
        <label htmlFor="about" className="block text-sm text-[#AAA5B4]">
          What can you do? Say it however you like
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id="about"
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void readAbout();
              }
            }}
            maxLength={600}
            disabled={reading}
            placeholder="I edit videos for film class, I'm okay at writing, and I want to learn Figma"
            className={field}
          />
          <button type="button" onClick={() => void readAbout()} disabled={reading || !about.trim()} className={`${secondary} shrink-0`}>
            {reading ? "Reading…" : "Turn into tags"}
          </button>
        </div>
        {readNote && (
          <p role="status" className="text-xs text-[#AAA5B4]">
            {readNote}
          </p>
        )}
      </div>

      <TagInput
        id="skills"
        label="Things you can do"
        hint="Anything counts: writing, editing, research, presenting, a tool you know."
        tags={skills}
        onChange={setSkills}
        suggestions={SKILL_SUGGESTIONS}
        placeholder="Type a skill and press Enter"
      />
      <TagInput
        id="learn"
        label="Things you'd like to learn (optional)"
        hint="The plan gives you a chance to practice one, with a teammate who knows it."
        tags={wantsToLearn}
        onChange={setWantsToLearn}
        placeholder="e.g. Public speaking"
      />

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={!canSave} className={primary}>
          {submitLabel}
        </button>
        <span className="text-xs text-[#AAA5B4]">Saved on this device. No password, nothing stored on our servers.</span>
      </div>
    </form>
  );
}

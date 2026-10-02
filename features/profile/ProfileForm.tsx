"use client";

import React, { useState } from "react";
import type { SkillsResponse } from "@/features/ai/skills";
import { modelLabel } from "@/features/ai/model-label";
import { MAX_NAME_CHARS, type Profile, SKILL_CATEGORIES, SKILL_SUGGESTIONS, newProfileId, normalizeTags } from "./profile";
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
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[#D5B45C] px-5 py-3 text-sm font-semibold text-[#0F1117] hover:bg-[#E2C36E] active:scale-[0.97] shadow-md shadow-[#D5B45C]/20 hover:shadow-lg hover:shadow-[#D5B45C]/35 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D5B45C]/60 transition-all duration-200";
const secondary =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-[#B8A6FF]/40 bg-[#171A23] px-4 py-3 text-sm font-medium text-[#F5F2FA] hover:border-[#B8A6FF] hover:bg-[#B8A6FF]/15 active:scale-[0.97] disabled:opacity-60 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]/60 transition-all duration-200";

interface ProfileFormProps {
  initial?: Profile | null;
  onSave: (profile: Profile) => void;
  submitLabel?: string;
}

export function ProfileForm({ initial, onSave, submitLabel = "Save profile" }: ProfileFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [major, setMajor] = useState(initial?.major ?? "");
  const [bio, setBio] = useState(initial?.bio ?? "");
  const [skills, setSkills] = useState<string[]>(initial?.skills ?? []);
  const [wantsToLearn, setWantsToLearn] = useState<string[]>(initial?.wantsToLearn ?? []);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
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
          ...(bio.trim() ? { bio: bio.trim() } : {}),
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
          <span className="text-sm text-[#AAA5B4]">Major or program</span>
          <input value={major} onChange={(e) => setMajor(e.target.value)} maxLength={60} placeholder="Computer Science / Cinema minor" className={field} />
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-sm text-[#AAA5B4]">About you (optional)</span>
        <input
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={240}
          placeholder="e.g. CS junior, passionate about UI/UX and film editing"
          className={field}
        />
      </label>

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

      {/* Categorized suggestions */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-[#AAA5B4] mr-1">Browse catalogs:</span>
          <button
            type="button"
            onClick={() => setSelectedCategory("all")}
            className={`rounded-lg px-2.5 py-1 transition-colors ${
              selectedCategory === "all" ? "bg-[#B8A6FF]/20 text-[#B8A6FF] font-medium" : "text-[#AAA5B4] hover:text-[#F5F2FA]"
            }`}
          >
            All
          </button>
          {SKILL_CATEGORIES.map((cat) => (
            <button
              key={cat.name}
              type="button"
              onClick={() => setSelectedCategory(cat.name)}
              className={`rounded-lg px-2.5 py-1 transition-colors ${
                selectedCategory === cat.name ? "bg-[#B8A6FF]/20 text-[#B8A6FF] font-medium" : "text-[#AAA5B4] hover:text-[#F5F2FA]"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      <TagInput
        id="skills"
        label="Things you can do (Uni Profile Master Skills)"
        hint="Everything you can contribute across all classes: coding, video editing, lab work, writing, presentation."
        tags={skills}
        onChange={setSkills}
        suggestions={
          selectedCategory === "all"
            ? SKILL_SUGGESTIONS
            : SKILL_CATEGORIES.find((c) => c.name === selectedCategory)?.skills ?? SKILL_SUGGESTIONS
        }
        placeholder="Type a skill and press Enter"
      />

      <TagInput
        id="learn"
        label="Things you'd like to learn (optional)"
        hint="The plan gives you a chance to practice one, with a teammate who knows it."
        tags={wantsToLearn}
        onChange={setWantsToLearn}
        placeholder="e.g. Public speaking, Figma, Docker"
      />

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button type="submit" disabled={!canSave} className={primary}>
          {submitLabel}
        </button>
        <span className="text-xs text-[#AAA5B4]">Saved on this device. No password, nothing stored on our servers.</span>
      </div>
    </form>
  );
}

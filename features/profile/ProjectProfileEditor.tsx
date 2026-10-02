"use client";

import React, { useState } from "react";
import type { Project } from "@/types";
import {
  type Profile,
  type ProjectProfile,
  initialsOf,
  matchSkillsToCourse,
  normalizeTags,
} from "./profile";
import { TagInput } from "./TagInput";

/**
 * Feature Owner: Divij Anand
 * ProjectProfileEditor: Per-project / per-course profile editor (Discord "Server Profile" style).
 * Allows students to specify their role, active skills, and learning goals for a specific
 * project/class without altering their master SFSU Uni profile.
 */

const field =
  "w-full rounded-xl border border-[#2A2E39] bg-[#171A23] px-4 py-3 text-[#F5F2FA] placeholder:text-[#AAA5B4]/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]/60";
const primary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[#B8A6FF] px-5 py-3 text-sm font-semibold text-[#0F1117] hover:bg-[#B8A6FF]/90 disabled:opacity-60 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]/60";
const secondary =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-[#2A2E39] px-4 py-2 text-xs font-medium text-[#F5F2FA] hover:border-[#B8A6FF]/50 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]/60";

interface ProjectProfileEditorProps {
  profile: Profile;
  project: Project;
  initial?: ProjectProfile | null;
  onSave: (projectProfile: ProjectProfile) => void;
}

export function ProjectProfileEditor({ profile, project, initial, onSave }: ProjectProfileEditorProps) {
  const courseOrName = project.course ? `${project.course} · ${project.name}` : project.name;
  const recommended = matchSkillsToCourse(project.course || project.name, profile.skills);

  const [role, setRole] = useState(initial?.role ?? profile.major ?? "");
  const [activeSkills, setActiveSkills] = useState<string[]>(() => {
    if (initial?.activeSkills && initial.activeSkills.length > 0) {
      return initial.activeSkills;
    }
    // If we have recommended skills from their master profile, default to them, otherwise full list
    return recommended.length > 0 ? recommended : profile.skills;
  });
  const [wantsToLearn, setWantsToLearn] = useState<string[]>(initial?.wantsToLearn ?? profile.wantsToLearn ?? []);

  const toggleSkill = (skill: string) => {
    setActiveSkills((prev) => {
      const exists = prev.some((s) => s.toLowerCase() === skill.toLowerCase());
      if (exists) {
        return prev.filter((s) => s.toLowerCase() !== skill.toLowerCase());
      }
      return normalizeTags([...prev, skill]);
    });
  };

  const applyRecommended = () => {
    if (recommended.length > 0) {
      setActiveSkills(recommended);
    }
  };

  const selectAll = () => {
    setActiveSkills(profile.skills);
  };

  const clearAll = () => {
    setActiveSkills([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      projectId: project.id,
      role: role.trim(),
      activeSkills,
      wantsToLearn,
    });
  };

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      {/* Editor Column */}
      <form onSubmit={handleSubmit} className="space-y-6 lg:col-span-7">
        <div className="rounded-2xl border border-[#2A2E39] bg-[#171A23]/60 p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#D5B45C]">Workspace Context</p>
              <h3 className="font-heading text-lg font-bold text-[#F5F2FA]">{courseOrName}</h3>
            </div>
            <span className="rounded-full bg-[#B8A6FF]/15 px-2.5 py-1 text-xs font-medium text-[#B8A6FF]">
              Per-Project Profile
            </span>
          </div>
          <p className="mt-2 text-xs text-[#AAA5B4]">
            Customize what you do for this specific project. In Cinema class, your video editing skills shine; in Computer Science, your backend skills take the lead.
          </p>
        </div>

        <label className="block space-y-1">
          <span className="text-sm text-[#AAA5B4]">Your role or title in this project</span>
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            maxLength={60}
            placeholder={project.course?.includes("CINE") ? "e.g. Lead Editor & Co-Presenter" : "e.g. Backend Architecture Lead"}
            className={field}
          />
        </label>

        {/* Skill Selection from Uni Profile */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-sm font-medium text-[#F5F2FA]">Active Skills for this Project</span>
              <p className="text-xs text-[#AAA5B4]">
                Choose which skills from your master Uni Profile apply to {project.course || "this project"}.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {recommended.length > 0 && (
                <button type="button" onClick={applyRecommended} className={secondary}>
                  ⚡ Recommended ({recommended.length})
                </button>
              )}
              <button type="button" onClick={selectAll} className="text-xs text-[#AAA5B4] hover:text-[#F5F2FA]">
                All
              </button>
              <span className="text-[#2A2E39]">·</span>
              <button type="button" onClick={clearAll} className="text-xs text-[#AAA5B4] hover:text-[#F5F2FA]">
                Clear
              </button>
            </div>
          </div>

          {profile.skills.length === 0 ? (
            <p className="text-xs italic text-[#AAA5B4]">
              No skills listed in your Uni Profile yet. Add them in the Uni Profile tab, or add custom tags below.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2 rounded-xl border border-[#2A2E39] bg-[#12141C] p-3">
              {profile.skills.map((skill) => {
                const isActive = activeSkills.some((s) => s.toLowerCase() === skill.toLowerCase());
                const isRec = recommended.some((s) => s.toLowerCase() === skill.toLowerCase());
                return (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => toggleSkill(skill)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                      isActive
                        ? "bg-[#B8A6FF] text-[#0F1117] shadow-sm"
                        : "border border-[#2A2E39] bg-[#171A23] text-[#AAA5B4] hover:border-[#AAA5B4]/50 hover:text-[#F5F2FA]"
                    }`}
                  >
                    <span>{isActive ? "✓" : "+"}</span>
                    <span>{skill}</span>
                    {isRec && !isActive && <span className="text-[10px] text-[#D5B45C]">★ match</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Custom one-off project tags */}
        <TagInput
          id="project-custom-skills"
          label="Additional project-specific skills"
          hint="Any unique tool or responsibility for this specific assignment."
          tags={activeSkills}
          onChange={setActiveSkills}
          placeholder="e.g. Final Cut Pro, Storyboarding, Postman"
        />

        <TagInput
          id="project-learn"
          label="Things you want to practice in this project"
          hint="The AI planner will pair you with a step to practice this goal."
          tags={wantsToLearn}
          onChange={setWantsToLearn}
          placeholder="e.g. Video color grading, GraphQL"
        />

        <div className="flex items-center gap-3 pt-2">
          <button type="submit" className={primary}>
            Save Project Profile
          </button>
        </div>
      </form>

      {/* Discord-style Profile Preview Card */}
      <div className="lg:col-span-5">
        <div className="sticky top-6 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#AAA5B4]">Discord-Style Live Preview</p>

          <div className="overflow-hidden rounded-2xl border border-[#2A2E39] bg-[#171A23] shadow-xl">
            {/* Header banner */}
            <div className="h-20 bg-gradient-to-r from-[#2A2244] via-[#1D202A] to-[#171A23] p-4 relative">
              <span className="inline-block rounded-full bg-[#0F1117]/80 backdrop-blur-sm px-2.5 py-0.5 text-[11px] font-semibold text-[#D5B45C]">
                {project.course || "Project Workspace"}
              </span>
            </div>

            {/* Avatar & Identity */}
            <div className="px-5 pb-5 -mt-7">
              <div className="flex items-end justify-between">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-4 border-[#171A23] bg-[#B8A6FF] font-heading text-lg font-bold text-[#0F1117] shadow-md">
                  {initialsOf(profile.name)}
                </div>
                <span className="rounded-full bg-[#2A2E39] px-2.5 py-1 text-[11px] text-[#AAA5B4]">
                  SFSU Member
                </span>
              </div>

              <div className="mt-3">
                <h4 className="font-heading text-xl font-bold text-[#F5F2FA]">{profile.name}</h4>
                <p className="text-xs font-medium text-[#B8A6FF] mt-0.5">{role || profile.major || "Team Member"}</p>
                {profile.bio && <p className="mt-2 text-xs text-[#AAA5B4] italic">&quot;{profile.bio}&quot;</p>}
              </div>

              <div className="mt-4 border-t border-[#2A2E39] pt-4 space-y-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#AAA5B4]">Active in this workspace</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {activeSkills.length === 0 ? (
                      <span className="text-xs text-[#AAA5B4]/60">No active skills selected yet</span>
                    ) : (
                      activeSkills.map((s) => (
                        <span key={s} className="rounded-lg bg-[#B8A6FF]/20 px-2 py-0.5 text-xs font-medium text-[#F5F2FA]">
                          {s}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {wantsToLearn.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#AAA5B4]">Learning in this project</p>
                    <p className="mt-1 text-xs text-[#D5B45C]">{wantsToLearn.join(" · ")}</p>
                  </div>
                )}
              </div>

              <div className="mt-4 rounded-xl bg-[#12141C] p-3 text-[11px] text-[#AAA5B4]">
                🤖 <strong>AI Planner Grounding</strong>: Gemini and teammates see these active skills when decomposing deliverables and assigning steps for {project.course || "this project"}.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

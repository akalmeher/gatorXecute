"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useProject } from "@/context/ProjectContext";
import { useCurrentMember } from "@/features/identity/useCurrentMember";
import { type Profile, type ProjectProfile, resolveMemberForProject } from "./profile";
import { ProfileForm } from "./ProfileForm";
import { ProjectProfileEditor } from "./ProjectProfileEditor";
import { useProfile } from "./useProfile";

/**
 * Feature Owner: Divij Anand
 * /profile: Discord-style dual identity management:
 * 1. SFSU Uni Profile (Global): Your master skill catalog across all disciplines.
 * 2. Per-Project Profile (Per-Server): Your specific role, active skills, and goals
 *    for the current class/task (e.g. Cinema vs Software Engineering).
 */

export function ProfileView() {
  const { profile, saveProfile, getProjectProfile, saveProjectProfile } = useProfile();
  const { project, replaceMembers } = useProject();
  const { setCurrentMember } = useCurrentMember();
  const [activeTab, setActiveTab] = useState<"uni" | "project">("uni");
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const saveUni = (next: Profile) => {
    saveProfile(next);
    // Sync with project members using existing project profile if present
    const projectProf = getProjectProfile(project.id);
    const member = resolveMemberForProject(next, projectProf);
    if (project.members.some((m) => m.id === next.id)) {
      replaceMembers(project.members.map((m) => (m.id === next.id ? member : m)));
      setCurrentMember(next.id);
    }
    setSavedMessage("Uni profile saved. Your master skills vault is updated.");
  };

  const saveProject = (next: ProjectProfile) => {
    saveProjectProfile(next);
    if (profile) {
      const member = resolveMemberForProject(profile, next);
      if (project.members.some((m) => m.id === profile.id)) {
        replaceMembers(project.members.map((m) => (m.id === profile.id ? member : m)));
        setCurrentMember(profile.id);
      }
    }
    setSavedMessage(`Project profile saved for ${project.course || project.name}. AI tasks and teammates will use these active skills.`);
  };

  const currentProjectProfile = getProjectProfile(project.id);

  return (
    <div className="max-w-4xl space-y-8">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-[#F5F2FA] sm:text-[34px]">
            {profile ? "Profiles & Roles" : "Create your profile"}
          </h1>
          <span className="rounded-full border border-[#2A2E39] bg-[#171A23] px-3 py-1 text-xs text-[#AAA5B4]">
            Discord-Style Identity Model
          </span>
        </div>
        <p className="text-base leading-relaxed text-[#AAA5B4]">
          Just like Discord, you have a <strong>Master Uni Profile</strong> (all your skills across SFSU) and a{" "}
          <strong>Per-Project Profile</strong> (what you specifically contribute in {project.course || "this project"}).
        </p>
      </div>

      {profile && (
        <div className="flex border-b border-[#2A2E39]">
          <button
            type="button"
            onClick={() => {
              setActiveTab("uni");
              setSavedMessage(null);
            }}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-colors cursor-pointer ${
              activeTab === "uni"
                ? "border-[#B8A6FF] text-[#F5F2FA]"
                : "border-transparent text-[#AAA5B4] hover:text-[#F5F2FA]"
            }`}
          >
            <span>🎓</span>
            <span>SFSU Uni Profile (Global)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("project");
              setSavedMessage(null);
            }}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-colors cursor-pointer ${
              activeTab === "project"
                ? "border-[#D5B45C] text-[#F5F2FA]"
                : "border-transparent text-[#AAA5B4] hover:text-[#F5F2FA]"
            }`}
          >
            <span>⚡</span>
            <span>Project Profile ({project.course || "Current Task"})</span>
          </button>
        </div>
      )}

      {activeTab === "uni" || !profile ? (
        <div className="max-w-2xl space-y-6">
          <div className="rounded-xl border border-[#2A2E39] bg-[#171A23]/40 p-4 text-xs text-[#AAA5B4]">
            <strong>Uni Profile</strong>: Your overarching student profile with all your capabilities (CS, Cinema, Design, Business, Lab, Writing). Used to populate your per-project profiles with relevant skills.
          </div>
          <ProfileForm key={profile?.id ?? "new"} initial={profile} onSave={saveUni} submitLabel={profile ? "Save changes" : "Create Uni profile"} />
        </div>
      ) : (
        <div className="space-y-6">
          <ProjectProfileEditor
            profile={profile}
            project={project}
            initial={currentProjectProfile}
            onSave={saveProject}
          />
        </div>
      )}

      {savedMessage && (
        <section role="status" className="space-y-2 border-l-2 border-[#D5B45C] pl-5">
          <p className="font-heading text-lg font-semibold text-[#F5F2FA]">✓ Saved</p>
          <p className="text-sm text-[#AAA5B4]">{savedMessage}</p>
          <div className="flex flex-wrap gap-4 pt-1 text-sm">
            <Link href="/team" className="text-[#B8A6FF] underline-offset-4 hover:underline">
              View team & skills →
            </Link>
            <Link href="/plan" className="text-[#B8A6FF] underline-offset-4 hover:underline">
              AI Project Plan →
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

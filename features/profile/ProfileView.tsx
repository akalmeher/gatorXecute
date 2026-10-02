"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useProject } from "@/context/ProjectContext";
import { useCurrentMember } from "@/features/identity/useCurrentMember";
import { type Profile, profileToMember } from "./profile";
import { ProfileForm } from "./ProfileForm";
import { useProfile } from "./useProfile";

/**
 * Feature Owner: Divij Anand
 * /profile: create once, then it's who you are everywhere (dock, updates,
 * catch-up, team links). Editing it updates you in the current team too.
 */

export function ProfileView() {
  const { profile, saveProfile } = useProfile();
  const { project, replaceMembers } = useProject();
  const { setCurrentMember } = useCurrentMember();
  const [saved, setSaved] = useState(false);

  const save = (next: Profile) => {
    saveProfile(next);
    // Already on the current team? Keep the team in sync with the profile.
    if (project.members.some((m) => m.id === next.id)) {
      replaceMembers(project.members.map((m) => (m.id === next.id ? profileToMember(next) : m)));
      setCurrentMember(next.id);
    }
    setSaved(true);
  };

  return (
    <div className="max-w-2xl space-y-8">
      <div className="space-y-2">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-[#F5F2FA] sm:text-[34px]">
          {profile ? "Your profile" : "Create your profile"}
        </h1>
        <p className="text-base leading-relaxed text-[#AAA5B4]">
          Your skills help the plan split the work fairly. Nobody is ranked or scored, and you can change this any time.
        </p>
      </div>

      <ProfileForm key={profile?.id ?? "new"} initial={profile} onSave={save} submitLabel={profile ? "Save changes" : "Create profile"} />

      {saved && (
        <section role="status" className="space-y-2 border-l-2 border-[#D5B45C] pl-5">
          <p className="font-heading text-lg font-semibold text-[#F5F2FA]">✓ Saved</p>
          <p className="text-[#AAA5B4]">
            Next:{" "}
            <Link href="/team" className="text-[#B8A6FF] underline-offset-4 hover:underline">
              form a team or join one →
            </Link>
          </p>
        </section>
      )}
    </div>
  );
}

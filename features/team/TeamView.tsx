"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useProject } from "@/context/ProjectContext";
import { useCurrentMember } from "@/features/identity/useCurrentMember";
import { useProfile } from "@/features/profile/useProfile";
import { ProfileForm } from "@/features/profile/ProfileForm";
import {
  type Profile,
  initialsOf,
  profileForProject,
  profileToMember,
  projectProfileKey,
  sanitizeProfile,
} from "@/features/profile/profile";
import { MAX_TEAM, type Team, decodeTeam, encodeTeam, joinTeam, skillCoverage } from "./team-link";

/**
 * Feature Owner: Divij Anand
 * /team: Form and manage a team with rich profiles without accounts.
 * - Add teammates directly or send the invite link.
 * - Quick-add SFSU classmate presets (multidisciplinary roles).
 * - SFSU Gold action buttons with tactile micro-interactions and animations.
 * - Seamlessly push team to active project and plan with AI decomposition.
 */

const field =
  "w-full rounded-xl border border-[#2A2E39] bg-[#171A23] px-4 py-3 text-[#F5F2FA] placeholder:text-[#AAA5B4]/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]/60 transition-colors";
const primary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[#D5B45C] px-5 py-3 text-sm font-semibold text-[#0F1117] hover:bg-[#E2C36E] active:scale-[0.97] shadow-md shadow-[#D5B45C]/20 hover:shadow-lg hover:shadow-[#D5B45C]/35 disabled:opacity-60 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D5B45C]/60 transition-all duration-200";
const secondary =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-[#B8A6FF]/40 bg-[#171A23] px-5 py-3 text-sm font-medium text-[#F5F2FA] hover:border-[#B8A6FF] hover:bg-[#B8A6FF]/15 active:scale-[0.97] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]/60 transition-all duration-200";

const first = (name: string) => name.split(" ")[0] || name;

const CLASSMATE_PRESETS: Omit<Profile, "id">[] = [
  {
    name: "Maya Chen",
    major: "Cinema & Audio Lead",
    skills: ["Figma", "User Research", "Scriptwriting", "Video Editing"],
    wantsToLearn: ["Sound Design", "Motion Graphics"],
    bio: "Cinema major focusing on interactive storytelling and media production.",
  },
  {
    name: "Alex Rivera",
    major: "Full-Stack Dev Lead",
    skills: ["TypeScript", "Next.js", "Tailwind CSS", "REST APIs"],
    wantsToLearn: ["System Architecture", "Real-time Sync"],
    bio: "Computer Science senior building modern web applications.",
  },
  {
    name: "Jordan Lee",
    major: "Systems & QA Lead",
    skills: ["Python", "Automated Testing", "Docker", "Database Design"],
    wantsToLearn: ["CI/CD Pipelines", "Cloud Deployment"],
    bio: "CS student passionate about system reliability and automated verification.",
  },
  {
    name: "Elena Rostova",
    major: "Technical Writing & Docs",
    skills: ["Documentation", "Slide Decks", "Technical Writing", "Editing"],
    wantsToLearn: ["Information Architecture", "Markdown Workflows"],
    bio: "Technical communication specialist ensuring crystal-clear project reports.",
  },
  {
    name: "Marcus Vance",
    major: "Business Strategy & Marketing",
    skills: ["Market Research", "Financial Modeling", "Presentation", "Pitch Decks"],
    wantsToLearn: ["Product Analytics", "Go-to-market Strategy"],
    bio: "Lam Family College of Business marketing & product strategy focus.",
  },
];

function makeMemberId(name: string, salt: number): string {
  const clean = name.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 16);
  return `mem-${clean || "member"}-${salt}`;
}

export function TeamView() {
  const router = useRouter();
  const { profile, saveProfile, getProjectProfile } = useProfile();
  const { startProject, replaceMembers, project } = useProject();
  const { setCurrentMember } = useCurrentMember();
  const [team, setTeam] = useState<Team | null>(null);
  const [invitedBy, setInvitedBy] = useState<string | null>(null);
  const [badLink, setBadLink] = useState(false);
  const [name, setName] = useState("");
  const [course, setCourse] = useState("");
  const [copied, setCopied] = useState(false);
  const [syncedNotice, setSyncedNotice] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // New member form state
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("");
  const [newMemberSkills, setNewMemberSkills] = useState("");
  const [newMemberLearning, setNewMemberLearning] = useState("");

  const lastWritten = useRef("");

  // Load a team from the link (and again if a different link is opened here).
  useEffect(() => {
    const load = () => {
      const hash = window.location.hash.slice(1);
      if (!hash || hash === lastWritten.current) return;
      lastWritten.current = hash;
      const decoded = decodeTeam(hash);
      setTeam(decoded);
      setBadLink(!decoded);
      setInvitedBy(decoded?.members[0]?.name ?? null);
      setCopied(false);
    };
    load();
    window.addEventListener("hashchange", load);
    return () => window.removeEventListener("hashchange", load);
  }, []);

  // The address bar always holds the current team, so it's the link to send.
  useEffect(() => {
    if (!team) return;
    const hash = encodeTeam(team);
    lastWritten.current = hash;
    window.history.replaceState(null, "", `#${hash}`);
  }, [team]);

  const inTeam = Boolean(profile && team?.members.some((m) => m.id === profile.id));
  const full = Boolean(team && team.members.length >= MAX_TEAM);
  // Your "server profile" for this team: only what's relevant to this class goes in the link.
  const myEntry =
    profile && team
      ? profileForProject(profile, getProjectProfile(projectProfileKey(team)), `${team.course ?? ""} ${team.name}`)
      : null;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      window.prompt("Copy this link:", window.location.href);
    }
  };

  const planWithTeam = () => {
    if (!team || !profile) return;
    const members = team.members.map((m) => (m.id === profile.id ? profileToMember(myEntry!) : profileToMember(m)));
    startProject({ name: team.name, course: team.course, members });
    setCurrentMember(profile.id);
    router.push("/plan");
  };

  const syncToActiveWorkspace = () => {
    if (!team) return;
    const members = team.members.map(profileToMember);
    replaceMembers(members);
    setSyncedNotice(true);
    setTimeout(() => setSyncedNotice(false), 3000);
  };

  const addPresetTeammate = (preset: Omit<Profile, "id">) => {
    if (!team || full) return;
    const id = makeMemberId(preset.name, team.members.length + 1);
    const newMember = sanitizeProfile({
      id,
      name: preset.name,
      major: preset.major,
      skills: preset.skills,
      wantsToLearn: preset.wantsToLearn,
      bio: preset.bio,
    });
    if (newMember) {
      setTeam(joinTeam(team, newMember));
    }
  };

  const handleCustomAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!team || !newMemberName.trim() || full) return;
    const id = makeMemberId(newMemberName, team.members.length + 1);
    const parsedSkills = newMemberSkills
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const parsedLearning = newMemberLearning
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const newMember = sanitizeProfile({
      id,
      name: newMemberName.trim(),
      major: newMemberRole.trim() || undefined,
      skills: parsedSkills,
      wantsToLearn: parsedLearning,
    });

    if (newMember) {
      setTeam(joinTeam(team, newMember));
      setNewMemberName("");
      setNewMemberRole("");
      setNewMemberSkills("");
      setNewMemberLearning("");
      setShowAddModal(false);
    }
  };

  const removeTeammate = (id: string) => {
    if (!team) return;
    setTeam({
      ...team,
      members: team.members.filter((m) => m.id !== id),
    });
  };

  // Step 0: no profile yet. Ask once, right here.
  if (!profile) {
    return (
      <div className="max-w-2xl space-y-8 animate-fade-in">
        <div className="space-y-2">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-[#F5F2FA] sm:text-[34px]">
            {team ? `${first(invitedBy ?? "Someone")} invited you to ${team.name}` : "Form a team"}
          </h1>
          <p className="text-base text-[#AAA5B4]">First, set up your profile and skills. It takes 30 seconds and you only do it once.</p>
        </div>
        <ProfileForm onSave={saveProfile} submitLabel="Continue" />
      </div>
    );
  }

  // Step 1: start a new team.
  if (!team) {
    return (
      <div className="max-w-3xl space-y-8 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 rounded-2xl border border-[#2A2E39] bg-[#171A23] p-6 shadow-sm">
          <div className="space-y-2 flex-1 min-w-0">
            <h1 className="font-heading text-3xl font-bold tracking-tight text-[#F5F2FA] sm:text-[34px]">Form a team</h1>
            <p className="text-base text-[#AAA5B4]">Name it, add teammates with their skills, or share a link to coordinate with zero accounts.</p>
            {badLink && (
              <p role="alert" className="text-sm text-[#D5B45C]">
                That team link looks broken. Ask for it again, or start a new team here.
              </p>
            )}
          </div>
          <Image
            src="/illustrations/team-collab.svg"
            alt=""
            width={200}
            height={150}
            unoptimized
            className="w-36 sm:w-48 h-auto shrink-0 opacity-85 hidden sm:block"
          />
        </div>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            const details = { name: name.trim(), ...(course.trim() ? { course: course.trim() } : {}) };
            const me = profileForProject(profile, getProjectProfile(projectProfileKey(details)), `${details.course ?? ""} ${details.name}`);
            setTeam({ ...details, members: [me] });
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-[#AAA5B4]">Project or team name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                required
                placeholder="e.g. Cinema Final Presentation"
                className={field}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-[#AAA5B4]">Course / Class (optional)</span>
              <input
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                maxLength={80}
                placeholder="e.g. CINE 340 or CSC 648"
                className={field}
              />
            </label>
          </div>

          <div className="pt-2 flex flex-wrap gap-3">
            <button type="submit" disabled={!name.trim()} className={primary}>
              Start the team →
            </button>
            {project.members.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setTeam({
                    name: project.name || "Group Project",
                    course: project.course || undefined,
                    members: project.members.map((m) => ({
                      id: m.id,
                      name: m.name,
                      major: m.role,
                      skills: m.skills,
                      wantsToLearn: m.wantsToLearn,
                    })),
                  });
                }}
                className={secondary}
              >
                Load from active project ({project.members.length} members)
              </button>
            )}
          </div>
        </form>
      </div>
    );
  }

  const coverage = skillCoverage(team);
  const noSkills = team.members.filter((m) => m.skills.length === 0);

  return (
    <div className="max-w-3xl space-y-10 animate-fade-in">
      {/* Top Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="rounded-md border border-[#2A2E39] bg-[#1D202A] px-2.5 py-0.5 text-xs font-semibold text-[#B8A6FF]">
            {team.course ?? "SFSU Team"}
          </span>
          <span className="text-xs text-[#AAA5B4]">
            {team.members.length} of {MAX_TEAM} members
          </span>
        </div>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-[#F5F2FA] sm:text-[34px]">
          {!inTeam && invitedBy ? `${first(invitedBy)} invited you to ${team.name}` : team.name}
        </h1>
        <p className="text-base text-[#AAA5B4]">
          {!inTeam
            ? `${team.members.length} ${team.members.length === 1 ? "person" : "people"} so far. Join to add yourself.`
            : team.members.length === 1
              ? "Just you so far. Add teammates below or share the invite link."
              : `${team.members.length} teammates with distinct profiles & roles.`}
        </p>
      </div>

      {/* Primary Action Buttons (Golden & Lavender) */}
      <section className="flex flex-wrap items-center gap-3">
        {!inTeam ? (
          <button type="button" onClick={() => myEntry && setTeam(joinTeam(team, myEntry))} disabled={full} className={primary}>
            {full ? "This team is full" : `Join as ${first(profile.name)}`}
          </button>
        ) : null}
        {!inTeam && myEntry && !full && (
          <span className="text-xs text-[#AAA5B4]">
            You&apos;ll join with {myEntry.skills.length > 0 ? myEntry.skills.join(", ") : "no skills listed"}, picked for{" "}
            {team.course || team.name}.{" "}
            <Link href="/profile" className="text-[#B8A6FF] underline-offset-4 hover:underline">
              Change
            </Link>
          </span>
        )}
        {inTeam && (
          <>
            <button
              type="button"
              onClick={planWithTeam}
              className={`${primary} pulse-gold`}
              title="Decompose assignment tasks with this team"
            >
              Plan with this team →
            </button>
            <button type="button" onClick={copyLink} className={secondary}>
              {copied ? "Link copied ✓" : "Copy invite link"}
            </button>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              disabled={full}
              className={secondary}
            >
              + Add teammate
            </button>
            <button
              type="button"
              onClick={syncToActiveWorkspace}
              className="text-xs font-medium text-[#B8A6FF] hover:underline px-2 py-1"
            >
              {syncedNotice ? "✓ Synced to workspace!" : "Sync to active project"}
            </button>
          </>
        )}
      </section>

      {inTeam && invitedBy && invitedBy !== profile.name && (
        <p className="-mt-6 text-sm text-[#AAA5B4]">You&apos;re in. Send the link back so everyone has the full team.</p>
      )}

      {/* Add Teammate Modal / Drawer */}
      {showAddModal && (
        <div className="rounded-2xl border border-[#B8A6FF]/40 bg-[#171A23] p-6 space-y-6 shadow-2xl animate-slide-up">
          <div className="flex items-center justify-between border-b border-[#2A2E39] pb-3">
            <div>
              <h3 className="font-heading text-lg font-bold text-[#F5F2FA]">Add Teammate to {team.name}</h3>
              <p className="text-xs text-[#AAA5B4] mt-0.5">Quick-add a classmate preset or type their profile details.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="rounded-lg p-1.5 text-xs text-[#AAA5B4] hover:bg-[#2A2E39] hover:text-[#F5F2FA]"
            >
              ✕
            </button>
          </div>

          {/* Quick-Add Classmate Presets */}
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#AAA5B4]">
              1-Click Classmate Presets
            </span>
            <div className="grid gap-2 sm:grid-cols-2">
              {CLASSMATE_PRESETS.filter((cp) => !team.members.some((m) => m.name === cp.name)).map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => {
                    addPresetTeammate(preset);
                    setShowAddModal(false);
                  }}
                  className="flex items-start gap-2.5 rounded-xl border border-[#2A2E39] bg-[#1D202A] p-2.5 text-left transition hover:border-[#B8A6FF]/60 hover:bg-[#1D202A]/80 cursor-pointer active:scale-98"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#B8A6FF]/15 text-xs font-bold text-[#B8A6FF]">
                    {initialsOf(preset.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[#F5F2FA]">{preset.name}</p>
                    <p className="truncate text-[11px] text-[#D5B45C]">{preset.major}</p>
                    <p className="truncate text-[10px] text-[#AAA5B4]">{preset.skills.slice(0, 3).join(", ")}</p>
                  </div>
                  <span className="text-xs text-[#D5B45C] font-bold">+</span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Teammate Form */}
          <form onSubmit={handleCustomAdd} className="space-y-3 pt-2 border-t border-[#2A2E39]">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#AAA5B4]">
              Or Custom Teammate
            </span>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs text-[#AAA5B4]">Full Name *</span>
                <input
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  required
                  placeholder="e.g. Sam Parker"
                  className={field}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-[#AAA5B4]">Project Role / Major</span>
                <input
                  value={newMemberRole}
                  onChange={(e) => setNewMemberRole(e.target.value)}
                  placeholder="e.g. Frontend Architect / CS"
                  className={field}
                />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs text-[#AAA5B4]">Skills (comma-separated)</span>
                <input
                  value={newMemberSkills}
                  onChange={(e) => setNewMemberSkills(e.target.value)}
                  placeholder="React, CSS, Prototyping"
                  className={field}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-[#AAA5B4]">Interested in Learning</span>
                <input
                  value={newMemberLearning}
                  onChange={(e) => setNewMemberLearning(e.target.value)}
                  placeholder="Docker, Testing"
                  className={field}
                />
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="rounded-xl px-4 py-2 text-xs font-medium text-[#AAA5B4] hover:text-[#F5F2FA]"
              >
                Cancel
              </button>
              <button type="submit" disabled={!newMemberName.trim()} className={primary}>
                Add to Team
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Roster of People */}
      <section aria-labelledby="people-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 id="people-heading" className="text-xs font-semibold uppercase tracking-[0.14em] text-[#AAA5B4]">
            Team Roster ({team.members.length})
          </h2>
          {team.members.length < MAX_TEAM && !showAddModal && (
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="text-xs font-medium text-[#D5B45C] hover:underline"
            >
              + Add teammate
            </button>
          )}
        </div>

        <ul className="grid gap-3.5 sm:grid-cols-2">
          {team.members.map((m) => {
            const isMe = m.id === profile.id;
            return (
              <li
                key={m.id}
                className={`relative flex flex-col justify-between rounded-2xl border p-4.5 transition-all duration-200 hover-lift ${
                  isMe
                    ? "border-[#B8A6FF]/60 bg-[#171A23] shadow-md shadow-[#B8A6FF]/5"
                    : "border-[#2A2E39] bg-[#171A23] hover:border-[#B8A6FF]/40"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-heading text-xs font-bold transition-transform ${
                      isMe ? "bg-[#B8A6FF] text-[#0F1117] ring-2 ring-[#B8A6FF]/40" : "bg-[#1D202A] text-[#F5F2FA] border border-[#2A2E39]"
                    }`}
                  >
                    {initialsOf(m.name)}
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-[#F5F2FA] truncate">
                        {m.name}
                      </p>
                      {isMe ? (
                        <span className="rounded-full bg-[#B8A6FF]/20 px-2 py-0.5 text-[10px] font-semibold text-[#B8A6FF]">
                          You
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => removeTeammate(m.id)}
                          className="text-xs text-[#AAA5B4] hover:text-rose-400 p-1"
                          title="Remove teammate"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    {m.major && <p className="text-xs text-[#D5B45C] font-medium">{m.major}</p>}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {m.skills.length === 0 ? (
                        <span className="text-xs text-[#AAA5B4]">No skills listed yet</span>
                      ) : (
                        m.skills.map((s) => (
                          <span key={s} className="rounded-lg bg-[#1D202A] border border-[#2A2E39] px-2 py-0.5 text-[11px] text-[#F5F2FA]">
                            {s}
                          </span>
                        ))
                      )}
                    </div>
                    {m.wantsToLearn.length > 0 && (
                      <p className="text-[11px] text-[#AAA5B4] pt-1">
                        Goals: <span className="text-[#AAA5B4]/80">{m.wantsToLearn.join(", ")}</span>
                      </p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        {inTeam && (
          <p className="text-xs text-[#AAA5B4]">
            Changed your personal skills?{" "}
            <Link href="/profile" className="text-[#B8A6FF] underline-offset-4 hover:underline">
              Customize your profile &amp; roles
            </Link>
            , then{" "}
            <button
              type="button"
              onClick={() => myEntry && setTeam(joinTeam(team, myEntry))}
              className="text-[#D5B45C] underline-offset-4 hover:underline cursor-pointer font-medium"
            >
              refresh your entry
            </button>
            .
          </p>
        )}
      </section>

      {/* Together: What the team covers */}
      {coverage.length > 0 && (
        <section aria-labelledby="cover-heading" className="space-y-3 rounded-2xl border border-[#2A2E39] bg-[#171A23]/60 p-6">
          <h2 id="cover-heading" className="text-xs font-semibold uppercase tracking-[0.14em] text-[#AAA5B4]">
            Together you cover
          </h2>
          <div className="flex flex-wrap gap-2">
            {coverage.map((c) => (
              <span
                key={c.skill}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#2A2E39] bg-[#1D202A] px-3 py-1.5 text-xs text-[#F5F2FA]"
              >
                <span className="font-semibold text-[#B8A6FF]">{c.skill}</span>
                <span className="text-[#AAA5B4]">({c.people.join(", ")})</span>
              </span>
            ))}
          </div>
          {noSkills.length > 0 && (
            <p className="text-xs text-[#AAA5B4] pt-1">
              {noSkills.map((m) => first(m.name)).join(", ")} {noSkills.length === 1 ? "hasn't" : "haven't"} listed skills yet. The AI planner will allocate balanced foundational tasks.
            </p>
          )}
        </section>
      )}

      <p className="text-xs text-[#AAA5B4]">
        All team links encode member data directly into the browser URL fragment. Zero tracking, zero friction.
      </p>
    </div>
  );
}

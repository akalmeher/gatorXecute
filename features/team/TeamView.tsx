"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useProject } from "@/context/ProjectContext";
import { useCurrentMember } from "@/features/identity/useCurrentMember";
import { useProfile } from "@/features/profile/useProfile";
import { ProfileForm } from "@/features/profile/ProfileForm";
import { initialsOf, profileToMember } from "@/features/profile/profile";
import { MAX_TEAM, type Team, decodeTeam, encodeTeam, joinTeam, skillCoverage } from "./team-link";

/**
 * Feature Owner: Divij Anand
 * /team: form a team without accounts. Start one (you're in it), send the
 * link, each teammate joins with their profile and sends it back. Then
 * "Plan with this team" makes them the project's team, so the plan splits
 * work by what each person said they can do.
 */

const field =
  "w-full rounded-xl border border-[#2A2E39] bg-[#171A23] px-4 py-3 text-[#F5F2FA] placeholder:text-[#AAA5B4]/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]/60";
const primary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[#B8A6FF] px-5 py-3 text-sm font-semibold text-[#0F1117] hover:bg-[#B8A6FF]/90 disabled:opacity-60 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]/60";
const secondary =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-[#2A2E39] px-5 py-3 text-sm font-medium text-[#F5F2FA] hover:border-[#B8A6FF]/50 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]/60";

const first = (name: string) => name.split(" ")[0] || name;

export function TeamView() {
  const router = useRouter();
  const { profile, saveProfile } = useProfile();
  const { startProject } = useProject();
  const { setCurrentMember } = useCurrentMember();
  const [team, setTeam] = useState<Team | null>(null);
  const [invitedBy, setInvitedBy] = useState<string | null>(null);
  const [badLink, setBadLink] = useState(false);
  const [name, setName] = useState("");
  const [course, setCourse] = useState("");
  const [copied, setCopied] = useState(false);
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

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      window.prompt("Copy this link:", window.location.href);
    }
  };

  const planWithTeam = () => {
    if (!team || !profile) return;
    startProject({ name: team.name, course: team.course, members: team.members.map(profileToMember) });
    setCurrentMember(profile.id);
    router.push("/plan");
  };

  // Step 0: no profile yet. Ask once, right here.
  if (!profile) {
    return (
      <div className="max-w-2xl space-y-8">
        <div className="space-y-2">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-[#F5F2FA] sm:text-[34px]">
            {team ? `${first(invitedBy ?? "Someone")} invited you to ${team.name}` : "Form a team"}
          </h1>
          <p className="text-base text-[#AAA5B4]">First, say what you can do. It takes a minute and you only do it once.</p>
        </div>
        <ProfileForm onSave={saveProfile} submitLabel="Continue" />
      </div>
    );
  }

  // Step 1: start a new team.
  if (!team) {
    return (
      <div className="max-w-2xl space-y-8">
        <div className="space-y-2">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-[#F5F2FA] sm:text-[34px]">Form a team</h1>
          <p className="text-base text-[#AAA5B4]">Name it, send the link, and everyone joins with their profile. No accounts.</p>
          {badLink && (
            <p role="alert" className="text-sm text-[#D5B45C]">
              That team link looks broken. Ask for it again, or start a new team here.
            </p>
          )}
        </div>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            setTeam({ name: name.trim(), ...(course.trim() ? { course: course.trim() } : {}), members: [profile] });
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm text-[#AAA5B4]">Project or team name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required placeholder="Cinema presentation" className={field} />
            </label>
            <label className="space-y-1">
              <span className="text-sm text-[#AAA5B4]">Class (optional)</span>
              <input value={course} onChange={(e) => setCourse(e.target.value)} maxLength={80} placeholder="CINE 340" className={field} />
            </label>
          </div>
          <button type="submit" disabled={!name.trim()} className={primary}>
            Start the team
          </button>
        </form>
      </div>
    );
  }

  const coverage = skillCoverage(team);
  const noSkills = team.members.filter((m) => m.skills.length === 0);

  return (
    <div className="max-w-3xl space-y-10">
      <div className="space-y-2">
        <p className="text-sm text-[#AAA5B4]">{team.course ?? "Team"}</p>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-[#F5F2FA] sm:text-[34px]">
          {!inTeam && invitedBy ? `${first(invitedBy)} invited you to ${team.name}` : team.name}
        </h1>
        <p className="text-base text-[#AAA5B4]">
          {!inTeam
            ? `${team.members.length} ${team.members.length === 1 ? "person" : "people"} so far. Join to add yourself.`
            : team.members.length === 1
              ? "Just you so far. Send the link to your teammates."
              : `${team.members.length} people`}
        </p>
      </div>

      {/* The one next step */}
      <section className="flex flex-wrap items-center gap-3">
        {!inTeam ? (
          <button type="button" onClick={() => setTeam(joinTeam(team, profile))} disabled={full} className={primary}>
            {full ? "This team is full" : `Join as ${first(profile.name)}`}
          </button>
        ) : (
          <>
            <button type="button" onClick={copyLink} className={team.members.length === 1 ? primary : secondary}>
              {copied ? "Link copied ✓" : team.members.length === 1 ? "Copy invite link" : "Copy link for the team"}
            </button>
            {team.members.length >= 2 && (
              <button type="button" onClick={planWithTeam} className={primary}>
                Plan with this team →
              </button>
            )}
          </>
        )}
      </section>
      {inTeam && invitedBy && invitedBy !== profile.name && (
        <p className="-mt-6 text-sm text-[#AAA5B4]">You&apos;re in. Send the link back so everyone has the full team.</p>
      )}

      {/* People */}
      <section aria-labelledby="people-heading" className="space-y-3">
        <h2 id="people-heading" className="text-xs font-semibold uppercase tracking-[0.14em] text-[#AAA5B4]">
          Who&apos;s in
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {team.members.map((m) => (
            <li key={m.id} className="flex gap-3 rounded-2xl bg-[#171A23] p-4">
              <span
                aria-hidden
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-heading text-xs font-bold ${
                  m.id === profile.id ? "bg-[#B8A6FF] text-[#0F1117]" : "bg-[#1D202A] text-[#F5F2FA]"
                }`}
              >
                {initialsOf(m.name)}
              </span>
              <div className="min-w-0 space-y-1.5">
                <p className="font-medium text-[#F5F2FA]">
                  {m.name} {m.id === profile.id && <span className="text-xs font-normal text-[#AAA5B4]">you</span>}
                </p>
                {m.major && <p className="text-xs text-[#AAA5B4]">{m.major}</p>}
                <div className="flex flex-wrap gap-1">
                  {m.skills.length === 0 ? (
                    <span className="text-xs text-[#AAA5B4]">No skills listed yet</span>
                  ) : (
                    m.skills.map((s) => (
                      <span key={s} className="rounded-full bg-[#B8A6FF]/15 px-2 py-0.5 text-xs text-[#F5F2FA]">
                        {s}
                      </span>
                    ))
                  )}
                </div>
                {m.wantsToLearn.length > 0 && <p className="text-xs text-[#AAA5B4]">Wants to learn: {m.wantsToLearn.join(", ")}</p>}
              </div>
            </li>
          ))}
        </ul>
        {inTeam && (
          <p className="text-xs text-[#AAA5B4]">
            Changed your skills?{" "}
            <Link href="/profile" className="text-[#B8A6FF] underline-offset-4 hover:underline">
              Edit your profile
            </Link>
            , then{" "}
            <button type="button" onClick={() => setTeam(joinTeam(team, profile))} className="text-[#B8A6FF] underline-offset-4 hover:underline">
              refresh your entry
            </button>
            .
          </p>
        )}
      </section>

      {/* Together: what the team covers, never who's "better" */}
      {coverage.length > 0 && (
        <section aria-labelledby="cover-heading" className="space-y-2">
          <h2 id="cover-heading" className="text-xs font-semibold uppercase tracking-[0.14em] text-[#AAA5B4]">
            Together you can
          </h2>
          <p className="text-sm leading-relaxed text-[#F5F2FA]">
            {coverage.map((c, i) => (
              <span key={c.skill}>
                {c.skill} <span className="text-[#AAA5B4]">({c.people.join(", ")})</span>
                {i < coverage.length - 1 ? " · " : ""}
              </span>
            ))}
          </p>
          {noSkills.length > 0 && (
            <p className="text-sm text-[#AAA5B4]">
              {noSkills.map((m) => first(m.name)).join(", ")} {noSkills.length === 1 ? "hasn't" : "haven't"} listed skills yet. The plan
              will still give everyone a fair share of steps they can start on.
            </p>
          )}
        </section>
      )}

      <p className="text-xs text-[#AAA5B4]">
        The team lives inside the link, not on our servers. Anyone with the link can see names and skills.
      </p>
    </div>
  );
}

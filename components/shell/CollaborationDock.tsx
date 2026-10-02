"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Member, Project } from "@/types";
import { useProject } from "@/context/ProjectContext";
import { useCurrentMember } from "@/features/identity/useCurrentMember";
import { findPlanProblems, needsAttention, PROBLEM_PHRASE } from "@/features/plan/plan-health";
import { formatDay, orderSteps } from "@/features/plan/plan-display";
import { toIsoDay, todayIsoDay } from "@/features/plan/plan-validation";
import { encodePoll } from "@/features/meet/meet-link";
import { useProfile } from "@/features/profile/useProfile";
import { encodeTeam } from "@/features/team/team-link";

/**
 * Collaboration Dock: "Where am I, and who am I here with?"
 * Presence over menus. Home, current project, team roster, and quick actions.
 * - Instant Persona Switcher ("Switch to Maya" / "I am Divij")
 * - 1-Click Teammate Add & Invite link generator
 * - SFSU Gold action buttons with tactile micro-interactions and animations.
 */

type Panel =
  | { kind: "collab" }
  | { kind: "member"; id: string }
  | { kind: "more" }
  | { kind: "add-member" }
  | null;

interface MemberState {
  line: string;
  detail?: string;
  tone: "working" | "waiting" | "attention" | "clear";
}

/** Describes the work around a person, never the person (no scores, no "behind"). */
function memberState(project: Project, member: Member): MemberState {
  const today = todayIsoDay();
  const steps = orderSteps(project.tasks, project.members).filter(
    (s) => s.task.ownerId === member.id && s.state !== "done"
  );
  const problem = findPlanProblems(project.tasks, today).find(
    (p) => needsAttention(p) && p.task.ownerId === member.id
  );
  if (problem) return { line: `${problem.task.title} ${PROBLEM_PHRASE[problem.kind]}`, tone: "attention" };
  const current = steps.find((s) => s.state === "doing") ?? steps.find((s) => s.state === "ready") ?? steps[0];
  if (!current) return { line: "All current tasks done ✓", tone: "clear" };
  const due = current.task.dueDate ? `Due ${formatDay(current.task.dueDate)}` : undefined;
  if (current.state === "waiting" || current.state === "later") {
    return {
      line: current.task.title,
      detail: [due, `Waiting on ${current.waitingOn[0] ?? "an earlier step"}`].filter(Boolean).join(" · "),
      tone: "waiting",
    };
  }
  return {
    line: current.task.title,
    detail: [due, current.state === "doing" ? "Working on it" : "Ready to start"].filter(Boolean).join(" · "),
    tone: "working",
  };
}

const TONE: Record<MemberState["tone"], { dot: string; label: string }> = {
  working: { dot: "bg-[#B8A6FF]", label: "●" },
  waiting: { dot: "bg-[#AAA5B4]", label: "‖" },
  attention: { dot: "bg-[#D5B45C] pulse-gold", label: "⚠" },
  clear: { dot: "bg-[#B8A6FF]", label: "✓" },
};

const dockButton =
  "relative flex h-11 w-11 items-center justify-center rounded-2xl font-heading text-xs font-bold transition-all duration-200 hover:scale-110 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF] cursor-pointer";
const cardClass =
  "z-50 w-68 rounded-2xl bg-[#1D202A] p-4 text-left text-sm shadow-2xl shadow-black/60 ring-1 ring-[#2A2E39] animate-slide-up";

export function CollaborationDock() {
  const { project } = useProject();
  const { member: me, setCurrentMember } = useCurrentMember();
  const { profile } = useProfile();
  const pathname = usePathname();
  const [panel, setPanel] = useState<Panel>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const dockRef = useRef<HTMLElement>(null);

  // Close an open panel on Escape or a click outside the dock.
  useEffect(() => {
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPanel(null);
    const onClick = (e: MouseEvent) => {
      if (dockRef.current && !dockRef.current.contains(e.target as Node)) setPanel(null);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [panel]);

  const today = todayIsoDay();
  const shortCourse = project.course.split(":")[0]?.trim() || project.name;
  const courseCode = shortCourse.match(/\d{3}/)?.[0] ?? shortCourse.slice(0, 3);
  const deadline = toIsoDay(project.deadline);
  const attention = findPlanProblems(project.tasks, today).filter(needsAttention);
  const isHome = pathname === "/" || pathname === "/start";
  const inProject = ["/project", "/plan", "/dashboard", "/meeting"].some((p) => pathname.startsWith(p));

  const toggle = (next: NonNullable<Panel>) =>
    setPanel((cur) =>
      cur && cur.kind === next.kind && (cur.kind !== "member" || (next.kind === "member" && cur.id === next.id))
        ? null
        : next
    );

  const copyInvite = async () => {
    try {
      const teamObj = {
        name: project.name || "SFSU Group Project",
        course: project.course || undefined,
        members: project.members.map((m) => ({
          id: m.id,
          name: m.name,
          major: m.role,
          skills: m.skills,
          wantsToLearn: m.wantsToLearn,
        })),
      };
      const hash = encodeTeam(teamObj);
      const url = `${window.location.origin}/team#${hash}`;
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    } catch {
      setCopiedLink(false);
    }
  };

  // Me first, then teammates.
  const people = [...project.members].sort((a, b) => (a.id === me?.id ? -1 : b.id === me?.id ? 1 : 0));
  const visible = people.slice(0, 5);
  const overflow = people.length - visible.length;

  return (
    <nav
      ref={dockRef}
      aria-label="Collaboration dock"
      className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-around gap-1 border-t border-[#2A2E39] bg-[#171A23]/95 px-2 py-2 backdrop-blur md:inset-x-auto md:inset-y-0 md:left-0 md:w-16 md:flex-col md:justify-start md:gap-2 md:border-r md:border-t-0 md:py-4"
    >
      {/* 1. Context: Home */}
      <Link
        href="/"
        aria-label="Home"
        aria-current={isHome ? "page" : undefined}
        className={`${dockButton} ${
          isHome ? "bg-[#D5B45C] text-[#0F1117] shadow-md shadow-[#D5B45C]/20" : "bg-[#1D202A] text-[#F5F2FA]"
        }`}
      >
        GX
      </Link>

      {/* 2. Current Project / Course */}
      <div className="group relative">
        <button
          type="button"
          aria-label={`${project.course}. ${project.name}`}
          aria-expanded={panel?.kind === "collab"}
          onClick={() => toggle({ kind: "collab" })}
          className={`${dockButton} ${
            inProject ? "bg-[#B8A6FF]/20 text-[#B8A6FF] ring-2 ring-[#B8A6FF]/60" : "bg-[#1D202A] text-[#F5F2FA]"
          }`}
        >
          {courseCode}
          {attention.length > 0 && (
            <span
              aria-hidden
              className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#D5B45C] ring-2 ring-[#171A23] pulse-gold"
            />
          )}
        </button>
        {panel?.kind === "collab" && (
          <div className="absolute bottom-full left-0 mb-3 md:bottom-auto md:left-full md:top-0 md:mb-0 md:ml-3">
            <div className={cardClass}>
              <div className="border-b border-[#2A2E39] pb-2 mb-2">
                <p className="font-heading font-bold text-[#F5F2FA] text-base">{shortCourse}</p>
                <p className="text-xs text-[#AAA5B4]">{project.name}</p>
                {deadline && <p className="text-xs text-[#D5B45C] font-medium mt-1">Due {formatDay(deadline)}</p>}
              </div>

              <div className="space-y-1">
                <Link
                  href="/plan"
                  onClick={() => setPanel(null)}
                  className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold text-[#0F1117] bg-[#D5B45C] hover:bg-[#E2C36E] transition shadow-sm"
                >
                  <span>💻</span>
                  <span>AI Project Plan &amp; Tasks</span>
                </Link>
                <Link
                  href="/project"
                  onClick={() => setPanel(null)}
                  className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs text-[#F5F2FA] hover:bg-[#2A2E39] transition"
                >
                  <span>👥</span>
                  <span>Team Roster &amp; Profiles</span>
                </Link>
                <Link
                  href="/meet"
                  onClick={() => setPanel(null)}
                  className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs text-[#F5F2FA] hover:bg-[#2A2E39] transition"
                >
                  <span>🗓️</span>
                  <span>Quick Meet Poll</span>
                </Link>
                <Link
                  href="/team"
                  onClick={() => setPanel(null)}
                  className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs text-[#B8A6FF] hover:bg-[#2A2E39] transition"
                >
                  <span>➕</span>
                  <span>Form or Switch Team</span>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      <span aria-hidden className="hidden h-px w-8 bg-[#2A2E39] md:block" />

      {/* 3. People Roster with Instant Persona Switcher */}
      <ul aria-label="Team" className="flex items-center gap-1 md:flex-col md:gap-2">
        {visible.map((member) => {
          const state = memberState(project, member);
          const isMe = member.id === me?.id;
          const open = panel?.kind === "member" && panel.id === member.id;
          return (
            <li key={member.id} className="group relative">
              <button
                type="button"
                aria-label={`${member.name}${isMe ? " (you)" : ""}. ${state.line}${state.detail ? `. ${state.detail}` : ""}`}
                aria-expanded={open}
                onClick={() => toggle({ kind: "member", id: member.id })}
                className={`${dockButton} rounded-full transition-transform ${
                  isMe
                    ? "bg-[#D5B45C] text-[#0F1117] ring-2 ring-[#D5B45C] ring-offset-2 ring-offset-[#0F1117] shadow-sm shadow-[#D5B45C]/30"
                    : "bg-[#1D202A] text-[#F5F2FA]"
                }`}
              >
                {member.initials}
                <span
                  aria-hidden
                  className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-[#171A23] ${TONE[state.tone].dot}`}
                />
              </button>

              {open && (
                <div
                  role="dialog"
                  aria-label={member.name}
                  className="absolute bottom-full left-1/2 mb-3 -translate-x-1/2 md:bottom-auto md:left-full md:top-0 md:mb-0 md:ml-3 md:translate-x-0"
                >
                  <div className={cardClass}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-heading font-bold text-[#F5F2FA] text-base">
                          {member.name}
                          {isMe && <span className="ml-1.5 text-xs font-semibold text-[#D5B45C]">(You)</span>}
                        </p>
                        {member.role && <p className="text-xs font-medium text-[#B8A6FF]">{member.role}</p>}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${state.tone === "attention" ? "bg-[#D5B45C]/20 text-[#D5B45C]" : "bg-[#171A23] text-[#AAA5B4]"}`}>
                        {state.tone === "attention" ? "Needs help" : "Active"}
                      </span>
                    </div>

                    <div className="mt-2.5 rounded-xl bg-[#171A23] p-2.5 border border-[#2A2E39]">
                      <p className={`text-xs font-medium ${state.tone === "attention" ? "text-[#D5B45C]" : "text-[#F5F2FA]"}`}>
                        <span aria-hidden className="mr-1">{TONE[state.tone].label}</span>
                        {state.line}
                      </p>
                      {state.detail && <p className="text-[11px] text-[#AAA5B4] mt-0.5">{state.detail}</p>}
                    </div>

                    {member.skills.length > 0 && (
                      <p className="mt-2 text-[11px] text-[#AAA5B4]">
                        Skills: <span className="text-[#F5F2FA]/90">{member.skills.slice(0, 3).join(", ")}</span>
                      </p>
                    )}

                    <div className="mt-3.5 flex flex-wrap gap-2 pt-2 border-t border-[#2A2E39]">
                      {isMe ? (
                        <Link
                          href="/profile"
                          onClick={() => setPanel(null)}
                          className="rounded-lg bg-[#D5B45C] px-3 py-1.5 text-xs font-semibold text-[#0F1117] hover:bg-[#E2C36E] transition shadow-sm"
                        >
                          Edit Profile &amp; Roles
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setCurrentMember(member.id);
                            setPanel(null);
                          }}
                          className="rounded-lg bg-[#D5B45C] px-3 py-1.5 text-xs font-semibold text-[#0F1117] hover:bg-[#E2C36E] transition shadow-sm active:scale-95"
                        >
                          Switch to {member.name.split(" ")[0]}
                        </button>
                      )}
                      <Link
                        href="/plan"
                        onClick={() => setPanel(null)}
                        className="rounded-lg border border-[#B8A6FF]/40 bg-[#171A23] px-3 py-1.5 text-xs font-medium text-[#F5F2FA] hover:bg-[#B8A6FF]/15 transition"
                      >
                        See steps
                      </Link>
                      {!isMe && (
                        <Link
                          href={`/meet#${encodePoll({ title: `With ${member.name.split(" ")[0]}`, durationMinutes: 30, people: [] })}`}
                          onClick={() => setPanel(null)}
                          className="rounded-lg border border-[#B8A6FF]/40 bg-[#171A23] px-3 py-1.5 text-xs font-medium text-[#F5F2FA] hover:bg-[#B8A6FF]/15 transition"
                        >
                          Find a time
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </li>
          );
        })}

        {/* 4. Instant Add / Invite Teammate Button in Dock */}
        <li className="group relative">
          <button
            type="button"
            aria-label="Add or Invite Teammate"
            aria-expanded={panel?.kind === "add-member"}
            onClick={() => toggle({ kind: "add-member" })}
            className={`${dockButton} rounded-full border border-dashed border-[#B8A6FF]/40 bg-[#171A23] text-sm font-semibold text-[#B8A6FF] hover:border-[#D5B45C] hover:text-[#D5B45C]`}
            title="Add or invite teammates"
          >
            +👤
          </button>
          {panel?.kind === "add-member" && (
            <div className="absolute bottom-full left-1/2 mb-3 -translate-x-1/2 md:bottom-auto md:left-full md:top-0 md:mb-0 md:ml-3 md:translate-x-0 z-50">
              <div className={cardClass}>
                <p className="font-heading font-semibold text-[#F5F2FA]">Team &amp; Members</p>
                <p className="text-xs text-[#AAA5B4] mt-0.5">{project.members.length} teammates configured</p>
                <div className="mt-3 space-y-2">
                  <Link
                    href="/team"
                    onClick={() => setPanel(null)}
                    className="flex items-center gap-2 rounded-xl bg-[#D5B45C] px-3 py-2 text-xs font-semibold text-[#0F1117] hover:bg-[#E2C36E] transition shadow-sm w-full"
                  >
                    <span>➕</span>
                    <span>Add Teammate with Profile</span>
                  </Link>
                  <Link
                    href="/project"
                    onClick={() => setPanel(null)}
                    className="flex items-center gap-2 rounded-xl border border-[#B8A6FF]/40 bg-[#171A23] px-3 py-2 text-xs font-medium text-[#F5F2FA] hover:bg-[#B8A6FF]/15 transition w-full"
                  >
                    <span>👥</span>
                    <span>View Roster &amp; Skills</span>
                  </Link>
                  <button
                    type="button"
                    onClick={copyInvite}
                    className="flex items-center gap-2 rounded-xl border border-[#2A2E39] bg-[#171A23] px-3 py-2 text-xs text-[#AAA5B4] hover:text-[#F5F2FA] hover:bg-[#2A2E39] transition w-full cursor-pointer"
                  >
                    <span>🔗</span>
                    <span>{copiedLink ? "Invite link copied ✓" : "Copy Team Invite Link"}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </li>

        {overflow > 0 && (
          <li>
            <Link
              href="/project"
              aria-label={`${overflow} more people`}
              className={`${dockButton} rounded-full bg-[#1D202A] text-[#AAA5B4]`}
            >
              +{overflow}
            </Link>
          </li>
        )}
      </ul>

      <span aria-hidden className="hidden h-px w-8 bg-[#2A2E39] md:block" />

      {/* 5. Universal Coordinate Action */}
      <div className="group relative">
        <Link
          href="/#coordinate"
          aria-label="Coordinate something"
          className={`${dockButton} bg-[#1D202A] text-lg font-normal text-[#D5B45C] hover:text-[#E2C36E]`}
        >
          +
        </Link>
        <div
          role="tooltip"
          className="pointer-events-none invisible absolute left-full top-1 ml-3 hidden whitespace-nowrap rounded-lg bg-[#1D202A] px-3 py-1.5 text-xs text-[#F5F2FA] opacity-0 ring-1 ring-[#2A2E39] transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100 md:block"
        >
          Coordinate something
        </div>
      </div>

      {/* 6. More / Persona Switcher Drawer */}
      <div className="relative md:mt-auto">
        <button
          type="button"
          aria-label="More"
          aria-expanded={panel?.kind === "more"}
          onClick={() => toggle({ kind: "more" })}
          className={`${dockButton} bg-transparent text-[#AAA5B4] hover:bg-[#1D202A]`}
        >
          •••
        </button>
        {panel?.kind === "more" && (
          <div className="absolute bottom-full right-0 mb-3 md:bottom-0 md:left-full md:right-auto md:mb-0 md:ml-3">
            <div className={`${cardClass} w-60`}>
              <p className="mb-1 text-xs text-[#AAA5B4]">
                {me ? `Active as ${me.name.split(" ")[0]} on this device` : "Who are you?"}
              </p>
              <button
                type="button"
                onClick={() => {
                  setCurrentMember(null);
                  setPanel(null);
                }}
                className="block w-full rounded-xl px-2 py-2 text-left text-[#F5F2FA] hover:bg-[#2A2E39] transition text-xs"
              >
                {me ? "Switch student persona" : "Choose who you are"}
              </button>
              <Link
                href="/profile"
                onClick={() => setPanel(null)}
                className="block rounded-xl px-2 py-2 text-[#F5F2FA] hover:bg-[#2A2E39] transition text-xs"
              >
                {profile ? "🎓 Master Profile & Skills" : "+ Create profile"}
              </Link>
              <Link
                href="/team"
                onClick={() => setPanel(null)}
                className="block rounded-xl px-2 py-2 text-[#F5F2FA] hover:bg-[#2A2E39] transition text-xs"
              >
                Form or join a team
              </Link>
              <Link
                href="/project"
                onClick={() => setPanel(null)}
                className="block rounded-xl px-2 py-2 text-[#F5F2FA] hover:bg-[#2A2E39] transition text-xs"
              >
                Team roster &amp; skills
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

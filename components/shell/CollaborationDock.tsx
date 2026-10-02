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

/**
 * Collaboration Dock: "Where am I, and who am I here with?"
 * Presence over menus. Home, the current collaboration and the people are
 * shown as recognizable objects; details appear on hover, focus or tap.
 * Feature navigation (Plan, Board, Meetings) stays inside the collaboration.
 */

type Panel = { kind: "collab" } | { kind: "member"; id: string } | { kind: "more" } | null;

interface MemberState {
  line: string;
  detail?: string;
  tone: "working" | "waiting" | "attention" | "clear";
}

/** Describes the work around a person, never the person (no scores, no "behind"). */
function memberState(project: Project, member: Member): MemberState {
  const today = todayIsoDay();
  const steps = orderSteps(project.tasks, project.members).filter((s) => s.task.ownerId === member.id && s.state !== "done");
  const problem = findPlanProblems(project.tasks, today).find((p) => needsAttention(p) && p.task.ownerId === member.id);
  if (problem) return { line: `${problem.task.title} ${PROBLEM_PHRASE[problem.kind]}`, tone: "attention" };
  const current = steps.find((s) => s.state === "doing") ?? steps.find((s) => s.state === "ready") ?? steps[0];
  if (!current) return { line: "No current step", tone: "clear" };
  const due = current.task.dueDate ? `Due ${formatDay(current.task.dueDate)}` : undefined;
  if (current.state === "waiting" || current.state === "later") {
    return { line: current.task.title, detail: [due, `Waiting on ${current.waitingOn[0] ?? "an earlier step"}`].filter(Boolean).join(" · "), tone: "waiting" };
  }
  return { line: current.task.title, detail: [due, current.state === "doing" ? "Working on it" : "Ready to start"].filter(Boolean).join(" · "), tone: "working" };
}

const TONE: Record<MemberState["tone"], { dot: string; label: string }> = {
  working: { dot: "bg-[#B8A6FF]", label: "●" },
  waiting: { dot: "bg-[#AAA5B4]", label: "‖" },
  attention: { dot: "bg-[#D5B45C]", label: "⚠" },
  clear: { dot: "bg-[#B8A6FF]", label: "✓" },
};

const dockButton =
  "relative flex h-11 w-11 items-center justify-center rounded-2xl font-heading text-xs font-bold transition hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]";
const cardClass =
  "z-50 w-64 rounded-2xl bg-[#1D202A] p-4 text-left text-sm shadow-xl shadow-black/40 ring-1 ring-[#2A2E39]";

export function CollaborationDock() {
  const { project } = useProject();
  const { member: me, setCurrentMember } = useCurrentMember();
  const { profile } = useProfile();
  const pathname = usePathname();
  const [panel, setPanel] = useState<Panel>(null);
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
    setPanel((cur) => (cur && cur.kind === next.kind && (cur.kind !== "member" || (next.kind === "member" && cur.id === next.id)) ? null : next));

  // Me first, then teammates.
  const people = [...project.members].sort((a, b) => (a.id === me?.id ? -1 : b.id === me?.id ? 1 : 0));
  const visible = people.slice(0, 5);
  const overflow = people.length - visible.length;

  const collabCard = (
    <div className={cardClass}>
      <p className="font-heading font-semibold text-[#F5F2FA]">{shortCourse}</p>
      <p className="text-[#AAA5B4]">{project.course.split(":")[1]?.trim()}</p>
      <p className="mt-2 text-[#F5F2FA]">{project.name}</p>
      {deadline && <p className="text-[#AAA5B4]">Due {formatDay(deadline)}</p>}
      {attention.length > 0 && (
        <p className="mt-2 text-[#D5B45C]">⚠ {attention.length === 1 ? "1 thing needs attention" : `${attention.length} things need attention`}</p>
      )}
    </div>
  );

  return (
    <nav
      ref={dockRef}
      aria-label="Collaboration dock"
      className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-around gap-1 border-t border-[#2A2E39] bg-[#171A23]/95 px-2 py-2 backdrop-blur md:inset-x-auto md:inset-y-0 md:left-0 md:w-16 md:flex-col md:justify-start md:gap-2 md:border-r md:border-t-0 md:py-4"
    >
      {/* Context: home + current collaboration */}
      <Link
        href="/"
        aria-label="Home"
        aria-current={isHome ? "page" : undefined}
        className={`${dockButton} ${isHome ? "bg-[#B8A6FF] text-[#0F1117]" : "bg-[#1D202A] text-[#F5F2FA]"}`}
      >
        GX
      </Link>

      <div className="group relative">
        <button
          type="button"
          aria-label={`${project.course}. ${project.name}`}
          aria-expanded={panel?.kind === "collab"}
          onClick={() => toggle({ kind: "collab" })}
          className={`${dockButton} ${inProject ? "bg-[#B8A6FF]/20 text-[#B8A6FF] ring-1 ring-[#B8A6FF]/60" : "bg-[#1D202A] text-[#F5F2FA]"}`}
        >
          {courseCode}
          {attention.length > 0 && (
            <span aria-hidden className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#D5B45C] ring-2 ring-[#171A23]" />
          )}
        </button>
        {panel?.kind === "collab" ? (
          <div className="absolute bottom-full left-0 mb-3 md:bottom-auto md:left-full md:top-0 md:mb-0 md:ml-3">
            <div className={cardClass}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#AAA5B4]">Your collaborations</p>
              <Link href="/plan" onClick={() => setPanel(null)} className="block rounded-xl px-2 py-2 hover:bg-[#2A2E39]">
                <span className="text-[#B8A6FF]">●</span> <span className="font-semibold text-[#F5F2FA]">{shortCourse}</span>
                <span className="block pl-4 text-[#AAA5B4]">{project.name}</span>
              </Link>
              <Link href="/meet" onClick={() => setPanel(null)} className="block rounded-xl px-2 py-2 text-[#F5F2FA] hover:bg-[#2A2E39]">
                <span className="text-[#AAA5B4]">○</span> Quick meet
              </Link>
              <Link href="/team" onClick={() => setPanel(null)} className="mt-1 block rounded-xl px-2 py-2 text-[#B8A6FF] hover:bg-[#2A2E39]">
                + Form a team
              </Link>
              <Link href="/#coordinate" onClick={() => setPanel(null)} className="block rounded-xl px-2 py-2 text-[#B8A6FF] hover:bg-[#2A2E39]">
                + Coordinate something
              </Link>
            </div>
          </div>
        ) : (
          <div
            role="tooltip"
            className="pointer-events-none invisible absolute left-full top-0 ml-3 hidden opacity-0 transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100 md:block"
          >
            {collabCard}
          </div>
        )}
      </div>

      <span aria-hidden className="hidden h-px w-8 bg-[#2A2E39] md:block" />

      {/* People */}
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
                className={`${dockButton} rounded-full ${isMe ? "bg-[#B8A6FF] text-[#0F1117]" : "bg-[#1D202A] text-[#F5F2FA]"}`}
              >
                {member.initials}
                <span
                  aria-hidden
                  className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-[#171A23] ${TONE[state.tone].dot}`}
                />
              </button>
              <div
                role={open ? "dialog" : "tooltip"}
                aria-label={open ? member.name : undefined}
                className={`absolute bottom-full left-1/2 mb-3 -translate-x-1/2 transition md:bottom-auto md:left-full md:top-0 md:mb-0 md:ml-3 md:translate-x-0 ${
                  open
                    ? "visible opacity-100"
                    : "pointer-events-none invisible opacity-0 md:group-focus-within:visible md:group-focus-within:opacity-100 md:group-hover:visible md:group-hover:opacity-100"
                }`}
              >
                <div className={cardClass}>
                  <p className="font-heading font-semibold text-[#F5F2FA]">
                    {member.name}
                    {isMe && <span className="ml-1 text-xs font-normal text-[#AAA5B4]">you</span>}
                  </p>
                  <p className={`mt-2 ${state.tone === "attention" ? "text-[#D5B45C]" : "text-[#F5F2FA]"}`}>
                    <span aria-hidden className="mr-1">{TONE[state.tone].label}</span>
                    {state.line}
                  </p>
                  {state.detail && <p className="text-[#AAA5B4]">{state.detail}</p>}
                  {member.role && <p className="mt-1.5 text-xs font-medium text-[#B8A6FF]">{member.role}</p>}
                  {member.skills.length > 0 && (
                    <p className="mt-1 text-xs text-[#AAA5B4]">Active: {member.skills.slice(0, 4).join(", ")}</p>
                  )}
                  {open && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {isMe && (
                        <Link
                          href="/profile"
                          onClick={() => setPanel(null)}
                          className="rounded-lg bg-[#B8A6FF] px-3 py-1.5 text-xs font-semibold text-[#0F1117] hover:bg-[#B8A6FF]/90"
                        >
                          Edit Profile &amp; Roles
                        </Link>
                      )}
                      <Link
                        href="/plan"
                        onClick={() => setPanel(null)}
                        className="rounded-lg bg-[#2A2E39] px-3 py-1.5 text-xs font-medium text-[#F5F2FA] hover:bg-[#B8A6FF]/10"
                      >
                        See steps
                      </Link>
                      {!isMe && (
                        <Link
                          href={`/meet#${encodePoll({ title: `With ${member.name.split(" ")[0]}`, durationMinutes: 30, people: [] })}`}
                          onClick={() => setPanel(null)}
                          className="rounded-lg bg-[#2A2E39] px-3 py-1.5 text-xs font-medium text-[#F5F2FA] hover:bg-[#B8A6FF]/10"
                        >
                          Find a time
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
        {overflow > 0 && (
          <li>
            <Link href="/project" aria-label={`${overflow} more people`} className={`${dockButton} rounded-full bg-[#1D202A] text-[#AAA5B4]`}>
              +{overflow}
            </Link>
          </li>
        )}
      </ul>

      <span aria-hidden className="hidden h-px w-8 bg-[#2A2E39] md:block" />

      {/* Universal actions */}
      <div className="group relative">
        <Link href="/#coordinate" aria-label="Coordinate something" className={`${dockButton} bg-[#1D202A] text-lg font-normal text-[#B8A6FF]`}>
          +
        </Link>
        <div
          role="tooltip"
          className="pointer-events-none invisible absolute left-full top-1 ml-3 hidden whitespace-nowrap rounded-lg bg-[#1D202A] px-3 py-1.5 text-xs text-[#F5F2FA] opacity-0 ring-1 ring-[#2A2E39] transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100 md:block"
        >
          Coordinate something
        </div>
      </div>

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
            <div className={`${cardClass} w-56`}>
              <p className="mb-1 text-xs text-[#AAA5B4]">{me ? `You're ${me.name.split(" ")[0]} on this device` : "Who are you?"}</p>
              <button
                type="button"
                onClick={() => {
                  setCurrentMember(null);
                  setPanel(null);
                }}
                className="block w-full rounded-xl px-2 py-2 text-left text-[#F5F2FA] hover:bg-[#2A2E39]"
              >
                {me ? "Switch person" : "Choose who you are"}
              </button>
              <Link href="/profile" onClick={() => setPanel(null)} className="block rounded-xl px-2 py-2 text-[#F5F2FA] hover:bg-[#2A2E39]">
                {profile ? "Your profile" : "Create your profile"}
              </Link>
              <Link href="/team" onClick={() => setPanel(null)} className="block rounded-xl px-2 py-2 text-[#F5F2FA] hover:bg-[#2A2E39]">
                Form or join a team
              </Link>
              <Link href="/project" onClick={() => setPanel(null)} className="block rounded-xl px-2 py-2 text-[#F5F2FA] hover:bg-[#2A2E39]">
                Team &amp; skills
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

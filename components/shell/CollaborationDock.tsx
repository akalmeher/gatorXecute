"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Member, Project } from "@/types";
import { useProject } from "@/context/ProjectContext";
import { useCurrentMember } from "@/features/identity/useCurrentMember";
import { findPlanProblems, needsAttention, PROBLEM_PHRASE } from "@/features/plan/plan-health";
import { formatDay, orderSteps } from "@/features/plan/plan-display";
import { toIsoDay, todayIsoDay } from "@/features/plan/plan-validation";
import { encodePoll, type MeetPerson, type MeetPoll } from "@/features/meet/meet-link";
import { useProfile } from "@/features/profile/useProfile";
import { encodeTeam } from "@/features/team/team-link";
import { initialsOf, normalizeTags } from "@/features/profile/profile";
import { encodeWorkspace } from "@/features/project/workspace-share";

/**
 * Feature Owner: Divij Anand & Ammar Almeher
 * Collaboration Dock: "Where am I, and who am I here with?"
 * Discord-style Bubble Folder & Team Workspace Hub:
 * - Bubble Folder: Groups the course node (CSC 648) and teammates into an enclosed bubble tray.
 * - Expand / Collapse: Smooth toggle between compact folder bubble and open team bubble.
 * - Double-click Project Icon: Jump straight to the project setup & overview (/project).
 * - Single-click Member Profile: Opens detailed presence with instant When2Meet button & persona switch.
 * - Double-click Member Profile: Jump directly to When2Meet with pre-loaded team availability.
 * - +📁 Workspace Hub: Multi-device sync across laptops, new account creation, and new course projects.
 */

type Panel =
  | { kind: "collab" }
  | { kind: "member"; id: string }
  | { kind: "more" }
  | { kind: "add-member" }
  | { kind: "workspace-hub" }
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
  "relative flex h-11 w-11 items-center justify-center rounded-2xl font-heading text-xs font-bold transition-transform duration-200 ease-out hover:scale-110 active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D5B45C] cursor-pointer select-none";
const cardClass =
  "z-50 w-80 rounded-2xl bg-[#1D202A] p-4 text-left text-sm shadow-2xl shadow-black/80 ring-1 ring-[#2A2E39] animate-popover";

export function CollaborationDock() {
  const router = useRouter();
  const { project, addMember, startProject } = useProject();
  const { member: me, setCurrentMember } = useCurrentMember();
  const { profile, saveProfile } = useProfile();
  const pathname = usePathname();

  // Panels & UI State
  const [panel, setPanel] = useState<Panel>(null);
  const [isFolderOpen, setIsFolderOpen] = useState(true);
  const [hubTab, setHubTab] = useState<"sync" | "account" | "project">("sync");
  const [copiedWorkspace, setCopiedWorkspace] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // New Student Account Form State
  const [newAccName, setNewAccName] = useState("");
  const [newAccMajor, setNewAccMajor] = useState("");
  const [newAccSkills, setNewAccSkills] = useState("");
  const [newAccWants, setNewAccWants] = useState("");

  // New Course / Project Form State
  const [newProjName, setNewProjName] = useState("");
  const [newProjCourse, setNewProjCourse] = useState("");

  const dockRef = useRef<HTMLElement>(null);

  // Close open panel on Escape or click outside the dock
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
  const shortCourse = project.course.split(":")[0]?.trim() || project.name || "CSC 648";
  const courseCode = shortCourse.match(/\d{3}/)?.[0] ?? shortCourse.slice(0, 3) ?? "648";
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

  /** Double-click action for Course / Project icon: jump straight to project page */
  const handleCollabDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setPanel(null);
    router.push("/project");
  };

  /** Pre-loads When2Meet availability for this teammate and current user */
  const when2meetHref = (target: Member) => {
    const targetBlocks = project.availability.filter((b) => b.memberId === target.id);
    const myBlocks = me ? project.availability.filter((b) => b.memberId === me.id) : [];

    const people: MeetPerson[] = [
      {
        id: target.id,
        name: target.name,
        blocks: targetBlocks,
      },
    ];
    if (me && me.id !== target.id) {
      people.push({
        id: me.id,
        name: me.name,
        blocks: myBlocks,
      });
    }

    const poll: MeetPoll = {
      title: `1:1 with ${target.name.split(" ")[0]}`,
      durationMinutes: 30,
      people,
    };
    return `/meet#${encodePoll(poll)}`;
  };

  /** Double-click action for a member avatar: directly jump to When2Meet with them */
  const handleMemberDoubleClick = (target: Member, e: React.MouseEvent) => {
    e.preventDefault();
    setPanel(null);
    router.push(when2meetHref(target));
  };

  /** Copies entire workspace state to URL so teammates on other laptops get master control */
  const handleCopyWorkspace = async () => {
    try {
      const hash = encodeWorkspace(project);
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const path = typeof window !== "undefined" && window.location.pathname.startsWith("/dashboard")
        ? window.location.pathname
        : "/dashboard";
      const fullUrl = `${origin}${path}#workspace=${hash}`;
      await navigator.clipboard.writeText(fullUrl);
      setCopiedWorkspace(true);
      setTimeout(() => setCopiedWorkspace(false), 3500);
    } catch {
      setCopiedWorkspace(false);
    }
  };

  /** Creates brand new student account & adds to workspace */
  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName.trim()) return;
    const id = `mem-${Date.now().toString(36)}`;
    const initials = initialsOf(newAccName);
    const skills = normalizeTags(newAccSkills.split(",").map((s) => s.trim()));
    const wantsToLearn = normalizeTags(newAccWants.split(",").map((s) => s.trim()));
    const newMember: Member = {
      id,
      name: newAccName.trim(),
      role: newAccMajor.trim() || "Student",
      skills,
      wantsToLearn,
      initials,
    };
    addMember(newMember);
    setCurrentMember(id);
    saveProfile({
      id,
      name: newAccName.trim(),
      major: newAccMajor.trim(),
      skills,
      wantsToLearn,
    });
    setNewAccName("");
    setNewAccMajor("");
    setNewAccSkills("");
    setNewAccWants("");
    setPanel(null);
  };

  /** Creates new course / project folder */
  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjName.trim()) return;
    startProject({
      name: newProjName.trim(),
      course: newProjCourse.trim() || undefined,
      members: project.members,
    });
    setNewProjName("");
    setNewProjCourse("");
    setPanel(null);
    router.push("/project");
  };

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

      <span aria-hidden className="hidden h-px w-8 bg-[#2A2E39] md:block" />

      {/* 2. Discord-style Bubble Folder for Course & Teammates */}
      {isFolderOpen ? (
        <div
          role="group"
          aria-label={`${shortCourse} Team Bubble Folder`}
          className="relative rounded-[28px] bg-[#1D202A]/90 border border-[#2A2E39] p-1.5 flex items-center md:flex-col gap-1.5 shadow-md shadow-black/40 ring-1 ring-[#B8A6FF]/20 transition-all duration-300"
        >
          {/* Folder Collapse Toggle */}
          <button
            type="button"
            onClick={() => setIsFolderOpen(false)}
            aria-label="Collapse team bubble folder"
            title={`${shortCourse} Folder · Click to collapse`}
            className="flex h-4 w-7 md:w-8 items-center justify-center rounded-full bg-[#2A2E39]/70 hover:bg-[#B8A6FF]/30 text-[9px] text-[#AAA5B4] hover:text-[#F5F2FA] transition cursor-pointer select-none"
          >
            📁
          </button>

          {/* Current Project / Course Bubble (Double-click to jump to Project Page) */}
          <div className="group relative">
            <button
              type="button"
              aria-label={`${project.course}. ${project.name}. Double-click to open Project page.`}
              title={`${shortCourse} · Click for menu · Double-click to open Project`}
              aria-expanded={panel?.kind === "collab"}
              onClick={() => toggle({ kind: "collab" })}
              onDoubleClick={handleCollabDoubleClick}
              className={`${dockButton} ${
                inProject ? "bg-[#B8A6FF]/25 text-[#B8A6FF] ring-2 ring-[#B8A6FF]/70" : "bg-[#171A23] text-[#F5F2FA]"
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

            {/* Course Project Popover Menu */}
            {panel?.kind === "collab" && (
              <div className="absolute bottom-full left-0 mb-3 md:bottom-auto md:left-full md:top-0 md:mb-0 md:ml-3">
                <div className={cardClass}>
                  <div className="border-b border-[#2A2E39] pb-2 mb-2">
                    <p className="font-heading font-bold text-[#F5F2FA] text-base">{shortCourse}</p>
                    <p className="text-xs text-[#AAA5B4]">{project.name}</p>
                    {deadline && <p className="text-xs text-[#D5B45C] font-semibold mt-1">Due {formatDay(deadline)}</p>}
                  </div>

                  <div className="space-y-1">
                    <Link
                      href="/project"
                      onClick={() => setPanel(null)}
                      className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold text-[#0F1117] bg-[#D5B45C] hover:bg-[#E2C36E] transition shadow-sm active:scale-95"
                    >
                      <span>📋</span>
                      <span>Open Project Overview</span>
                    </Link>
                    <Link
                      href="/dashboard"
                      onClick={() => setPanel(null)}
                      className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs text-[#F5F2FA] hover:bg-[#2A2E39] transition"
                    >
                      <span>📊</span>
                      <span>Team Dashboard &amp; Tasks</span>
                    </Link>
                    <Link
                      href="/plan"
                      onClick={() => setPanel(null)}
                      className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs text-[#F5F2FA] hover:bg-[#2A2E39] transition"
                    >
                      <span>💻</span>
                      <span>AI Plan &amp; Tasks</span>
                    </Link>
                    <Link
                      href="/meet"
                      onClick={() => setPanel(null)}
                      className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs text-[#F5F2FA] hover:bg-[#2A2E39] transition"
                    >
                      <span>🗓️</span>
                      <span>Quick Meet Poll</span>
                    </Link>
                  </div>
                  <p className="text-[10px] text-[#AAA5B4]/60 text-center mt-2.5 pt-2 border-t border-[#2A2E39]/60">
                    Tip: Double-click dock icon to jump straight to Project
                  </p>
                </div>
              </div>
            )}
          </div>

          <span aria-hidden className="h-4 w-px bg-[#2A2E39] md:h-px md:w-6" />

          {/* Teammates inside the Bubble Folder */}
          <ul aria-label="Teammates in folder" className="flex items-center gap-1 md:flex-col md:gap-1.5">
            {visible.map((member) => {
              const state = memberState(project, member);
              const isMe = member.id === me?.id;
              const open = panel?.kind === "member" && panel.id === member.id;
              return (
                <li key={member.id} className="group relative">
                  <button
                    type="button"
                    aria-label={`${member.name}${isMe ? " (you)" : ""}. ${state.line}. Double-click for When2Meet.`}
                    title={`${member.name} · Click for options, Double-click for When2Meet`}
                    aria-expanded={open}
                    onClick={() => toggle({ kind: "member", id: member.id })}
                    onDoubleClick={(e) => handleMemberDoubleClick(member, e)}
                    className={`${dockButton} rounded-full transition-all duration-200 ${
                      isMe
                        ? "bg-[#D5B45C] text-[#0F1117] ring-2 ring-[#D5B45C] ring-offset-2 ring-offset-[#0F1117] ring-pulse-gold shadow-md shadow-[#D5B45C]/30"
                        : "bg-[#171A23] text-[#F5F2FA] hover:border-[#B8A6FF]/60"
                    }`}
                  >
                    {member.initials}
                    <span
                      aria-hidden
                      className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-[#171A23] ${TONE[state.tone].dot}`}
                    />
                  </button>

                  {/* Teammate Presence Popover */}
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
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              state.tone === "attention"
                                ? "bg-[#D5B45C]/20 text-[#D5B45C]"
                                : "bg-[#171A23] text-[#AAA5B4]"
                            }`}
                          >
                            {state.tone === "attention" ? "Needs help" : "Active"}
                          </span>
                        </div>

                        <div className="mt-2.5 rounded-xl bg-[#171A23] p-2.5 border border-[#2A2E39]">
                          <p
                            className={`text-xs font-medium ${
                              state.tone === "attention" ? "text-[#D5B45C]" : "text-[#F5F2FA]"
                            }`}
                          >
                            <span aria-hidden className="mr-1">
                              {TONE[state.tone].label}
                            </span>
                            {state.line}
                          </p>
                          {state.detail && <p className="text-[11px] text-[#AAA5B4] mt-0.5">{state.detail}</p>}
                        </div>

                        {member.skills.length > 0 && (
                          <p className="mt-2 text-[11px] text-[#AAA5B4]">
                            Skills: <span className="text-[#F5F2FA]/90">{member.skills.slice(0, 3).join(", ")}</span>
                          </p>
                        )}

                        <div className="mt-3.5 space-y-2 pt-2 border-t border-[#2A2E39]">
                          {/* Primary Golden CTA: Instant When2Meet with this teammate */}
                          <Link
                            href={when2meetHref(member)}
                            onClick={() => setPanel(null)}
                            className="flex items-center justify-center gap-2 rounded-xl bg-[#D5B45C] px-3.5 py-2 text-xs font-semibold text-[#0F1117] hover:bg-[#E2C36E] transition shadow-md shadow-[#D5B45C]/20 active:scale-95 w-full cursor-pointer"
                          >
                            <span>🗓️</span>
                            <span>When2Meet with {member.name.split(" ")[0]}</span>
                          </Link>

                          <div className="flex flex-wrap gap-2">
                            {isMe ? (
                              <Link
                                href="/profile"
                                onClick={() => setPanel(null)}
                                className="flex-1 text-center rounded-xl border border-[#B8A6FF]/40 bg-[#171A23] px-3 py-1.5 text-xs font-semibold text-[#B8A6FF] hover:bg-[#B8A6FF] hover:text-[#0F1117] transition shadow-sm"
                              >
                                Edit Profile
                              </Link>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setCurrentMember(member.id);
                                  setPanel(null);
                                }}
                                className="flex-1 rounded-xl border border-[#B8A6FF]/40 bg-[#171A23] px-3 py-1.5 text-xs font-semibold text-[#B8A6FF] hover:bg-[#B8A6FF] hover:text-[#0F1117] transition shadow-sm active:scale-95 cursor-pointer"
                              >
                                Switch to {member.name.split(" ")[0]}
                              </button>
                            )}
                            <Link
                              href="/dashboard"
                              onClick={() => setPanel(null)}
                              className="rounded-xl border border-[#2A2E39] bg-[#171A23] px-3 py-1.5 text-xs font-medium text-[#AAA5B4] hover:text-[#F5F2FA] hover:bg-[#2A2E39] transition"
                            >
                              Tasks
                            </Link>
                          </div>

                          <p className="text-[10px] text-[#AAA5B4]/60 text-center pt-1">
                            Tip: Double-click avatar to jump straight to When2Meet
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}

            {/* Instant Add / Invite Teammate in Bubble Folder */}
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
                    <p className="text-xs text-[#AAA5B4] mt-0.5">{project.members.length} teammates in this folder</p>
                    <div className="mt-3 space-y-2">
                      <button
                        type="button"
                        onClick={() => {
                          setHubTab("account");
                          setPanel({ kind: "workspace-hub" });
                        }}
                        className="flex items-center gap-2 rounded-xl bg-[#D5B45C] px-3 py-2 text-xs font-semibold text-[#0F1117] hover:bg-[#E2C36E] transition shadow-sm w-full active:scale-95 cursor-pointer"
                      >
                        <span>👤</span>
                        <span>Create New Student Account</span>
                      </button>
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
        </div>
      ) : (
        /* Collapsed Discord-style Folder Bubble */
        <div className="group relative">
          <button
            type="button"
            onClick={() => setIsFolderOpen(true)}
            aria-label={`Open ${shortCourse} bubble folder (${project.members.length} teammates)`}
            title={`${shortCourse} Folder (${project.members.length} teammates) · Click to open`}
            className={`${dockButton} rounded-2xl bg-[#1D202A] text-[#F5F2FA] border border-[#2A2E39] hover:border-[#D5B45C] hover:text-[#D5B45C] flex flex-col items-center justify-center`}
          >
            <span className="text-sm">📁</span>
            <span className="text-[10px] font-bold text-[#D5B45C] -mt-1">{courseCode}</span>
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#B8A6FF] text-[9px] font-bold text-[#0F1117] ring-2 ring-[#171A23]">
              {project.members.length}
            </span>
          </button>
        </div>
      )}

      {/* 3. +📁 Workspace Hub Button: Multi-Device Sync, New Account, New Project */}
      <div className="group relative">
        <button
          type="button"
          aria-label="Workspace Hub: Sync across laptops, new account, or new course folder"
          title="Workspace Hub (+📁): Multi-device sync, new account, new course"
          aria-expanded={panel?.kind === "workspace-hub"}
          onClick={() => toggle({ kind: "workspace-hub" })}
          className={`${dockButton} rounded-2xl border border-dashed border-[#D5B45C]/60 bg-[#171A23] text-xs font-bold text-[#D5B45C] hover:bg-[#D5B45C]/15 transition active:scale-95 shadow-sm`}
        >
          +📁
        </button>

        {/* Workspace Hub Drawer / Modal */}
        {panel?.kind === "workspace-hub" && (
          <div className="absolute bottom-full left-1/2 mb-3 -translate-x-1/2 md:bottom-auto md:left-full md:top-0 md:mb-0 md:ml-3 md:translate-x-0 z-50">
            <div className={`${cardClass} w-88 max-h-[85vh] overflow-y-auto`}>
              <div className="flex items-center justify-between border-b border-[#2A2E39] pb-3 mb-3">
                <div>
                  <h3 className="font-heading font-bold text-[#F5F2FA] text-base">Workspace Hub</h3>
                  <p className="text-xs text-[#AAA5B4]">Sync across laptops &amp; manage profiles</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPanel(null)}
                  className="rounded-lg p-1 text-[#AAA5B4] hover:bg-[#2A2E39] hover:text-[#F5F2FA] text-xs"
                >
                  ✕
                </button>
              </div>

              {/* Navigation Tabs */}
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-[#171A23] p-1 border border-[#2A2E39] mb-4">
                <button
                  type="button"
                  onClick={() => setHubTab("sync")}
                  className={`rounded-lg py-1.5 text-xs font-semibold transition ${
                    hubTab === "sync"
                      ? "bg-[#D5B45C] text-[#0F1117] shadow-sm"
                      : "text-[#AAA5B4] hover:text-[#F5F2FA]"
                  }`}
                >
                  ⚡ Sync
                </button>
                <button
                  type="button"
                  onClick={() => setHubTab("account")}
                  className={`rounded-lg py-1.5 text-xs font-semibold transition ${
                    hubTab === "account"
                      ? "bg-[#D5B45C] text-[#0F1117] shadow-sm"
                      : "text-[#AAA5B4] hover:text-[#F5F2FA]"
                  }`}
                >
                  👤 Account
                </button>
                <button
                  type="button"
                  onClick={() => setHubTab("project")}
                  className={`rounded-lg py-1.5 text-xs font-semibold transition ${
                    hubTab === "project"
                      ? "bg-[#D5B45C] text-[#0F1117] shadow-sm"
                      : "text-[#AAA5B4] hover:text-[#F5F2FA]"
                  }`}
                >
                  📂 Project
                </button>
              </div>

              {/* Tab 1: ⚡ Multi-Laptop Workspace Sync */}
              {hubTab === "sync" && (
                <div className="space-y-3">
                  <div className="rounded-xl bg-[#171A23] p-3 border border-[#2A2E39]">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#D5B45C]">
                      <span>💻</span>
                      <span>Master Control on Multiple Laptops</span>
                    </div>
                    <p className="text-xs text-[#AAA5B4] mt-1 leading-relaxed">
                      Share full master control to Ammar, Oscar, or Shreya&apos;s laptop without a database.
                      Opening this link on another machine instantly loads all members, tasks, and availability.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyWorkspace}
                    className="flex items-center justify-center gap-2 rounded-xl bg-[#D5B45C] px-4 py-2.5 text-xs font-semibold text-[#0F1117] hover:bg-[#E2C36E] transition shadow-md shadow-[#D5B45C]/20 w-full active:scale-95 cursor-pointer"
                  >
                    <span>⚡</span>
                    <span>{copiedWorkspace ? "✓ Master Workspace Link Copied!" : "Copy Master Workspace Link"}</span>
                  </button>

                  {copiedWorkspace && (
                    <p className="text-[11px] text-[#D5B45C] text-center font-medium animate-fade-in">
                      ✓ Paste into teammate&apos;s browser to sync everything instantly!
                    </p>
                  )}

                  <div className="border-t border-[#2A2E39] pt-2">
                    <p className="text-[11px] text-[#AAA5B4]">Current Active Workspace:</p>
                    <p className="text-xs font-semibold text-[#F5F2FA] mt-0.5">
                      {project.course || project.name} · {project.members.length} members · {project.tasks.length} tasks
                    </p>
                  </div>
                </div>
              )}

              {/* Tab 2: 👤 Create New Student Account */}
              {hubTab === "account" && (
                <form onSubmit={handleCreateAccount} className="space-y-3">
                  <p className="text-xs text-[#AAA5B4]">
                    Add a new student account with their own universal profile and active persona:
                  </p>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-[#AAA5B4]">Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Alex Rivera"
                      value={newAccName}
                      onChange={(e) => setNewAccName(e.target.value)}
                      className="w-full rounded-xl border border-[#2A2E39] bg-[#171A23] px-3 py-1.5 text-xs text-[#F5F2FA] focus:border-[#D5B45C] focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-[#AAA5B4]">SFSU Major / Role</label>
                    <input
                      type="text"
                      placeholder="e.g. Computer Science / Frontend Lead"
                      value={newAccMajor}
                      onChange={(e) => setNewAccMajor(e.target.value)}
                      className="w-full rounded-xl border border-[#2A2E39] bg-[#171A23] px-3 py-1.5 text-xs text-[#F5F2FA] focus:border-[#D5B45C] focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-[#AAA5B4]">Key Skills (comma separated)</label>
                    <input
                      type="text"
                      placeholder="e.g. React, TypeScript, UI Design"
                      value={newAccSkills}
                      onChange={(e) => setNewAccSkills(e.target.value)}
                      className="w-full rounded-xl border border-[#2A2E39] bg-[#171A23] px-3 py-1.5 text-xs text-[#F5F2FA] focus:border-[#D5B45C] focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-[#AAA5B4]">Wants to Learn (optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Next.js 15, Gemini AI"
                      value={newAccWants}
                      onChange={(e) => setNewAccWants(e.target.value)}
                      className="w-full rounded-xl border border-[#2A2E39] bg-[#171A23] px-3 py-1.5 text-xs text-[#F5F2FA] focus:border-[#D5B45C] focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="flex items-center justify-center gap-2 rounded-xl bg-[#D5B45C] px-4 py-2 text-xs font-semibold text-[#0F1117] hover:bg-[#E2C36E] transition shadow-md shadow-[#D5B45C]/20 w-full active:scale-95 cursor-pointer mt-2"
                  >
                    <span>👤</span>
                    <span>Create Account &amp; Join Team</span>
                  </button>
                </form>
              )}

              {/* Tab 3: 📂 Create New Course / Project Folder */}
              {hubTab === "project" && (
                <form onSubmit={handleCreateProject} className="space-y-3">
                  <p className="text-xs text-[#AAA5B4]">
                    Start a new project folder (e.g. for CSC 667, CINE 102, or Senior Project):
                  </p>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-[#AAA5B4]">Course Code &amp; Title</label>
                    <input
                      type="text"
                      placeholder="e.g. CSC 667: Internet Architecture"
                      value={newProjCourse}
                      onChange={(e) => setNewProjCourse(e.target.value)}
                      className="w-full rounded-xl border border-[#2A2E39] bg-[#171A23] px-3 py-1.5 text-xs text-[#F5F2FA] focus:border-[#D5B45C] focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-[#AAA5B4]">Project Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Cloud E-Commerce Prototype"
                      value={newProjName}
                      onChange={(e) => setNewProjName(e.target.value)}
                      className="w-full rounded-xl border border-[#2A2E39] bg-[#171A23] px-3 py-1.5 text-xs text-[#F5F2FA] focus:border-[#D5B45C] focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="flex items-center justify-center gap-2 rounded-xl bg-[#D5B45C] px-4 py-2 text-xs font-semibold text-[#0F1117] hover:bg-[#E2C36E] transition shadow-md shadow-[#D5B45C]/20 w-full active:scale-95 cursor-pointer mt-2"
                  >
                    <span>📂</span>
                    <span>Create Project Folder</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>

      <span aria-hidden className="hidden h-px w-8 bg-[#2A2E39] md:block" />

      {/* 4. Universal Coordinate Action */}
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

      {/* 5. More / Persona Switcher Drawer */}
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
            <div className={`${cardClass} w-64`}>
              <p className="mb-1 text-xs text-[#AAA5B4]">
                {me ? `Active as ${me.name.split(" ")[0]} on this device` : "Who are you?"}
              </p>
              <button
                type="button"
                onClick={() => {
                  setCurrentMember(null);
                  setPanel(null);
                }}
                className="block w-full rounded-xl px-2 py-2 text-left text-[#F5F2FA] hover:bg-[#2A2E39] transition text-xs cursor-pointer"
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
              <button
                type="button"
                onClick={() => {
                  setHubTab("sync");
                  setPanel({ kind: "workspace-hub" });
                }}
                className="block w-full text-left rounded-xl px-2 py-2 text-[#D5B45C] hover:bg-[#2A2E39] transition text-xs font-semibold cursor-pointer"
              >
                ⚡ Sync Workspace to Laptop
              </button>
              <Link
                href="/team"
                onClick={() => setPanel(null)}
                className="block rounded-xl px-2 py-2 text-[#F5F2FA] hover:bg-[#2A2E39] transition text-xs"
              >
                Form or join a team
              </Link>
              <Link
                href="/dashboard"
                onClick={() => setPanel(null)}
                className="block rounded-xl px-2 py-2 text-[#F5F2FA] hover:bg-[#2A2E39] transition text-xs"
              >
                Team dashboard &amp; tasks
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

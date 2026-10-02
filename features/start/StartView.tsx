"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useProject } from "@/context/ProjectContext";
import { useCurrentMember } from "@/features/identity/useCurrentMember";
import { useReplan } from "@/features/plan/useReplan";
import { PlanFocus, secondaryButton } from "@/features/plan/PlanFocus";
import { findPlanProblems, needsAttention } from "@/features/plan/plan-health";
import { formatDay } from "@/features/plan/plan-display";
import { toIsoDay, todayIsoDay } from "@/features/plan/plan-validation";
import { CoordinateBox } from "./CoordinateBox";
import { ArrowRightIcon, CalendarClockIcon, ClipboardListIcon } from "./StartIcons";

/**
 * Feature Owner: Divij Anand
 * Cockpit Landing: Turn-key, intuitive, no 20-item cognitive overload.
 * 1. Calm greeting & identity badge
 * 2. Two Hero Doors: Quick Meet (/meet) & Current Project (/plan)
 * 3. Active Stuffs: Next step with Done/Need help, attention items, upcoming milestones, and + Coordinate bar.
 */

function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export function StartView() {
  const { project, replaceTasks, updateTaskStatus } = useProject();
  const { member, setCurrentMember } = useCurrentMember();
  const replan = useReplan(project);
  const today = todayIsoDay();
  const deadline = toIsoDay(project.deadline);
  const courseOrName = project.course ? project.course.split(":")[0].trim() : project.name;

  const open = useMemo(() => project.tasks.filter((t) => t.status !== "done"), [project.tasks]);
  const mineOpen = member ? open.filter((t) => t.ownerId === member.id) : [];
  const attentionCount = findPlanProblems(project.tasks, today).filter(needsAttention).length;

  const comingUp = useMemo(() => {
    const items = open
      .filter((t) => t.dueDate && t.dueDate >= today)
      .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
      .slice(0, 4)
      .map((t) => ({ day: t.dueDate as string, label: t.title, mine: t.ownerId === member?.id, final: false }));
    if (deadline) items.push({ day: deadline, label: `${courseOrName} due`, mine: false, final: true });
    return items.sort((a, b) => a.day.localeCompare(b.day));
  }, [open, today, deadline, member, courseOrName]);

  const nextMeeting = project.meetings[0];
  const firstName = member?.name.split(" ")[0];

  return (
    <div className="mx-auto max-w-4xl space-y-10 sm:space-y-12">
      {/* 1. Header: Greeting & Profile Role */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight text-[#F5F2FA]">
            {firstName ? `${greeting()}, ${firstName}.` : `${greeting()}.`}
          </h1>
          <p className="mt-1 text-sm text-[#AAA5B4]">
            Your group coordination cockpit. Clear next steps, zero friction.
          </p>
        </div>

        {/* Identity & Profile Badge */}
        {member ? (
          <div className="flex items-center gap-2.5 self-start rounded-full border border-[#2A2E39] bg-[#171A23] px-3.5 py-1.5 text-xs shadow-sm sm:self-auto">
            <Link
              href="/profile"
              className="flex items-center gap-1.5 font-medium text-[#B8A6FF] hover:underline"
              title="View & Edit SFSU Profile"
            >
              <span>🎓</span>
              <span>{member.role || "Set Role"}</span>
              <span className="text-[#AAA5B4]">({member.skills.length} skills)</span>
            </Link>
            <span className="text-[#2A2E39]">·</span>
            <button
              type="button"
              onClick={() => setCurrentMember(null)}
              className="text-[#AAA5B4] hover:text-[#F5F2FA] text-[11px] transition"
            >
              Switch
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#2A2E39] bg-[#171A23] px-3.5 py-1.5 text-xs shadow-sm">
            <span className="text-[#AAA5B4]">Who are you?</span>
            {project.members.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setCurrentMember(m.id)}
                className={`${secondaryButton} px-2.5 py-1 text-xs`}
              >
                {m.name.split(" ")[0]}
              </button>
            ))}
            <Link
              href="/profile"
              className="ml-1 font-medium text-[#B8A6FF] hover:underline"
            >
              + Profile
            </Link>
          </div>
        )}
      </header>

      {/* 2. The Two Hero Doors: Quick Meet & Project */}
      <section aria-label="Primary Actions" className="grid gap-4 sm:grid-cols-2 lg:gap-6">
        {/* Door 1: Quick Meet */}
        <Link
          href="/meet"
          className="group relative flex flex-col justify-between rounded-2xl border border-[#2A2E39] bg-[#171A23] p-6 transition duration-300 hover:border-[#B8A6FF]/70 hover:bg-[#1A1D27] shadow-sm hover-lift"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#B8A6FF]/10 text-[#B8A6FF] group-hover:scale-105 transition-transform">
                <CalendarClockIcon className="h-6 w-6" />
              </span>
              <span className="inline-flex items-center rounded-full border border-[#2A2E39] bg-[#1D202A] px-2.5 py-0.5 text-[11px] font-medium text-[#B8A6FF]">
                30-sec poll
              </span>
            </div>
            <div>
              <h2 className="font-heading text-xl font-bold text-[#F5F2FA] group-hover:text-[#B8A6FF] transition flex items-center gap-2">
                Quick Meet
              </h2>
              <p className="mt-1 text-sm text-[#AAA5B4] leading-relaxed">
                When can we meet? Find team overlap instantly with no login or account required.
              </p>
            </div>
          </div>
          <div className="mt-6 flex items-center text-sm font-semibold text-[#B8A6FF] group-hover:translate-x-1 transition duration-200">
            <span>Find a meeting time</span>
            <ArrowRightIcon className="ml-1.5 h-4 w-4" />
          </div>
        </Link>

        {/* Door 2: Project Plan */}
        <Link
          href="/plan"
          className="group relative flex flex-col justify-between rounded-2xl border border-[#2A2E39] bg-[#171A23] p-6 transition duration-300 hover:border-[#D5B45C]/70 hover:bg-[#1A1D27] shadow-sm hover-lift"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#D5B45C]/10 text-[#D5B45C] group-hover:scale-105 transition-transform">
                <ClipboardListIcon className="h-6 w-6" />
              </span>
              <span className="inline-flex items-center rounded-full border border-[#D5B45C]/30 bg-[#1D202A] px-2.5 py-0.5 text-[11px] font-semibold text-[#D5B45C]">
                {deadline ? `Target: ${formatDay(deadline)}` : "In Progress"}
              </span>
            </div>
            <div>
              <h2 className="font-heading text-xl font-bold text-[#F5F2FA] group-hover:text-[#D5B45C] transition truncate">
                {project.course ? project.course : project.name}
              </h2>
              <p className="mt-1 text-sm text-[#AAA5B4] truncate">
                {project.name ? project.name : "Assignment Breakdown & Plan"}
              </p>
            </div>
          </div>
          <div className="mt-6 flex items-center justify-between">
            <span className="text-xs text-[#AAA5B4]">
              {member
                ? (mineOpen.length === 1 ? "1 task for you" : `${mineOpen.length} tasks for you`)
                : `${open.length} active tasks`}
            </span>
            <div className="flex items-center text-sm font-semibold text-[#D5B45C] group-hover:translate-x-1 transition duration-200">
              <span>Open project plan</span>
              <ArrowRightIcon className="ml-1.5 h-4 w-4" />
            </div>
          </div>
        </Link>
      </section>

      {/* 3. Below: Active Stuffs */}
      <section aria-labelledby="active-heading" className="space-y-6">
        <div className="flex items-center justify-between border-b border-[#2A2E39] pb-3">
          <h2 id="active-heading" className="text-xs font-semibold uppercase tracking-[0.14em] text-[#AAA5B4]">
            Active &amp; Next
          </h2>
          <span className={`text-xs font-medium ${attentionCount === 0 ? "text-[#B8A6FF]" : "text-[#D5B45C]"}`}>
            {attentionCount === 0 ? "✓ On track" : attentionCount === 1 ? "⚠ 1 item needs attention" : `⚠ ${attentionCount} items need attention`}
          </span>
        </div>

        {/* Task Focus / Next Step */}
        {project.tasks.length > 0 ? (
          <div className="rounded-2xl border border-[#2A2E39] bg-[#171A23] p-6 shadow-sm">
            <PlanFocus
              project={project}
              me={member}
              replan={replan}
              replaceTasks={replaceTasks}
              updateTaskStatus={updateTaskStatus}
            />
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-6 rounded-2xl border border-[#2A2E39] bg-[#171A23] p-6 text-center sm:text-left">
            <Image
              src="/illustrations/start-hero.svg"
              alt=""
              width={965}
              height={624}
              unoptimized
              className="h-auto w-36 sm:w-44 shrink-0 opacity-80"
            />
            <div className="space-y-1">
              <h3 className="font-heading text-lg font-bold text-[#F5F2FA]">Nothing on your plate yet</h3>
              <p className="text-sm text-[#AAA5B4]">
                Upload your assignment or syllabus in the project planner to generate an AI breakdown matched to everyone&apos;s skills.
              </p>
              <div className="pt-2">
                <Link href="/plan" className="inline-flex items-center text-xs font-semibold text-[#B8A6FF] hover:underline">
                  Go to AI Project Planner →
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Coming Up: Clean, compact milestones */}
        {(nextMeeting || comingUp.length > 0) && (
          <div className="rounded-2xl border border-[#2A2E39]/70 bg-[#171A23]/60 p-5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#AAA5B4]">
              Coming up
            </p>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {nextMeeting && (
                <div className="flex items-start gap-3 rounded-xl border border-[#2A2E39] bg-[#1D202A] p-3">
                  <span aria-hidden className="mt-0.5 text-base text-[#B8A6FF]">🗓️</span>
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-[#F5F2FA]">{nextMeeting.title}</span>
                    <span className="block text-xs text-[#AAA5B4]">{nextMeeting.scheduledTime}</span>
                  </div>
                </div>
              )}
              {comingUp.slice(0, nextMeeting ? 2 : 3).map((item) => (
                <div
                  key={`${item.day}-${item.label}`}
                  className="flex items-start gap-3 rounded-xl border border-[#2A2E39] bg-[#1D202A] p-3"
                >
                  <span aria-hidden className={`mt-0.5 text-sm ${item.final ? "text-[#D5B45C]" : "text-[#B8A6FF]"}`}>
                    {item.final ? "★" : "◆"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className={`block truncate text-sm ${item.mine || item.final ? "font-semibold text-[#F5F2FA]" : "text-[#F5F2FA]/90"}`}>
                      {item.label}
                    </span>
                    <span className="block text-xs text-[#AAA5B4]">
                      {formatDay(item.day)}{item.mine ? " · you" : ""}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Natural Language Coordinate Bar (Google Maps style single action) */}
        <div className="pt-2">
          <CoordinateBox project={project} onHelp={(concern, away) => void replan.request({ concern, away })} />
        </div>
      </section>
    </div>
  );
}

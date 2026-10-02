"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useProject } from "@/context/ProjectContext";
import { useCurrentMember } from "@/features/identity/useCurrentMember";
import { useReplan } from "@/features/plan/useReplan";
import { PlanFocus, quietButton, secondaryButton, sectionLabel } from "@/features/plan/PlanFocus";
import { findPlanProblems, needsAttention } from "@/features/plan/plan-health";
import { formatDay } from "@/features/plan/plan-display";
import { addDays, toIsoDay, todayIsoDay } from "@/features/plan/plan-validation";
import { CoordinateBox } from "./CoordinateBox";
import { ArrowRightIcon } from "./StartIcons";

/**
 * Feature Owner: Divij Anand
 * Home as a cockpit. Left: what needs me (next step, attention, my stuff,
 * + Coordinate). Right: when (the next 7 days, coming up) and the team.
 * Built to be understood while barely reading.
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
  const shortName = project.course.split(":")[0] || project.name;

  const open = useMemo(() => project.tasks.filter((t) => t.status !== "done"), [project.tasks]);
  const mineOpen = member ? open.filter((t) => t.ownerId === member.id) : [];
  const attentionCount = findPlanProblems(project.tasks, today).filter(needsAttention).length;

  const comingUp = useMemo(() => {
    const items = open
      .filter((t) => t.dueDate && t.dueDate >= today)
      .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
      .slice(0, 4)
      .map((t) => ({ day: t.dueDate as string, label: t.title, mine: t.ownerId === member?.id, final: false }));
    if (deadline) items.push({ day: deadline, label: `${shortName} due`, mine: false, final: true });
    return items.sort((a, b) => a.day.localeCompare(b.day));
  }, [open, today, deadline, member, shortName]);

  const week = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(today, i);
    const [y, m, d] = day.split("-").map(Number);
    return {
      day,
      weekday: new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "narrow" }),
      date: d,
      due: comingUp.filter((c) => c.day === day).length,
    };
  });
  const nextMeeting = project.meetings[0];
  const firstName = member?.name.split(" ")[0];

  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-16">
      {/* LEFT: what needs me? */}
      <div className="min-w-0 space-y-10">
        <header className="space-y-2">
          <h1 className="font-heading text-3xl sm:text-[40px] sm:leading-tight font-bold tracking-tight text-[#F5F2FA]">
            {firstName ? `${greeting()}, ${firstName}.` : `${greeting()}.`}
          </h1>
          {member ? (
            <button type="button" onClick={() => setCurrentMember(null)} className={`${quietButton} -ml-2 text-xs`}>
              Not {firstName}?
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-sm text-[#AAA5B4]">Who are you?</span>
              {project.members.map((m) => (
                <button key={m.id} type="button" onClick={() => setCurrentMember(m.id)} className={`${secondaryButton} px-3 py-1.5`}>
                  {m.name.split(" ")[0]}
                </button>
              ))}
            </div>
          )}
        </header>

        {project.tasks.length > 0 ? (
          <PlanFocus project={project} me={member} replan={replan} replaceTasks={replaceTasks} updateTaskStatus={updateTaskStatus} />
        ) : (
          <div className="flex items-center gap-6">
            <Image src="/illustrations/start-hero.svg" alt="" width={965} height={624} unoptimized className="h-auto w-48" />
            <p className="text-lg text-[#AAA5B4]">Nothing on your plate yet.</p>
          </div>
        )}

        <section aria-labelledby="stuff-heading" className="space-y-1">
          <h2 id="stuff-heading" className={sectionLabel}>
            Your stuff
          </h2>
          <ul className="divide-y divide-[#2A2E39]/70">
            <li>
              <Link
                href="/plan"
                className="group flex items-center gap-4 rounded-lg py-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]/60"
              >
                <span aria-hidden className="text-xl">💻</span>
                <span className="min-w-0 flex-1 truncate font-medium text-[#F5F2FA] group-hover:text-[#B8A6FF]">{shortName}</span>
                <span className="shrink-0 text-sm text-[#AAA5B4]">
                  {member ? (mineOpen.length === 1 ? "1 thing for you" : `${mineOpen.length} things for you`) : `${open.length} open`}
                </span>
                <ArrowRightIcon className="h-4 w-4 text-[#AAA5B4] group-hover:text-[#B8A6FF]" />
              </Link>
            </li>
            <li>
              <Link
                href="/meet"
                className="group flex items-center gap-4 rounded-lg py-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]/60"
              >
                <span aria-hidden className="text-xl">🗓️</span>
                <span className="flex-1 font-medium text-[#F5F2FA] group-hover:text-[#B8A6FF]">Quick meet</span>
                <span className="shrink-0 text-sm text-[#AAA5B4]">no account</span>
                <ArrowRightIcon className="h-4 w-4 text-[#AAA5B4] group-hover:text-[#B8A6FF]" />
              </Link>
            </li>
          </ul>
        </section>

        <CoordinateBox project={project} onHelp={(concern) => void replan.request({ concern })} />
      </div>

      {/* RIGHT: when? */}
      <aside className="space-y-10 lg:border-l lg:border-[#2A2E39]/70 lg:pl-10">
        <section aria-labelledby="week-heading" className="space-y-3">
          <h2 id="week-heading" className={sectionLabel}>
            Next 7 days
          </h2>
          <ol className="grid grid-cols-7 gap-1 text-center">
            {week.map((d, i) => (
              <li key={d.day} className={`rounded-lg py-2 ${i === 0 ? "bg-[#B8A6FF]/10" : ""}`}>
                <span className="block text-[11px] text-[#AAA5B4]">{d.weekday}</span>
                <span className={`block font-heading text-sm ${i === 0 ? "font-bold text-[#B8A6FF]" : "text-[#F5F2FA]"}`}>{d.date}</span>
                <span className="block h-3 text-[10px] leading-3 text-[#D5B45C]">
                  {d.due ? <span aria-label={`${d.due} due`}>{"◆".repeat(Math.min(d.due, 3))}</span> : null}
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="coming-heading" className="space-y-3">
          <h2 id="coming-heading" className={sectionLabel}>
            Coming up
          </h2>
          <ul className="space-y-3">
            {nextMeeting && (
              <li className="flex gap-3">
                <span aria-hidden className="mt-0.5 text-[#B8A6FF]">●</span>
                <span className="min-w-0">
                  <span className="block truncate text-[#F5F2FA]">{nextMeeting.title}</span>
                  <span className="block text-sm text-[#AAA5B4]">{nextMeeting.scheduledTime}</span>
                </span>
              </li>
            )}
            {comingUp.map((item) => (
              <li key={`${item.day}-${item.label}`} className="flex gap-3">
                <span aria-hidden className={`mt-0.5 ${item.final ? "text-[#D5B45C]" : "text-[#AAA5B4]"}`}>
                  {item.final ? "★" : "◆"}
                </span>
                <span className="min-w-0">
                  <span className={`block truncate ${item.mine || item.final ? "font-semibold text-[#F5F2FA]" : "text-[#F5F2FA]/85"}`}>
                    {item.label}
                  </span>
                  <span className="block text-sm text-[#AAA5B4]">
                    {formatDay(item.day)}
                    {item.mine && " · you"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="team-heading" className="space-y-3">
          <h2 id="team-heading" className={sectionLabel}>
            Team
          </h2>
          {/* People live in the Collaboration Dock; Home only states how the work is going. */}
          <p className={`text-sm ${attentionCount === 0 ? "text-[#B8A6FF]" : "text-[#D5B45C]"}`}>
            {attentionCount === 0 ? "✓ On track" : attentionCount === 1 ? "⚠ 1 thing needs attention" : `⚠ ${attentionCount} things need attention`}
          </p>
        </section>
      </aside>
    </div>
  );
}

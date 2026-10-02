"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { useProject } from "@/context/ProjectContext";
import { PROBLEM_PHRASE, findPlanProblems } from "@/features/plan/plan-health";
import { describePlanStatus, firstName, formatDay, orderSteps } from "@/features/plan/plan-display";
import { todayIsoDay } from "@/features/plan/plan-validation";
import {
  ArrowRightIcon,
  CalendarClockIcon,
  ClipboardListIcon,
  LayoutDashboardIcon,
  MessageCircleMoreIcon,
} from "./StartIcons";

/**
 * Feature Owner: Divij Anand
 * Start screen: "What do you need right now?" Simple until complexity is useful.
 * Each choice goes only as deep as it needs to; the full workspace is one click
 * away for teams that want it, and invisible for everyone else.
 */

interface StartOption {
  href: string;
  title: string;
  description: string;
  Icon: (props: { className?: string }) => React.ReactElement;
}

const OPTIONS: StartOption[] = [
  {
    href: "/meet",
    title: "Find a time to meet",
    description: "No account, no app. Add when you're free and send a link.",
    Icon: CalendarClockIcon,
  },
  {
    href: "/plan",
    title: "Organize a group project",
    description: "Upload the assignment and get a plan everyone can see.",
    Icon: ClipboardListIcon,
  },
  {
    href: "/meeting",
    title: "Catch up on a meeting",
    description: "What you missed and what it means for you.",
    Icon: MessageCircleMoreIcon,
  },
  {
    href: "/dashboard",
    title: "See everyone's work",
    description: "The full board, for when you want every detail.",
    Icon: LayoutDashboardIcon,
  },
];

export function StartView() {
  const { project } = useProject();
  const hasProject = project.tasks.length > 0;
  const status = describePlanStatus(orderSteps(project.tasks, project.members));
  const [problem] = findPlanProblems(project.tasks, todayIsoDay());

  return (
    <div className="space-y-10 max-w-4xl">
      <div className="flex flex-col-reverse items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-3">
          <p className="text-sm font-medium text-[#B8A6FF]">Coordination without a coordinator</p>
          <h1 className="font-heading text-3xl sm:text-[40px] sm:leading-tight font-bold tracking-tight text-[#F5F2FA]">
            What do you need right now?
          </h1>
          <p className="text-lg text-[#AAA5B4] max-w-md leading-relaxed">
            Start small. gatorXecute only adds more when your group needs it.
          </p>
        </div>
        <Image
          src="/illustrations/start-hero.svg"
          alt=""
          width={965}
          height={624}
          unoptimized
          priority
          className="w-56 sm:w-72 h-auto shrink-0"
        />
      </div>

      {/* Returning team: the answer first */}
      {hasProject && (
        <Link
          href="/plan"
          className="group block rounded-2xl border border-[#B8A6FF]/40 bg-[#B8A6FF]/[0.06] p-6 sm:p-8 hover:border-[#B8A6FF] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]/60 transition-colors"
        >
          <p className="text-sm font-medium text-[#B8A6FF]">Continue · {project.course}</p>
          <p className="mt-1 font-heading text-2xl font-bold tracking-tight text-[#F5F2FA]">{project.name}</p>
          <p className="mt-3 text-lg text-[#F5F2FA]/90">
            {status.headline}
            {status.next && (
              <>
                {" "}Next up: <strong className="font-semibold">{status.next.task.title}</strong>
                {status.next.owner && <> with {firstName(status.next.owner)}</>}
                {status.next.task.dueDate && <>, due {formatDay(status.next.task.dueDate)}</>}.
              </>
            )}
          </p>
          {problem && (
            <p className="mt-2 text-[#AAA5B4]">
              <span className="text-[#D5B45C]">Needs attention:</span> {problem.task.title} {PROBLEM_PHRASE[problem.kind]}.
            </p>
          )}
          <p className="mt-4 text-sm font-semibold text-[#B8A6FF]">
            Open the plan <ArrowRightIcon className="inline h-4 w-4 transition-transform group-hover:translate-x-1" />
          </p>
        </Link>
      )}

      <section aria-labelledby="start-options" className="space-y-4">
        {hasProject && (
          <h2 id="start-options" className="font-heading text-xl font-semibold text-[#F5F2FA]">
            Or start something new
          </h2>
        )}
        {!hasProject && <h2 id="start-options" className="sr-only">Options</h2>}
        <ul className="grid gap-4 sm:grid-cols-2">
          {OPTIONS.map((option) => (
            <li key={option.href}>
              <Link
                href={option.href}
                className="group flex h-full flex-col justify-between gap-3 rounded-2xl border border-[#2A2E39] p-6 hover:border-[#B8A6FF]/50 hover:bg-[#1D202A]/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]/60 transition-colors"
              >
                <span className="space-y-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#B8A6FF]/10 text-[#B8A6FF]">
                    <option.Icon className="h-5 w-5" />
                  </span>
                  <span className="block font-heading text-lg font-semibold text-[#F5F2FA]">{option.title}</span>
                  <span className="block text-sm text-[#AAA5B4]">{option.description}</span>
                </span>
                <ArrowRightIcon className="h-5 w-5 text-[#B8A6FF] transition-transform group-hover:translate-x-1" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

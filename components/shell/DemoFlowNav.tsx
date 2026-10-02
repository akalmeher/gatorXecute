"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface Step {
  title: string;
  subtitle: string;
  href: string;
  number: number;
}

const STEPS: Step[] = [
  {
    number: 1,
    title: "Project",
    subtitle: "Setup & Team",
    href: "/",
  },
  {
    number: 2,
    title: "Plan",
    subtitle: "AI Work Breakdown",
    href: "/plan",
  },
  {
    number: 3,
    title: "Dashboard",
    subtitle: "Status & Workload",
    href: "/dashboard",
  },
  {
    number: 4,
    title: "Meeting",
    subtitle: "Sync & Catch-Up",
    href: "/meeting",
  },
];

export function DemoFlowNav() {
  const pathname = usePathname();

  const currentIndex = STEPS.findIndex((s) =>
    s.href === "/" ? pathname === "/" : pathname.startsWith(s.href)
  );
  const activeStep = currentIndex >= 0 ? currentIndex : 0;

  return (
    <nav className="w-full border-b border-zinc-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between py-2 sm:py-0">
          {/* Step tabs */}
          <div className="flex w-full sm:w-auto items-center justify-between sm:justify-start gap-1 sm:gap-6 overflow-x-auto">
            {STEPS.map((step, idx) => {
              const isActive = idx === activeStep;
              const isPast = idx < activeStep;

              return (
                <Link
                  key={step.href}
                  href={step.href}
                  className={`group relative flex items-center gap-2 py-3 px-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "text-[var(--gator-purple)] font-semibold"
                      : isPast
                      ? "text-zinc-700 hover:text-zinc-900"
                      : "text-zinc-500 hover:text-zinc-800"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all ${
                      isActive
                        ? "bg-[var(--gator-purple)] text-white ring-2 ring-[var(--gator-gold)]"
                        : isPast
                        ? "bg-zinc-200 text-zinc-700"
                        : "bg-zinc-100 text-zinc-500 group-hover:bg-zinc-200"
                    }`}
                  >
                    {step.number}
                  </span>
                  <div className="flex flex-col text-left">
                    <span className="leading-tight">{step.title}</span>
                    <span className="hidden md:inline text-[10px] text-zinc-500 font-normal">
                      {step.subtitle}
                    </span>
                  </div>

                  {/* Active bottom bar */}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--gator-purple)]" />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Stepper controls */}
          <div className="hidden sm:flex items-center gap-2 py-2">
            <span className="text-xs text-zinc-500 font-mono">
              Demo Step {activeStep + 1} of {STEPS.length}
            </span>
            <div className="flex gap-1">
              {activeStep > 0 && (
                <Link
                  href={STEPS[activeStep - 1].href}
                  className="rounded px-2.5 py-1 text-xs font-medium text-zinc-600 bg-zinc-100 hover:bg-zinc-200 transition-colors"
                >
                  ← Back
                </Link>
              )}
              {activeStep < STEPS.length - 1 && (
                <Link
                  href={STEPS[activeStep + 1].href}
                  className="rounded px-2.5 py-1 text-xs font-semibold text-white bg-[var(--gator-purple)] hover:opacity-90 transition-opacity"
                >
                  Next Step →
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

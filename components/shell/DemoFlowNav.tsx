"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface Tab {
  label: string;
  href: string;
}

const TABS: Tab[] = [
  { label: "Project", href: "/project" },
  { label: "Plan", href: "/plan" },
  { label: "Work", href: "/dashboard" },
  { label: "Meetings", href: "/meeting" },
];

export function DemoFlowNav() {
  const pathname = usePathname();

  // Persistent on every route. Quick Meet (exactly /meet, not /meeting) is a
  // no-account page for people outside the project, so it has no project tabs.
  if (pathname === "/meet") return null;

  return (
    <nav className="w-full border-b border-[#2A2E39] bg-[#171A23]">
      <div className="page-container">
        <div className="grid grid-cols-4 w-full border-x border-[#2A2E39]">
          {TABS.map((tab) => {
            const isActive =
              tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`group relative flex items-center justify-center py-4 px-2 sm:px-4 text-sm sm:text-base font-medium transition-colors text-center whitespace-nowrap min-h-[48px] ${
                  isActive
                    ? "text-[#B8A6FF] font-semibold bg-[#B8A6FF]/[0.06]"
                    : "text-[#AAA5B4] hover:text-[#F5F2FA] hover:bg-[#1D202A]/40"
                }`}
              >
                <span>{tab.label}</span>

                {/* Active tab bottom indicator */}
                {isActive && (
                  <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-[#B8A6FF]" />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

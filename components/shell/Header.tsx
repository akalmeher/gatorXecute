"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { useCurrentMember } from "@/features/identity/useCurrentMember";

/**
 * Quiet app header: brand on the left, you on the right.
 * Collaboration context (course, teammates) lives in the Collaboration Dock.
 */
export function Header() {
  const { member } = useCurrentMember();

  return (
    <header className="sticky top-0 z-40 w-full bg-[#0F1117]/85 backdrop-blur-md">
      <div className="page-container flex h-14 items-center justify-between">
        <Link href="/" className="group flex items-center" aria-label="gatorXecute home">
          <Image
            src="/gatorxecute-logo.svg"
            alt="gatorXecute"
            width={216}
            height={51}
            priority
            className="h-auto w-[118px] object-contain transition-opacity group-hover:opacity-90 sm:w-[132px]"
          />
        </Link>

        {member ? (
          <Link
            href="/profile"
            title={`${member.name} — Profile & Roles`}
            aria-label={`You: ${member.name}. Click to view profile and roles.`}
            className="group flex items-center gap-2 rounded-full p-0.5 transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]"
          >
            <span className="hidden text-xs text-[#AAA5B4] group-hover:text-[#F5F2FA] sm:inline">
              {member.name.split(" ")[0]}
            </span>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#B8A6FF] font-heading text-xs font-bold text-[#0F1117] shadow-sm">
              {member.initials}
            </span>
          </Link>
        ) : (
          <Link
            href="/profile"
            className="flex items-center gap-1.5 rounded-xl border border-[#2A2E39] bg-[#171A23] px-3 py-1.5 text-xs text-[#AAA5B4] hover:border-[#B8A6FF]/50 hover:text-[#F5F2FA]"
          >
            <span>🎓</span>
            <span>Profile</span>
          </Link>
        )}
      </div>
    </header>
  );
}

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
          <span
            title={member.name}
            aria-label={`You: ${member.name}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#B8A6FF] font-heading text-xs font-bold text-[#0F1117]"
          >
            {member.initials}
          </span>
        ) : (
          <Link href="/" className="text-sm text-[#AAA5B4] hover:text-[#F5F2FA]">
            Who are you?
          </Link>
        )}
      </div>
    </header>
  );
}

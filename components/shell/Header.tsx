"use client";

import React from "react";
import Link from "next/link";
import { useProject } from "@/context/ProjectContext";

export function Header() {
  const { project } = useProject();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#2A2E39] bg-[#171A23]/90 backdrop-blur-md">
      <div className="page-container flex h-18 items-center justify-between">
        {/* Brand identity */}
        <div className="flex items-center gap-3">
          <Link href="/" className="group flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1D202A] border border-[#2A2E39] text-[#B8A6FF] shadow-inner transition-transform group-hover:scale-105">
              <span className="font-heading text-base font-bold tracking-tight">
                gX
              </span>
            </div>
            <div className="flex flex-col">
              <span className="font-heading text-xl font-bold tracking-tight text-[#F5F2FA] leading-tight">
                gator<span className="text-[#B8A6FF]">Xecute</span>
              </span>
              <span className="text-xs text-[#AAA5B4] mt-0.5">
                Student team coordination
              </span>
            </div>
          </Link>

          <span className="hidden sm:inline-block h-4 w-px bg-[#2A2E39] mx-2" />

          {/* Project / Class tag */}
          <div className="hidden sm:flex items-center gap-2 rounded-full bg-[#1D202A] border border-[#2A2E39] px-3 py-1 text-xs text-[#AAA5B4]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#D5B45C]" />
            <span className="font-medium text-[#F5F2FA]">{project.course}</span>
          </div>
        </div>

        {/* Team Avatars & Active Status */}
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2 overflow-hidden">
            {project.members.map((member) => (
              <div
                key={member.id}
                title={`${member.name}${member.role ? ` • ${member.role}` : ""}`}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#1D202A] ring-2 ring-[#171A23] font-heading text-xs font-semibold text-[#F5F2FA] border border-[#2A2E39] hover:z-10 hover:border-[#B8A6FF] transition-all cursor-default"
              >
                {member.initials}
              </div>
            ))}
          </div>

          <span className="hidden md:inline-block text-xs font-medium text-[#AAA5B4] ml-1">
            {project.members.length} teammates
          </span>
        </div>
      </div>
    </header>
  );
}

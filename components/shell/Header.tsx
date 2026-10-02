"use client";

import React from "react";
import Link from "next/link";
import { useProject } from "@/context/ProjectContext";

export function Header() {
  const { project } = useProject();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-200 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand identity */}
        <div className="flex items-center gap-3">
          <Link href="/" className="group flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--gator-purple)] text-white shadow-sm ring-1 ring-black/10 transition-transform group-hover:scale-105">
              <span className="font-mono text-base font-black tracking-tighter text-[var(--gator-gold-accent)]">
                gX
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight text-zinc-900 leading-none">
                gator<span className="text-[var(--gator-purple)]">Xecute</span>
              </span>
              <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mt-0.5">
                AI Student Project Orchestrator
              </span>
            </div>
          </Link>

          <span className="hidden sm:inline-block h-4 w-px bg-zinc-200 mx-1" />

          <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--gator-gold)]" />
            <span>{project.course}</span>
          </div>
        </div>

        {/* Team Avatars & Active Status */}
        <div className="flex items-center gap-3">
          <div className="flex -space-x-1.5 overflow-hidden">
            {project.members.map((member) => (
              <div
                key={member.id}
                title={`${member.name} (${member.role || "Team Member"})`}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 ring-2 ring-white text-xs font-semibold text-zinc-700 hover:z-10 hover:ring-[var(--gator-purple)] transition-all cursor-default"
              >
                {member.initials}
              </div>
            ))}
          </div>

          <div className="hidden md:flex flex-col text-right">
            <span className="text-xs font-medium text-zinc-900 leading-tight">
              {project.members.length} Collaborators
            </span>
            <span className="text-[10px] text-zinc-500">Demo Ready</span>
          </div>
        </div>
      </div>
    </header>
  );
}

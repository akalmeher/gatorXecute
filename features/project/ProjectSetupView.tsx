"use client";

import React from "react";
import Link from "next/link";
import { useProject } from "@/context/ProjectContext";
import { useCurrentMember } from "@/features/identity/useCurrentMember";

export function ProjectSetupView() {
  const { project } = useProject();
  const { member: me } = useCurrentMember();

  return (
    <div className="space-y-10">
      {/* Top Heading */}
      <div className="space-y-2">
        <h1 className="font-heading text-3xl sm:text-[34px] font-bold tracking-tight text-[#F5F2FA]">
          Project
        </h1>
        <p className="text-base text-[#AAA5B4] max-w-2xl leading-relaxed">
          Your assignment, deadline, and team in one place.
        </p>
      </div>

      {/* Project Card: Assignment & Deadline */}
      <div className="rounded-2xl border border-[#2A2E39] bg-[#171A23] p-6 sm:p-8 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-md bg-[#1D202A] border border-[#2A2E39] px-2.5 py-1 text-xs font-medium text-[#B8A6FF]">
            {project.course}
          </span>
          <span className="text-sm text-[#AAA5B4]">
            Target submission: <strong className="text-[#F5F2FA] font-medium">{project.deadline}</strong>
          </span>
        </div>
        <h2 className="font-heading text-2xl font-bold text-[#F5F2FA] tracking-tight">
          {project.name}
        </h2>
        <p className="text-base text-[#AAA5B4] leading-relaxed max-w-3xl">
          {project.description}
        </p>
      </div>

      {/* Team Roster Section */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-2xl font-semibold text-[#F5F2FA] tracking-tight">
              Team members
            </h2>
            <p className="text-sm text-[#AAA5B4] mt-0.5">
              Everyone&apos;s active skills and learning goals for {project.course || "this project"}.
            </p>
          </div>
          <Link
            href="/profile"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#2A2E39] bg-[#171A23] px-3.5 py-2 text-xs font-semibold text-[#B8A6FF] hover:border-[#B8A6FF]/60 hover:text-[#F5F2FA]"
          >
            <span>⚡</span>
            <span>Customize your project profile →</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {project.members.map((member) => (
            <div
              key={member.id}
              className={`flex flex-col justify-between rounded-xl border p-6 space-y-5 transition-colors ${
                member.id === me?.id
                  ? "border-[#B8A6FF]/50 bg-[#1D202A] ring-1 ring-[#B8A6FF]/30"
                  : "border-[#2A2E39] bg-[#1D202A] hover:border-[#B8A6FF]/40"
              }`}
            >
              <div className="space-y-4">
                {/* Member header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#171A23] border border-[#2A2E39] font-heading text-[#B8A6FF] font-bold text-sm">
                      {member.initials}
                    </div>
                    <div>
                      <h3 className="font-heading text-lg font-semibold text-[#F5F2FA] leading-snug">
                        {member.name}
                      </h3>
                      <p className="text-sm text-[#AAA5B4]">
                        {member.role || "Team Member"}
                      </p>
                    </div>
                  </div>
                  {member.id === me?.id && (
                    <span className="rounded-full bg-[#B8A6FF]/20 px-2 py-0.5 text-[10px] font-semibold text-[#B8A6FF]">
                      You
                    </span>
                  )}
                </div>

                {/* Strengths */}
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-[#AAA5B4]">
                    Strengths
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {member.skills.map((skill) => (
                      <span
                        key={skill}
                        className="rounded-lg bg-[#171A23] border border-[#2A2E39] px-2.5 py-1 text-xs text-[#F5F2FA]"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Interested in learning */}
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-[#AAA5B4]">
                    Interested in learning
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {member.wantsToLearn.map((goal) => (
                      <span
                        key={goal}
                        className="rounded-lg bg-[#D5B45C]/10 border border-[#D5B45C]/30 px-2.5 py-1 text-xs font-medium text-[#D5B45C]"
                      >
                        + {goal}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

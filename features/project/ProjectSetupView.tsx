"use client";

import React from "react";
import Link from "next/link";
import { useProject } from "@/context/ProjectContext";

export function ProjectSetupView() {
  const { project } = useProject();

  return (
    <div className="space-y-8">
      {/* Project Overview Card */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-100 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-[var(--gator-purple)]/10 px-2.5 py-0.5 text-xs font-semibold text-[var(--gator-purple)]">
                {project.course}
              </span>
              <span className="text-xs text-zinc-500 font-mono">
                Target Deadline: {project.deadline}
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900">
              {project.name}
            </h1>
          </div>
          <Link
            href="/plan"
            className="inline-flex items-center justify-center rounded-lg bg-[var(--gator-purple)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
          >
            Review AI Project Plan →
          </Link>
        </div>

        <p className="mt-4 text-sm text-zinc-600 leading-relaxed max-w-3xl">
          {project.description}
        </p>
      </div>

      {/* Team Roster Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Project Team</h2>
            <p className="text-xs text-zinc-500">
              Collaborators, assigned roles, current skills, and stated learning goals.
            </p>
          </div>
          <span className="text-xs font-medium text-zinc-500">
            {project.members.length} Members Active
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {project.members.map((member) => (
            <div
              key={member.id}
              className="flex flex-col justify-between rounded-lg border border-zinc-200 bg-white p-5 shadow-xs hover:border-zinc-300 transition-colors"
            >
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--gator-purple)] text-white font-bold text-sm">
                    {member.initials}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900 leading-snug">
                      {member.name}
                    </h3>
                    <p className="text-xs font-medium text-[var(--gator-purple)]">
                      {member.role || "Team Member"}
                    </p>
                  </div>
                </div>

                {/* Skills */}
                <div className="mt-4">
                  <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1.5">
                    Demonstrated Skills
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {member.skills.map((skill) => (
                      <span
                        key={skill}
                        className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Wants to learn */}
                <div className="mt-3">
                  <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1.5">
                    Learning Goals
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {member.wantsToLearn.map((goal) => (
                      <span
                        key={goal}
                        className="rounded-md bg-[var(--gator-gold)]/10 px-2 py-0.5 text-xs font-medium text-[var(--gator-gold)]"
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

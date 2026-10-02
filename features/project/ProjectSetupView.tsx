"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useProject } from "@/context/ProjectContext";
import { useCurrentMember } from "@/features/identity/useCurrentMember";

/**
 * Feature Owner: Ammar Almeher & Divij Anand
 * Project & Team Hub: Assignment, deadline, and team roster with full profiles and skills.
 * - SFSU Gold buttons against deep purple backgrounds.
 * - Instant persona switcher on each teammate card.
 * - One-click access to Team Hub and Profile Customizer.
 */

export function ProjectSetupView() {
  const { project, updateProjectDetails } = useProject();
  const { member: me, setCurrentMember } = useCurrentMember();

  const [isEditingProject, setIsEditingProject] = useState(false);
  const [courseInput, setCourseInput] = useState(project.course);
  const [nameInput, setNameInput] = useState(project.name);
  const [deadlineInput, setDeadlineInput] = useState(project.deadline);
  const [descInput, setDescInput] = useState(project.description);

  const openEditModal = () => {
    setCourseInput(project.course);
    setNameInput(project.name);
    setDeadlineInput(project.deadline);
    setDescInput(project.description);
    setIsEditingProject(true);
  };

  const handleSaveProject = (e: React.FormEvent) => {
    e.preventDefault();
    updateProjectDetails({
      course: courseInput.trim(),
      name: nameInput.trim(),
      deadline: deadlineInput.trim(),
      description: descInput.trim(),
    });
    setIsEditingProject(false);
  };

  return (
    <div className="space-y-10 animate-fade-in">
      {/* Top Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="font-heading text-3xl sm:text-[34px] font-bold tracking-tight text-[#F5F2FA]">
            Project &amp; Team
          </h1>
          <p className="text-base text-[#AAA5B4] max-w-2xl leading-relaxed">
            Your assignment, deadline, and team members matched to their active skills.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/team"
            className="inline-flex items-center gap-2 rounded-xl bg-[#D5B45C] px-4 py-2.5 text-xs font-semibold text-[#0F1117] hover:bg-[#E2C36E] active:scale-[0.97] transition-all shadow-md shadow-[#D5B45C]/20"
          >
            <span>➕</span>
            <span>Add Teammates in Team Hub</span>
          </Link>
          <Link
            href="/plan"
            className="inline-flex items-center gap-2 rounded-xl border border-[#B8A6FF]/40 bg-[#171A23] px-4 py-2.5 text-xs font-semibold text-[#F5F2FA] hover:border-[#B8A6FF] hover:bg-[#B8A6FF]/15 active:scale-[0.97] transition-all"
          >
            <span>💻</span>
            <span>Open AI Plan →</span>
          </Link>
        </div>
      </div>

      {/* Project Card: Assignment & Deadline */}
      <div className="rounded-2xl border border-[#2A2E39] bg-[#171A23] p-6 sm:p-8 space-y-4 hover-lift">
        {isEditingProject ? (
          <form onSubmit={handleSaveProject} className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between border-b border-[#2A2E39] pb-3">
              <h3 className="font-heading text-lg font-bold text-[#F5F2FA]">Edit Project Information</h3>
              <button
                type="button"
                onClick={() => setIsEditingProject(false)}
                className="text-xs text-[#AAA5B4] hover:text-[#F5F2FA]"
              >
                ✕ Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#AAA5B4] mb-1.5">Course Code / Name</label>
                <input
                  type="text"
                  value={courseInput}
                  onChange={(e) => setCourseInput(e.target.value)}
                  placeholder="e.g. CSC 648: Software Engineering, BIO 240, ENG 300"
                  className="w-full rounded-xl border border-[#2A2E39] bg-[#1D202A] px-4 py-2.5 text-sm text-[#F5F2FA] focus:outline-none focus:border-[#B8A6FF]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#AAA5B4] mb-1.5">Target Submission / Deadline</label>
                <input
                  type="text"
                  value={deadlineInput}
                  onChange={(e) => setDeadlineInput(e.target.value)}
                  placeholder="e.g. October 16, 2026 or 2026-10-16"
                  className="w-full rounded-xl border border-[#2A2E39] bg-[#1D202A] px-4 py-2.5 text-sm text-[#F5F2FA] focus:outline-none focus:border-[#B8A6FF]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#AAA5B4] mb-1.5">Project Name</label>
              <input
                type="text"
                required
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="e.g. Collaborative Multiplayer Web App"
                className="w-full rounded-xl border border-[#2A2E39] bg-[#1D202A] px-4 py-2.5 text-sm text-[#F5F2FA] focus:outline-none focus:border-[#B8A6FF]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#AAA5B4] mb-1.5">Project Description / Scope</label>
              <textarea
                rows={3}
                value={descInput}
                onChange={(e) => setDescInput(e.target.value)}
                placeholder="Brief description of the deliverables and scope"
                className="w-full rounded-xl border border-[#2A2E39] bg-[#1D202A] px-4 py-2 text-sm text-[#F5F2FA] focus:outline-none focus:border-[#B8A6FF]"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsEditingProject(false)}
                className="rounded-xl border border-[#2A2E39] px-4 py-2 text-xs font-medium text-[#AAA5B4] hover:text-[#F5F2FA]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#D5B45C] px-5 py-2 text-xs font-semibold text-[#0F1117] hover:bg-[#E2C36E] transition shadow-md shadow-[#D5B45C]/20"
              >
                Save Project Details
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-lg bg-[#1D202A] border border-[#2A2E39] px-3 py-1 text-xs font-semibold text-[#B8A6FF]">
                  {project.course || "No Course Specified"}
                </span>
                <span className="text-sm text-[#AAA5B4]">
                  Target submission: <strong className="text-[#D5B45C] font-semibold">{project.deadline || "TBD"}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={openEditModal}
                  className="rounded-xl border border-[#2A2E39] px-3 py-1.5 text-xs font-medium text-[#AAA5B4] hover:text-[#F5F2FA] hover:border-[#B8A6FF]/40 transition"
                >
                  ✏️ Edit Project Info
                </button>
                <Link
                  href="/team"
                  className="rounded-xl border border-[#2A2E39] px-3 py-1.5 text-xs font-medium text-[#AAA5B4] hover:text-[#D5B45C] hover:border-[#D5B45C]/40 transition"
                >
                  🚀 Switch or Create Team
                </Link>
              </div>
            </div>
            <h2 className="font-heading text-2xl font-bold text-[#F5F2FA] tracking-tight">
              {project.name}
            </h2>
            <p className="text-base text-[#AAA5B4] leading-relaxed max-w-3xl">
              {project.description}
            </p>
          </>
        )}
      </div>

      {/* Team Roster Section */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-2xl font-semibold text-[#F5F2FA] tracking-tight">
              Team members ({project.members.length})
            </h2>
            <p className="text-sm text-[#AAA5B4] mt-0.5">
              Active skills and learning goals for {project.course || "this project"}. Click any teammate to view as them.
            </p>
          </div>
          <Link
            href="/profile"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#B8A6FF]/30 bg-[#171A23] px-3.5 py-2 text-xs font-semibold text-[#B8A6FF] hover:border-[#B8A6FF] hover:text-[#F5F2FA] transition"
          >
            <span>🎓</span>
            <span>Customize your project profile &amp; roles →</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {project.members.map((member) => {
            const isMe = member.id === me?.id;
            return (
              <div
                key={member.id}
                className={`flex flex-col justify-between rounded-2xl border p-6 space-y-5 transition-all duration-300 hover-lift ${
                  isMe
                    ? "border-[#D5B45C]/60 bg-[#1D202A] ring-1 ring-[#D5B45C]/30 shadow-lg shadow-[#D5B45C]/5"
                    : "border-[#2A2E39] bg-[#1D202A] hover:border-[#B8A6FF]/50"
                }`}
              >
                <div className="space-y-4">
                  {/* Member header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl font-heading font-bold text-sm transition-transform ${
                          isMe
                            ? "bg-[#D5B45C] text-[#0F1117] ring-2 ring-[#D5B45C]/40"
                            : "bg-[#171A23] border border-[#2A2E39] text-[#B8A6FF]"
                        }`}
                      >
                        {member.initials}
                      </div>
                      <div>
                        <h3 className="font-heading text-lg font-semibold text-[#F5F2FA] leading-snug">
                          {member.name}
                        </h3>
                        <p className="text-xs text-[#D5B45C] font-medium">
                          {member.role || "Team Member"}
                        </p>
                      </div>
                    </div>
                    {isMe ? (
                      <span className="rounded-full bg-[#D5B45C]/20 border border-[#D5B45C]/40 px-2.5 py-1 text-[11px] font-semibold text-[#D5B45C]">
                        Active Persona
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setCurrentMember(member.id)}
                        className="rounded-xl border border-[#B8A6FF]/40 bg-[#171A23] px-3 py-1.5 text-xs font-semibold text-[#B8A6FF] hover:bg-[#B8A6FF] hover:text-[#0F1117] transition cursor-pointer active:scale-95"
                      >
                        View as {member.name.split(" ")[0]}
                      </button>
                    )}
                  </div>

                  {/* Strengths */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-[#AAA5B4]">
                      Active Skills
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {member.skills.length === 0 ? (
                        <span className="text-xs text-[#AAA5B4]">No skills listed yet</span>
                      ) : (
                        member.skills.map((skill) => (
                          <span
                            key={skill}
                            className="rounded-lg bg-[#171A23] border border-[#2A2E39] px-2.5 py-1 text-xs text-[#F5F2FA]"
                          >
                            {skill}
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Interested in learning */}
                  {member.wantsToLearn.length > 0 && (
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
                  )}
                </div>

                <div className="pt-2 border-t border-[#2A2E39]/60 flex items-center justify-between text-xs text-[#AAA5B4]">
                  <span>Matched to {project.course || "course"}</span>
                  <Link
                    href={`/meet#`}
                    className="text-[#B8A6FF] hover:underline"
                  >
                    Quick Meet →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

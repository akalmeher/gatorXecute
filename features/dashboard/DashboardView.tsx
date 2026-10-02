"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useProject } from "@/context/ProjectContext";
import { useCurrentMember } from "@/features/identity/useCurrentMember";
import { useProfile } from "@/features/profile/useProfile";
import type { TaskStatus } from "@/types";
import type { SkillsResponse } from "@/features/ai/skills";

const COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: "todo", label: "To Do" },
  { id: "in-progress", label: "In Progress" },
  { id: "blocked", label: "Blocked" },
  { id: "done", label: "Done" },
];

export function DashboardView() {
  const { project, updateTaskStatus, getMemberById, replaceMembers } = useProject();
  const { member: me } = useCurrentMember();
  const { profile, getProjectProfile, saveProjectProfile } = useProfile();

  const projectKey = project.course || project.name || "DefaultProject";
  const existingProjectProfile = getProjectProfile(projectKey);

  // Natural language per-task profile activation state
  const [nlInput, setNlInput] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(!existingProjectProfile);
  const [activatedSuccess, setActivatedSuccess] = useState(false);

  const getTaskCount = (status: TaskStatus) =>
    project.tasks.filter((t) => t.status === status).length;

  const handleAiActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nlInput.trim() || isExtracting) return;

    setIsExtracting(true);
    setExtractError(null);

    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: nlInput.trim(), mode: "live" }),
      });
      const data = (await res.json()) as SkillsResponse;

      if (!data.ok) {
        setExtractError(data.message || "Failed to extract skills.");
        return;
      }

      const skills = data.result.skills;
      const wantsToLearn = data.result.wantsToLearn;
      // Infer a role title from skills or use major
      const inferredRole =
        skills.length > 0
          ? `${skills[0]} Specialist`
          : me?.role || profile?.major || "Team Member";

      // Save to Per-Task Profile storage
      saveProjectProfile({
        projectId: projectKey,
        role: inferredRole,
        activeSkills: skills,
        wantsToLearn,
      });

      // Update in ProjectContext for active workspace
      if (me) {
        const updatedMembers = project.members.map((m) =>
          m.id === me.id ? { ...m, role: inferredRole, skills, wantsToLearn } : m
        );
        replaceMembers(updatedMembers);
      }

      setActivatedSuccess(true);
      setShowEditor(false);
      setNlInput("");
      setTimeout(() => setActivatedSuccess(false), 4000);
    } catch {
      setExtractError("Couldn't connect to AI tag generator. Please try again.");
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="rounded-md border border-[#2A2E39] bg-[#1D202A] px-2.5 py-0.5 text-xs font-semibold text-[#B8A6FF]">
              {project.course || "Project Board"}
            </span>
            <span className="text-xs text-[#AAA5B4]">{project.tasks.length} tasks</span>
          </div>
          <h1 className="font-heading text-3xl sm:text-[34px] font-bold tracking-tight text-[#F5F2FA]">
            {project.name ? `${project.name} Board` : "Work Dashboard"}
          </h1>
          <p className="text-base text-[#AAA5B4] max-w-2xl leading-relaxed">
            Move tasks through each stage and coordinate ownership across the team.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/plan"
            className="inline-flex items-center gap-2 rounded-xl border border-[#B8A6FF]/40 bg-[#171A23] px-4 py-2.5 text-xs font-semibold text-[#F5F2FA] hover:bg-[#B8A6FF]/15 transition active:scale-95"
          >
            <span>💻</span>
            <span>AI Plan Generator</span>
          </Link>
          <Link
            href="/project"
            className="inline-flex items-center gap-2 rounded-xl bg-[#D5B45C] px-4 py-2.5 text-xs font-semibold text-[#0F1117] hover:bg-[#E2C36E] transition shadow-md shadow-[#D5B45C]/20 active:scale-95"
          >
            <span>👥</span>
            <span>Team &amp; Roles</span>
          </Link>
        </div>
      </div>

      {/* Per-Task Profile Activation Card (Turn-key, Natural Language AI) */}
      <div className="rounded-2xl border border-[#2A2E39] bg-[#171A23] p-5 shadow-sm transition-all duration-300">
        {existingProjectProfile && !showEditor ? (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#AAA5B4]">
                  Your Per-Task Role for this Board:
                </span>
                <span className="rounded-full bg-[#B8A6FF]/20 px-2.5 py-0.5 text-xs font-semibold text-[#B8A6FF]">
                  {existingProjectProfile.role || "Team Member"}
                </span>
                {activatedSuccess && (
                  <span className="text-xs font-medium text-[#D5B45C] animate-fade-in">
                    ✓ Activated with Gemini!
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-xs text-[#AAA5B4]">Active task skills:</span>
                {existingProjectProfile.activeSkills.length === 0 ? (
                  <span className="text-xs text-[#AAA5B4]/60">None specified yet</span>
                ) : (
                  existingProjectProfile.activeSkills.map((s) => (
                    <span
                      key={s}
                      className="rounded-lg border border-[#2A2E39] bg-[#1D202A] px-2 py-0.5 text-[11px] text-[#F5F2FA]"
                    >
                      {s}
                    </span>
                  ))
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowEditor(true)}
              className="self-start sm:self-auto rounded-xl border border-[#2A2E39] px-3.5 py-1.5 text-xs font-medium text-[#AAA5B4] hover:border-[#B8A6FF]/50 hover:text-[#F5F2FA] transition"
            >
              Update Per-Task Skills
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-heading text-base font-bold text-[#F5F2FA] flex items-center gap-2">
                  <span>⚡</span>
                  <span>Activate Your Per-Task Role for {project.course || project.name}</span>
                </h3>
                <p className="text-xs text-[#AAA5B4] mt-0.5">
                  Invited to work on this board? Just type what you can do in plain English, and Gemini will generate your role &amp; skill tags.
                </p>
              </div>
              {existingProjectProfile && (
                <button
                  type="button"
                  onClick={() => setShowEditor(false)}
                  className="text-xs text-[#AAA5B4] hover:text-[#F5F2FA]"
                >
                  ✕ Close
                </button>
              )}
            </div>

            <form onSubmit={handleAiActivate} className="flex flex-col sm:flex-row gap-2 pt-1">
              <input
                value={nlInput}
                onChange={(e) => setNlInput(e.target.value)}
                disabled={isExtracting}
                placeholder="e.g. I can build the React frontend, design Figma UI mockups, and want to learn backend APIs"
                className="flex-1 rounded-xl border border-[#2A2E39] bg-[#1D202A] px-4 py-2.5 text-sm text-[#F5F2FA] placeholder:text-[#AAA5B4]/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]/60"
              />
              <button
                type="submit"
                disabled={!nlInput.trim() || isExtracting}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#D5B45C] px-5 py-2.5 text-xs font-semibold text-[#0F1117] hover:bg-[#E2C36E] transition shadow-md shadow-[#D5B45C]/20 disabled:opacity-60 active:scale-95 shrink-0 cursor-pointer"
              >
                {isExtracting ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#0F1117]/30 border-t-[#0F1117]" />
                    <span>Extracting tags…</span>
                  </>
                ) : (
                  <>
                    <span>✨</span>
                    <span>AI Generate Tags</span>
                  </>
                )}
              </button>
            </form>

            {extractError && (
              <p role="alert" className="text-xs text-[#D5B45C]">
                {extractError}
              </p>
            )}

            <div className="flex items-center justify-between text-[11px] text-[#AAA5B4]/80 pt-1">
              <span>Main profile remains universal across SFSU</span>
              <Link href="/profile" className="text-[#B8A6FF] hover:underline">
                Or customize manually in Profile Hub →
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Kanban Board (Baby Jira) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {COLUMNS.map((col) => {
          const columnTasks = project.tasks.filter((t) => t.status === col.id);

          return (
            <div
              key={col.id}
              className="flex flex-col rounded-2xl border border-[#2A2E39] bg-[#171A23] p-4 min-h-[480px] shadow-sm"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between px-2 py-2 mb-3">
                <span className="font-heading text-sm font-semibold text-[#F5F2FA]">
                  {col.label}
                </span>
                <span className="rounded-md bg-[#1D202A] border border-[#2A2E39] px-2 py-0.5 text-xs font-medium text-[#AAA5B4]">
                  {getTaskCount(col.id)}
                </span>
              </div>

              {/* Tasks List */}
              <div className="flex flex-col gap-3 flex-1">
                {columnTasks.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-[#2A2E39] p-4 text-center text-xs text-[#AAA5B4]/50">
                    No items here
                  </div>
                ) : (
                  columnTasks.map((task) => {
                    const owner = getMemberById(task.ownerId);
                    const isMyTask = owner?.id === me?.id;

                    return (
                      <div
                        key={task.id}
                        className={`rounded-xl border p-4 space-y-3 transition-all duration-200 hover-lift ${
                          isMyTask
                            ? "border-[#B8A6FF]/60 bg-[#1D202A] shadow-md shadow-[#B8A6FF]/5"
                            : "border-[#2A2E39] bg-[#1D202A] hover:border-[#B8A6FF]/40"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-heading text-base font-semibold text-[#F5F2FA] leading-snug">
                            {task.title}
                          </h3>
                          {isMyTask && (
                            <span className="rounded-full bg-[#B8A6FF]/20 px-2 py-0.5 text-[10px] font-semibold text-[#B8A6FF] shrink-0">
                              You
                            </span>
                          )}
                        </div>

                        {task.dueDate && (
                          <div className="text-xs text-[#AAA5B4]">
                            Due {task.dueDate}
                          </div>
                        )}

                        {/* Card Footer: Assignee & Column Mover */}
                        <div className="pt-2 border-t border-[#2A2E39]/60 flex flex-wrap items-center justify-between gap-2 min-w-0">
                          <div
                            title={owner ? owner.name : "Unassigned"}
                            className="flex items-center gap-2 min-w-0 flex-1"
                          >
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#171A23] border border-[#2A2E39] font-heading text-[#B8A6FF] text-[10px] font-bold">
                              {owner ? owner.initials : "?"}
                            </div>
                            <span className="text-xs text-[#AAA5B4] truncate min-w-0">
                              {owner ? owner.name.split(" ")[0] : "Unassigned"}
                            </span>
                          </div>

                          <select
                            value={task.status}
                            aria-label={`Move ${task.title}`}
                            onChange={(e) =>
                              updateTaskStatus(task.id, e.target.value as TaskStatus)
                            }
                            className="w-[108px] shrink-0 rounded-lg border border-[#2A2E39] bg-[#171A23] px-2 py-1 text-xs text-[#AAA5B4] hover:text-[#F5F2FA] hover:border-[#B8A6FF]/40 focus:outline-none cursor-pointer"
                          >
                            <option value="todo">To Do</option>
                            <option value="in-progress">In Progress</option>
                            <option value="blocked">Blocked</option>
                            <option value="done">Done</option>
                          </select>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

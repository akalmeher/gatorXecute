"use client";

import React from "react";
import Link from "next/link";
import { useProject } from "@/context/ProjectContext";

/**
 * Feature Owner: Divij Anand
 * Domain: Gemini integration, AI task decomposition schemas, prompt pipelines.
 * Note: Lightweight placeholder establishing shared interfaces for the MVP demo foundation.
 */
export function ProjectPlanView() {
  const { project, getMemberById } = useProject();

  return (
    <div className="space-y-8">
      {/* AI Plan Banner */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-100 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                AI Decomposition
              </span>
              <span className="text-xs text-zinc-500 font-mono">
                Model: Gemini 2.5 Pro (Mock Foundation)
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900">
              AI Project Plan & Task Allocation
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Assignment prompt decomposed into dependent milestones with skill-matched recommendations.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-lg bg-[var(--gator-purple)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
            >
              Open Team Dashboard →
            </Link>
          </div>
        </div>

        {/* AI Rationale Notice */}
        <div className="mt-4 rounded-lg bg-zinc-50 p-4 border border-zinc-200/80">
          <div className="flex items-start gap-2.5">
            <span className="text-sm">💡</span>
            <div className="text-xs text-zinc-700 leading-relaxed">
              <strong className="font-semibold text-zinc-900">Allocation Strategy:</strong> Tasks are balanced against teammates&apos; demonstrated strengths and stated learning goals. AI suggestions are non-binding and fully reassignable.
            </div>
          </div>
        </div>
      </div>

      {/* Decomposed Tasks Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">
            Decomposed Milestones & Work Items ({project.tasks.length})
          </h2>
          <span className="text-xs text-zinc-500">
            Feature Owner: Divij Anand (Gemini Route)
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {project.tasks.map((task) => {
            const owner = getMemberById(task.ownerId || task.suggestedOwnerId);
            return (
              <div
                key={task.id}
                className="rounded-lg border border-zinc-200 bg-white p-5 shadow-xs hover:border-zinc-300 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-zinc-400">
                        {task.id}
                      </span>
                      <h3 className="text-base font-bold text-zinc-900">
                        {task.title}
                      </h3>
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${
                          task.status === "done"
                            ? "bg-emerald-100 text-emerald-800"
                            : task.status === "in-progress"
                            ? "bg-blue-100 text-blue-800"
                            : task.status === "blocked"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-zinc-100 text-zinc-700"
                        }`}
                      >
                        {task.status}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-600">
                      {task.description}
                    </p>
                  </div>

                  {/* Owner Badge */}
                  <div className="shrink-0 flex items-center gap-2 rounded-md bg-zinc-50 px-3 py-1.5 border border-zinc-200">
                    <span className="text-xs text-zinc-500">Owner:</span>
                    <span className="text-xs font-semibold text-zinc-900">
                      {owner ? owner.name : "Unassigned"}
                    </span>
                  </div>
                </div>

                {/* Metadata & Dependencies */}
                <div className="mt-4 pt-3 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500">
                  <div className="flex flex-wrap items-center gap-4">
                    {task.dependencies.length > 0 && (
                      <span className="flex items-center gap-1 font-mono">
                        <strong className="text-zinc-700">Deps:</strong>{" "}
                        {task.dependencies.join(", ")}
                      </span>
                    )}
                    {task.estimatedMinutes && (
                      <span>
                        <strong className="text-zinc-700">Est:</strong>{" "}
                        {Math.floor(task.estimatedMinutes / 60)}h{" "}
                        {task.estimatedMinutes % 60}m
                      </span>
                    )}
                    {task.dueDate && (
                      <span>
                        <strong className="text-zinc-700">Due:</strong> {task.dueDate}
                      </span>
                    )}
                  </div>

                  {task.assignmentReason && (
                    <div className="text-zinc-600 italic">
                      AI Reasoning: &quot;{task.assignmentReason}&quot;
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

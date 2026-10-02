"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Project, Task } from "@/types";
import type { PlanErrorResponse, PlanMode, PlanRequest, PlanResponse, PlanSource } from "./plan-types";

/**
 * Feature Owner: Divij Anand
 * Client hook for POST /api/plan. Holds the editable draft separately from
 * shared project state so a failed or discarded generation never touches it.
 */

export interface PlanDraft {
  source: PlanSource;
  model?: string;
  tasks: Task[];
}

type PlanError = Pick<PlanErrorResponse, "error" | "message" | "issues">;

function toPlanRequest(project: Project, mode: PlanMode): PlanRequest {
  return {
    mode,
    project: {
      id: project.id,
      name: project.name,
      course: project.course,
      description: project.description,
      deadline: project.deadline,
      members: project.members.map(({ id, name, role, skills, wantsToLearn }) => ({
        id,
        name,
        role,
        skills,
        wantsToLearn,
      })),
    },
  };
}

export function usePlanGeneration(project: Project) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<PlanError | null>(null);
  const [draft, setDraft] = useState<PlanDraft | null>(null);
  const inFlight = useRef<AbortController | null>(null);

  useEffect(() => () => inFlight.current?.abort(), []);

  const generate = useCallback(
    async (mode: PlanMode) => {
      // Duplicate-click protection: ignore requests while one is running.
      if (inFlight.current) return;
      const controller = new AbortController();
      inFlight.current = controller;
      setIsGenerating(true);
      setError(null);

      try {
        const response = await fetch("/api/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(toPlanRequest(project, mode)),
          signal: controller.signal,
        });
        const body = (await response.json()) as PlanResponse;
        if (body.ok) {
          setDraft({ source: body.source, model: body.model, tasks: body.tasks });
        } else {
          setError({ error: body.error, message: body.message, issues: body.issues });
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error("[plan] request failed", err);
        setError({
          error: "gemini_request_failed",
          message: "Could not reach the plan service. Check your connection and try again.",
        });
      } finally {
        if (inFlight.current === controller) inFlight.current = null;
        if (!controller.signal.aborted) setIsGenerating(false);
      }
    },
    [project]
  );

  const updateDraftTask = useCallback((taskId: string, changes: Partial<Task>) => {
    setDraft((prev) =>
      prev && {
        ...prev,
        tasks: prev.tasks.map((task) => (task.id === taskId ? { ...task, ...changes } : task)),
      }
    );
  }, []);

  const removeDraftTask = useCallback((taskId: string) => {
    setDraft((prev) =>
      prev && {
        ...prev,
        tasks: prev.tasks
          .filter((task) => task.id !== taskId)
          .map((task) => ({ ...task, dependencies: task.dependencies.filter((id) => id !== taskId) })),
      }
    );
  }, []);

  const discardDraft = useCallback(() => setDraft(null), []);

  return { isGenerating, error, draft, generate, updateDraftTask, removeDraftTask, discardDraft };
}

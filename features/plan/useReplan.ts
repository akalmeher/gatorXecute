"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Project } from "@/types";
import type { ReplanRequest, ReplanResponse, ReplanSuggestion } from "./replan-types";

/**
 * Feature Owner: Divij Anand
 * Client hook for POST /api/replan. Keeps the suggestion local until accepted.
 */

type ReplanError = { error: string; message: string; issues?: string[] };

export function useReplan(project: Project) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ReplanError | null>(null);
  const [suggestion, setSuggestion] = useState<ReplanSuggestion | null>(null);
  const [source, setSource] = useState<"gemini" | "demo">("gemini");
  const avoid = useRef<string[]>([]);
  const concernRef = useRef<string | undefined>(undefined);
  const awayRef = useRef<ReplanRequest["away"]>(undefined);
  const inFlight = useRef<AbortController | null>(null);

  useEffect(() => () => inFlight.current?.abort(), []);

  const request = useCallback(
    async ({
      concern,
      away,
      another = false,
      mode = "live",
    }: {
      concern?: string;
      /** Someone can't work for a while: the plan must never add load or earlier deadlines to them. */
      away?: ReplanRequest["away"];
      another?: boolean;
      mode?: "live" | "demo";
    }) => {
      if (inFlight.current) return;
      if (another && suggestion) avoid.current = [...avoid.current, suggestion.proposal];
      if (!another) {
        avoid.current = [];
        concernRef.current = concern?.trim() || undefined;
        awayRef.current = away;
      }

      const controller = new AbortController();
      inFlight.current = controller;
      setIsLoading(true);
      setError(null);

      const body: ReplanRequest = {
        mode,
        project: {
          id: project.id,
          name: project.name,
          deadline: project.deadline,
          members: project.members.map(({ id, name, skills, wantsToLearn }) => ({ id, name, skills, wantsToLearn })),
        },
        tasks: project.tasks,
        concern: concernRef.current,
        away: awayRef.current,
        notes: project.asyncUpdates.slice(0, 6).map((update) => ({
          from: project.members.find((m) => m.id === update.memberId)?.name ?? "A teammate",
          text: update.content,
        })),
        avoid: avoid.current,
      };

      try {
        const response = await fetch("/api/replan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        const result = (await response.json()) as ReplanResponse;
        if (result.ok) {
          setSuggestion(result.suggestion);
          setSource(result.source);
        } else {
          setError({ error: result.error, message: result.message, issues: result.issues });
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error("[replan] request failed", err);
        setError({ error: "gemini_request_failed", message: "Couldn't reach the planning service." });
      } finally {
        if (inFlight.current === controller) inFlight.current = null;
        if (!controller.signal.aborted) setIsLoading(false);
      }
    },
    [project, suggestion]
  );

  const dismiss = useCallback(() => {
    setSuggestion(null);
    setError(null);
    avoid.current = [];
  }, []);

  return { isLoading, error, suggestion, source, request, dismiss };
}

"use client";

import { useCallback } from "react";
import type { ShareCheck, ShareCheckResponse } from "@/features/ai/share-check-types";
import { discreetNote, mentionsCrisis, mentionsPersonal } from "@/features/ai/care";

/**
 * Feature Owner: Divij Anand
 * Calls /api/share-check. If the server can't be reached, the same care rules
 * still apply locally: personal messages default to a discreet note, and crisis
 * language always shows support.
 */
export function useShareCheck() {
  return useCallback(async (text: string, authorName: string): Promise<ShareCheck> => {
    try {
      const response = await fetch("/api/share-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, authorName }),
      });
      const data = (await response.json()) as ShareCheckResponse;
      if (data.ok) return data.check;
    } catch {
      // fall through to the local rules
    }
    const personal = mentionsPersonal(text);
    return {
      personal,
      shareable: personal ? discreetNote(authorName) : text,
      wellbeing: mentionsCrisis(text) ? "crisis" : personal ? "low" : "none",
      acknowledgement: personal ? "I'm sorry you're going through this." : "",
    };
  }, []);
}

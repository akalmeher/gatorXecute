"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useProject } from "@/context/ProjectContext";

/**
 * Feature Owner: Divij Anand
 * "Never ask twice": the demo stand-in for a signed-in user. Students pick who
 * they are once; it's remembered in this browser only (no account, nothing sent
 * anywhere) and used everywhere that would otherwise ask "Who are you?".
 */

const STORAGE_KEY = "gatorxecute:current-member";
const listeners = new Set<() => void>();
// Fallback when storage is unavailable (e.g. some private windows).
let memoryValue: string | null = null;

function read(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? memoryValue;
  } catch {
    return memoryValue;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function useCurrentMember() {
  const { project } = useProject();
  const storedId = useSyncExternalStore(subscribe, read, () => null);
  const member = project.members.find((m) => m.id === storedId);

  const setCurrentMember = useCallback((memberId: string | null) => {
    memoryValue = memberId;
    try {
      if (memberId) window.localStorage.setItem(STORAGE_KEY, memberId);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage unavailable: the in-memory value lasts until refresh.
    }
    listeners.forEach((listener) => listener());
  }, []);

  return { member, memberId: member?.id, setCurrentMember };
}

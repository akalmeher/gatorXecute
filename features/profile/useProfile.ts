"use client";

import { useCallback, useSyncExternalStore } from "react";
import { type Profile, sanitizeProfile } from "./profile";

/**
 * Feature Owner: Divij Anand
 * The profile lives in this browser only (localStorage, with an in-memory
 * fallback). Nothing is sent anywhere until the student shares a team link.
 */

const STORAGE_KEY = "gatorxecute:profile";
const listeners = new Set<() => void>();
let memoryValue: string | null = null;

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? memoryValue;
  } catch {
    return memoryValue;
  }
}

// useSyncExternalStore needs a stable snapshot: parse once per raw string.
let cachedRaw: string | null = null;
let cachedProfile: Profile | null = null;
function read(): Profile | null {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cachedProfile = raw ? sanitizeProfile(JSON.parse(raw)) : null;
    } catch {
      cachedProfile = null;
    }
  }
  return cachedProfile;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function useProfile() {
  const profile = useSyncExternalStore(subscribe, read, () => null);

  const saveProfile = useCallback((next: Profile) => {
    const clean = sanitizeProfile(next);
    if (!clean) return;
    const raw = JSON.stringify(clean);
    memoryValue = raw;
    try {
      window.localStorage.setItem(STORAGE_KEY, raw);
    } catch {
      // Storage unavailable: kept in memory until refresh.
    }
    listeners.forEach((listener) => listener());
  }, []);

  return { profile, saveProfile };
}

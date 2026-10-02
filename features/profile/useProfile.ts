"use client";

import { useCallback, useSyncExternalStore } from "react";
import { type Profile, type ProjectProfile, sanitizeProfile, sanitizeProjectProfile } from "./profile";

/**
 * Feature Owner: Divij Anand
 * The profile lives in this browser only (localStorage, with an in-memory fallback).
 * Stores both the global SFSU Uni profile and per-project/course profiles (Discord server profile style).
 */

const STORAGE_KEY = "gatorxecute:profile";
const PROJECT_PROFILES_KEY = "gatorxecute:project-profiles";

const listeners = new Set<() => void>();
let memoryProfileValue: string | null = null;
let memoryProjectProfilesValue: string | null = null;

function readProfileRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? memoryProfileValue;
  } catch {
    return memoryProfileValue;
  }
}

function readProjectProfilesRaw(): string | null {
  try {
    return window.localStorage.getItem(PROJECT_PROFILES_KEY) ?? memoryProjectProfilesValue;
  } catch {
    return memoryProjectProfilesValue;
  }
}

let cachedRawProfile: string | null = null;
let cachedProfile: Profile | null = null;
function readProfile(): Profile | null {
  const raw = readProfileRaw();
  if (raw !== cachedRawProfile) {
    cachedRawProfile = raw;
    try {
      cachedProfile = raw ? sanitizeProfile(JSON.parse(raw)) : null;
    } catch {
      cachedProfile = null;
    }
  }
  return cachedProfile;
}

let cachedRawProjectProfiles: string | null = null;
let cachedProjectProfiles: Record<string, ProjectProfile> = {};
function readProjectProfiles(): Record<string, ProjectProfile> {
  const raw = readProjectProfilesRaw();
  if (raw !== cachedRawProjectProfiles) {
    cachedRawProjectProfiles = raw;
    try {
      if (!raw) {
        cachedProjectProfiles = {};
      } else {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const out: Record<string, ProjectProfile> = {};
        for (const [key, val] of Object.entries(parsed)) {
          const clean = sanitizeProjectProfile(val);
          if (clean) out[key] = clean;
        }
        cachedProjectProfiles = out;
      }
    } catch {
      cachedProjectProfiles = {};
    }
  }
  return cachedProjectProfiles;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

const EMPTY_PROJECT_PROFILES: Record<string, ProjectProfile> = {};

export function useProfile() {
  const profile = useSyncExternalStore(subscribe, readProfile, () => null);
  const projectProfiles = useSyncExternalStore<Record<string, ProjectProfile>>(
    subscribe,
    readProjectProfiles,
    () => EMPTY_PROJECT_PROFILES
  );

  const saveProfile = useCallback((next: Profile) => {
    const clean = sanitizeProfile(next);
    if (!clean) return;
    const raw = JSON.stringify(clean);
    memoryProfileValue = raw;
    try {
      window.localStorage.setItem(STORAGE_KEY, raw);
    } catch {
      // Storage unavailable: kept in memory until refresh.
    }
    listeners.forEach((listener) => listener());
  }, []);

  const saveProjectProfile = useCallback((next: ProjectProfile) => {
    const clean = sanitizeProjectProfile(next);
    if (!clean) return;
    const current = readProjectProfiles();
    const updated = { ...current, [clean.projectId]: clean };
    const raw = JSON.stringify(updated);
    memoryProjectProfilesValue = raw;
    try {
      window.localStorage.setItem(PROJECT_PROFILES_KEY, raw);
    } catch {
      // Storage unavailable: kept in memory until refresh.
    }
    listeners.forEach((listener) => listener());
  }, []);

  const getProjectProfile = useCallback(
    (projectId: string): ProjectProfile | null => {
      return projectProfiles[projectId] ?? null;
    },
    [projectProfiles]
  );

  return { profile, saveProfile, projectProfiles, saveProjectProfile, getProjectProfile };
}

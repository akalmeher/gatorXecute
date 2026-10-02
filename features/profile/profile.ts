import type { Member } from "@/types";

/**
 * Feature Owner: Divij Anand
 * A profile is the demo's account: name, major and skill tags, saved on this
 * device with no password and no server. Its id is the member id used across
 * the app, so "who are you?" is never asked twice.
 */

export interface Profile {
  id: string;
  name: string;
  /** Optional context only: never used to infer ability. */
  major?: string;
  skills: string[];
  wantsToLearn: string[];
}

export const MAX_TAGS = 12;
export const MAX_TAG_CHARS = 30;
export const MAX_NAME_CHARS = 40;

/** Common things students can do in group projects; a starting point, not a test. */
export const SKILL_SUGGESTIONS = [
  "Writing",
  "Research",
  "Presenting",
  "Slide design",
  "Editing & proofreading",
  "Data analysis",
  "Statistics",
  "Video editing",
  "UI/UX design",
  "Frontend",
  "Backend",
  "Lab work",
  "Organizing the team",
  "Interviewing people",
];

export function newProfileId(): string {
  return `me-${Math.random().toString(36).slice(2, 10)}`;
}

/** Trims, caps length and de-duplicates (case-insensitive), keeping the first spelling. */
export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const tag = raw.replace(/\s+/g, " ").trim().slice(0, MAX_TAG_CHARS);
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

export function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "?"
  );
}

/** Cleans anything that claims to be a profile (from storage or a link); null if unusable. */
export function sanitizeProfile(raw: unknown): Profile | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id.replace(/[^\w-]/g, "").slice(0, 24) : "";
  const name = typeof r.name === "string" ? r.name.replace(/\s+/g, " ").trim().slice(0, MAX_NAME_CHARS) : "";
  if (!id || !name) return null;
  const tags = (v: unknown) => normalizeTags(Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  const major = typeof r.major === "string" ? r.major.trim().slice(0, 60) : "";
  return { id, name, ...(major ? { major } : {}), skills: tags(r.skills), wantsToLearn: tags(r.wantsToLearn) };
}

export function profileToMember(profile: Profile): Member {
  return {
    id: profile.id,
    name: profile.name,
    role: profile.major,
    skills: profile.skills,
    wantsToLearn: profile.wantsToLearn,
    initials: initialsOf(profile.name),
  };
}

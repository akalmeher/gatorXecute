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
  bio?: string;
  skills: string[];
  wantsToLearn: string[];
}

/**
 * Per-project profile (analogous to Discord's per-server profile).
 * In a cinema class, your CSC 667 skills aren't relevant, but video editing is.
 * In a software class, your engineering skills take front seat.
 */
export interface ProjectProfile {
  projectId: string;
  /** Role/nickname in this project (e.g. "Video Editor & Co-Presenter", "Frontend Lead"). */
  role?: string;
  /** The specific subset of skills active for this project/task. */
  activeSkills: string[];
  /** Project-specific learning goals. */
  wantsToLearn: string[];
}

export const MAX_TAGS = 16;
export const MAX_TAG_CHARS = 30;
export const MAX_NAME_CHARS = 40;

export interface SkillCategory {
  name: string;
  color: string;
  skills: string[];
}

/** SFSU departmental & multidisciplinary skill catalogs for quick selection. */
export const SKILL_CATEGORIES: SkillCategory[] = [
  {
    name: "CS & Tech",
    color: "#B8A6FF",
    skills: ["Frontend", "Backend", "TypeScript", "Python", "Next.js", "REST APIs", "Database Schema", "Testing", "Git & CI/CD"],
  },
  {
    name: "Cinema & Media",
    color: "#E59866",
    skills: ["Video editing", "Storyboarding", "Scriptwriting", "Sound design", "Cinematography", "Premiere Pro / Final Cut"],
  },
  {
    name: "Design & UX",
    color: "#F1948A",
    skills: ["UI/UX design", "Figma", "Slide design", "Graphic design", "Visual identity", "Prototyping"],
  },
  {
    name: "Business & Comms",
    color: "#D5B45C",
    skills: ["Presenting", "Pitch deck", "Organizing the team", "Interviewing people", "Public speaking", "Marketing"],
  },
  {
    name: "Writing & Research",
    color: "#73C6B6",
    skills: ["Research", "Writing", "Editing & proofreading", "Literature review", "Citations & formatting"],
  },
  {
    name: "Science & Lab",
    color: "#5DADE2",
    skills: ["Data analysis", "Statistics", "Lab work", "Experimental design", "Report writing"],
  },
];

/** Flat list of common skills across all categories. */
export const SKILL_SUGGESTIONS = SKILL_CATEGORIES.flatMap((c) => c.skills);

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
  const bio = typeof r.bio === "string" ? r.bio.trim().slice(0, 240) : "";
  return {
    id,
    name,
    ...(major ? { major } : {}),
    ...(bio ? { bio } : {}),
    skills: tags(r.skills),
    wantsToLearn: tags(r.wantsToLearn),
  };
}

/** Sanitizes a per-project profile (per-server profile). */
export function sanitizeProjectProfile(raw: unknown): ProjectProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const projectId = typeof r.projectId === "string" ? r.projectId.trim().slice(0, 80) : "";
  if (!projectId) return null;
  const role = typeof r.role === "string" ? r.role.trim().slice(0, 60) : "";
  const tags = (v: unknown) => normalizeTags(Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  return {
    projectId,
    ...(role ? { role } : {}),
    activeSkills: tags(r.activeSkills ?? r.skills),
    wantsToLearn: tags(r.wantsToLearn),
  };
}

/** One key per class or team, like a Discord server: the class code, else the project name. */
export function projectProfileKey(p: { course?: string; name?: string }): string {
  return (p.course?.trim() || p.name?.trim() || "project").slice(0, 80);
}

/**
 * What a person brings to one class or team (their "server profile"): their
 * saved profile for it, else the Uni skills that fit the class, else all of them.
 */
export function profileForProject(profile: Profile, projectProfile: ProjectProfile | null | undefined, courseOrName: string): Profile {
  if (projectProfile) {
    return {
      ...profile,
      ...(projectProfile.role ? { major: projectProfile.role } : {}),
      skills: projectProfile.activeSkills.length > 0 ? projectProfile.activeSkills : profile.skills,
      wantsToLearn: projectProfile.wantsToLearn.length > 0 ? projectProfile.wantsToLearn : profile.wantsToLearn,
    };
  }
  const fit = matchSkillsToCourse(courseOrName, profile.skills);
  return { ...profile, skills: fit.length > 0 ? fit : profile.skills };
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

/**
 * Resolves a Member for a specific project/course workspace.
 * If a per-project profile exists, uses the project-specific role, active skills,
 * and project learning goals so the AI plans accurately for this context.
 */
export function resolveMemberForProject(profile: Profile, projectProfile?: ProjectProfile | null): Member {
  const base = profileToMember(profile);
  if (!projectProfile) return base;
  return {
    ...base,
    role: projectProfile.role?.trim() || base.role,
    skills: projectProfile.activeSkills.length > 0 ? projectProfile.activeSkills : base.skills,
    wantsToLearn: projectProfile.wantsToLearn.length > 0 ? projectProfile.wantsToLearn : base.wantsToLearn,
  };
}

/**
 * Intelligent helper to suggest relevant skills from a student's master Uni profile
 * based on the course code or project name (e.g. CINE 211 vs CSC 648).
 */
// Whole words only: "physics" must not match "cs", "start" must not match "art".
const COURSE_AREAS: { category: string; pattern: RegExp }[] = [
  { category: "Cinema & Media", pattern: /\b(cine\w*|film\w*|media|video\w*|acting|direct\w*|animation|bect\w*)\b/ },
  { category: "CS & Tech", pattern: /\b(csc|cs|software|engineer\w*|coding|code|apps?|web|database\w*|dev\w*|tech\w*|algorithms?|computer\w*)\b/ },
  { category: "Design & UX", pattern: /\b(design\w*|ui|ux|figma|graphic\w*|visual\w*|art|arts|dai|presentation\w*)\b/ },
  { category: "Business & Comms", pattern: /\b(present\w*|speech|bus\w*|mgmt|management|econ\w*|market\w*|pitch\w*|entrepreneur\w*|fin\w*|comm\w*)\b/ },
  { category: "Writing & Research", pattern: /\b(engl?|english|lit\w*|writ\w*|essays?|humanities|history|hist|phil\w*|reports?|research)\b/ },
  { category: "Science & Lab", pattern: /\b(bio\w*|chem\w*|phys\w*|labs?|stat\w*|math\w*|data|psy\w*|neuro\w*)\b/ },
];

/**
 * Suggests which of a student's Uni-profile skills fit a class, from its code
 * or name (CINE 211 → editing, not TypeScript). A starting point the student
 * edits; it says nothing about how good anyone is.
 */
export function matchSkillsToCourse(courseOrName: string, candidateSkills: string[]): string[] {
  const text = courseOrName.toLowerCase();
  const matched = new Set<string>();

  for (const area of COURSE_AREAS) {
    if (!area.pattern.test(text)) continue;
    const skills = new Set(SKILL_CATEGORIES.find((c) => c.name === area.category)?.skills.map((s) => s.toLowerCase()) ?? []);
    for (const skill of candidateSkills) if (skills.has(skill.toLowerCase())) matched.add(skill);
  }

  // A skill named in the class title ("Python for Data Science" → Python). Whole words of 4+ letters only.
  const words = new Set(text.split(/[^a-z]+/).filter((w) => w.length >= 4));
  for (const skill of candidateSkills) {
    if (skill.toLowerCase().split(/[^a-z]+/).some((w) => w.length >= 4 && words.has(w))) matched.add(skill);
  }

  return candidateSkills.filter((s) => matched.has(s));
}

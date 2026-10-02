import { fromBase64Url, toBase64Url } from "@/features/meet/meet-link";
import { type Profile, sanitizeProfile } from "@/features/profile/profile";

/**
 * Feature Owner: Divij Anand
 * A team lives in its invite link's #fragment (never sent to a server), like
 * Quick Meet: each person joins with their profile and passes the link on.
 */

export interface Team {
  name: string;
  course?: string;
  members: Profile[];
}

export const MAX_TEAM = 8;
const VERSION = 1;

type Packed = { v: number; n: string; c?: string; m: [string, string, string, string[], string[]][] };

export function encodeTeam(team: Team): string {
  const packed: Packed = {
    v: VERSION,
    n: team.name.slice(0, 80),
    ...(team.course ? { c: team.course.slice(0, 80) } : {}),
    m: team.members.slice(0, MAX_TEAM).map((p) => [p.id, p.name, p.major ?? "", p.skills, p.wantsToLearn]),
  };
  return toBase64Url(JSON.stringify(packed));
}

/** Null for anything that isn't a valid team link; bad member entries are dropped. */
export function decodeTeam(fragment: string): Team | null {
  try {
    const raw = JSON.parse(fromBase64Url(fragment.replace(/^#/, ""))) as Partial<Packed>;
    if (raw.v !== VERSION || typeof raw.n !== "string" || !Array.isArray(raw.m)) return null;
    const seen = new Set<string>();
    const members = raw.m
      .slice(0, MAX_TEAM)
      .map((m) => (Array.isArray(m) ? sanitizeProfile({ id: m[0], name: m[1], major: m[2], skills: m[3], wantsToLearn: m[4] }) : null))
      .filter((p): p is Profile => p !== null && !seen.has(p.id) && Boolean(seen.add(p.id)));
    const course = typeof raw.c === "string" ? raw.c.slice(0, 80) : undefined;
    return { name: raw.n.slice(0, 80), ...(course ? { course } : {}), members };
  } catch {
    return null;
  }
}

/** Adds or refreshes this person's entry, keeping everyone else's order. */
export function joinTeam(team: Team, me: Profile): Team {
  const exists = team.members.some((m) => m.id === me.id);
  if (!exists && team.members.length >= MAX_TEAM) return team;
  return { ...team, members: exists ? team.members.map((m) => (m.id === me.id ? me : m)) : [...team.members, me] };
}

/** Who can do what, for the team page. Describes skills, never ranks people. */
export function skillCoverage(team: Team): { skill: string; people: string[] }[] {
  const bySkill = new Map<string, { skill: string; people: string[] }>();
  for (const member of team.members) {
    for (const skill of member.skills) {
      const key = skill.toLowerCase();
      const entry = bySkill.get(key) ?? { skill, people: [] };
      entry.people.push(member.name.split(" ")[0]!);
      bySkill.set(key, entry);
    }
  }
  return [...bySkill.values()].sort((a, b) => b.people.length - a.people.length || a.skill.localeCompare(b.skill));
}

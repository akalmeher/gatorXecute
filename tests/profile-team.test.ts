import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_TAGS,
  matchSkillsToCourse,
  normalizeTags,
  profileToMember,
  resolveMemberForProject,
  sanitizeProfile,
  sanitizeProjectProfile,
} from "@/features/profile/profile";
import { MAX_TEAM, decodeTeam, encodeTeam, joinTeam, skillCoverage } from "@/features/team/team-link";
import { demoSkills, validateSkills } from "@/features/ai/skills";

const divij = { id: "me-divij", name: "Divij Anand", major: "CS", skills: ["Backend", "Writing"], wantsToLearn: ["Figma"] };
const maya = { id: "me-maya", name: "Maya Lopez", skills: ["Writing", "Video editing"], wantsToLearn: [] };

test("tags are trimmed, de-duplicated case-insensitively and capped", () => {
  assert.deepEqual(normalizeTags(["  Writing ", "writing", "", "Video   editing"]), ["Writing", "Video editing"]);
  assert.equal(normalizeTags(Array.from({ length: 30 }, (_, i) => `Skill ${i}`)).length, MAX_TAGS);
  assert.equal(normalizeTags(["x".repeat(80)])[0].length, 30);
});

test("profiles from storage or links are cleaned; unusable ones are rejected", () => {
  assert.equal(sanitizeProfile({ id: "", name: "A" }), null);
  assert.equal(sanitizeProfile({ id: "me-1", name: "   " }), null);
  const p = sanitizeProfile({ id: "me-1<script>", name: " Sara  K ", skills: ["Writing", 4, "writing"], wantsToLearn: "nope" })!;
  assert.deepEqual(p, { id: "me-1script", name: "Sara K", skills: ["Writing"], wantsToLearn: [] });
  assert.deepEqual(profileToMember(divij), {
    id: "me-divij",
    name: "Divij Anand",
    role: "CS",
    skills: ["Backend", "Writing"],
    wantsToLearn: ["Figma"],
    initials: "DA",
  });
});

test("a team survives its link, and joining adds or refreshes one entry", () => {
  const team = { name: "Cinema presentation", course: "CINE 340", members: [divij] };
  const decoded = decodeTeam(`#${encodeTeam(team)}`)!;
  assert.deepEqual(decoded, team);
  const joined = joinTeam(decoded, maya);
  assert.deepEqual(joined.members.map((m) => m.id), ["me-divij", "me-maya"]);
  const refreshed = joinTeam(joined, { ...maya, skills: ["Presenting"] });
  assert.equal(refreshed.members.length, 2);
  assert.deepEqual(refreshed.members[1].skills, ["Presenting"]);
  assert.equal(decodeTeam("#not-a-team"), null);
});

test("a team is capped, and duplicate or broken members in a link are dropped", () => {
  const many = Array.from({ length: MAX_TEAM }, (_, i) => ({ id: `me-${i}`, name: `P ${i}`, skills: [], wantsToLearn: [] }));
  assert.equal(joinTeam({ name: "Big", members: many }, maya).members.length, MAX_TEAM);
  const packed = { v: 1, n: "T", m: [["me-a", "Ana", "", [], []], ["me-a", "Ana again", "", [], []], ["", "", "", [], []], "junk"] };
  const raw = Buffer.from(JSON.stringify(packed)).toString("base64url");
  assert.deepEqual(decodeTeam(raw)!.members.map((m) => m.name), ["Ana"]);
});

test("coverage lists who can do what without ranking anyone", () => {
  assert.deepEqual(skillCoverage({ name: "T", members: [divij, maya] }), [
    { skill: "Writing", people: ["Divij", "Maya"] },
    { skill: "Backend", people: ["Divij"] },
    { skill: "Video editing", people: ["Maya"] },
  ]);
});

test("skills from the AI are validated and normalized; the fallback only matches what was said", () => {
  assert.equal(validateSkills({ skills: "Writing", wantsToLearn: [] }).ok, false);
  assert.equal(validateSkills({ skills: ["x".repeat(40)], wantsToLearn: [] }).ok, false);
  const ok = validateSkills({ skills: ["Writing", "writing", "Video editing"], wantsToLearn: ["Figma"] });
  assert.ok(ok.ok && ok.value.skills.length === 2);
  assert.deepEqual(demoSkills("I edit videos for film class and I'm okay at writing").skills, ["Video editing", "Writing"]);
  assert.deepEqual(demoSkills("I'm a business major").skills, []);
});

test("per-project profiles (Discord server profiles) sanitize and resolve correctly", () => {
  const uni = {
    id: "me-divij",
    name: "Divij Anand",
    major: "Computer Science",
    bio: "Passionate about full-stack & video",
    skills: ["TypeScript", "Next.js", "Video editing", "Scriptwriting", "Slide design"],
    wantsToLearn: ["LLM Agents", "Cinematography"],
  };

  // When no project profile exists, resolveMemberForProject falls back to Uni profile
  const baseMember = resolveMemberForProject(uni, null);
  assert.equal(baseMember.role, "Computer Science");
  assert.deepEqual(baseMember.skills, uni.skills);
  assert.deepEqual(baseMember.wantsToLearn, uni.wantsToLearn);

  // In CINE 211 Cinema Presentation: only creative & media skills are active
  const cinemaProjectProfile = sanitizeProjectProfile({
    projectId: "proj-cine-211",
    role: "Lead Editor & Storyboarder",
    activeSkills: ["Video editing", "Scriptwriting", "Slide design"],
    wantsToLearn: ["Cinematography"],
  })!;
  assert.ok(cinemaProjectProfile);
  assert.equal(cinemaProjectProfile.role, "Lead Editor & Storyboarder");

  const cinemaMember = resolveMemberForProject(uni, cinemaProjectProfile);
  assert.equal(cinemaMember.name, "Divij Anand");
  assert.equal(cinemaMember.role, "Lead Editor & Storyboarder");
  // Tech skills like TypeScript and Next.js are filtered out for the cinema class
  assert.deepEqual(cinemaMember.skills, ["Video editing", "Scriptwriting", "Slide design"]);
  assert.deepEqual(cinemaMember.wantsToLearn, ["Cinematography"]);

  // In CSC 648 Software Engineering: only tech skills are active
  const cscProjectProfile = sanitizeProjectProfile({
    projectId: "proj-csc-648",
    role: "Backend Architect",
    activeSkills: ["TypeScript", "Next.js"],
    wantsToLearn: ["LLM Agents"],
  })!;
  const cscMember = resolveMemberForProject(uni, cscProjectProfile);
  assert.equal(cscMember.role, "Backend Architect");
  assert.deepEqual(cscMember.skills, ["TypeScript", "Next.js"]);
  assert.deepEqual(cscMember.wantsToLearn, ["LLM Agents"]);
});

test("matchSkillsToCourse intelligently matches Uni profile skills to class context", () => {
  const studentSkills = [
    "TypeScript",
    "Next.js",
    "Database Schema",
    "Video editing",
    "Scriptwriting",
    "Slide design",
    "Presenting",
    "Lab work",
    "Statistics",
  ];

  // In CINE 211
  const cineMatches = matchSkillsToCourse("CINE 211: Cinema Presentation", studentSkills);
  assert.ok(cineMatches.includes("Video editing"));
  assert.ok(cineMatches.includes("Scriptwriting"));
  assert.ok(!cineMatches.includes("Database Schema"));

  // In CSC 648
  const cscMatches = matchSkillsToCourse("CSC 648: Software Engineering", studentSkills);
  assert.ok(cscMatches.includes("TypeScript"));
  assert.ok(cscMatches.includes("Next.js"));
  assert.ok(cscMatches.includes("Database Schema"));
  assert.ok(!cscMatches.includes("Video editing"));
});

test("workspace can be encoded and decoded for multi-laptop sync", async () => {
  const { encodeWorkspace, decodeWorkspace } = await import("@/features/project/workspace-share");
  const sampleProject = {
    id: "proj-sync-test",
    name: "SFSU Hackathon Prototype",
    course: "CSC 648: Software Engineering",
    description: "Multi-laptop synchronization demo",
    deadline: "2026-10-15",
    members: [
      { id: "mem-1", name: "Ammar Almeher", role: "Integration Lead", skills: ["Next.js"], wantsToLearn: [], initials: "AA" },
      { id: "mem-2", name: "Divij Anand", role: "AI Lead", skills: ["Gemini API"], wantsToLearn: [], initials: "DA" },
    ],
    tasks: [
      { id: "t-1", projectId: "proj-sync-test", title: "Setup workspace sync", description: "Demo sync task", ownerId: "mem-2", status: "done" as const, dependencies: [] },
    ],
    meetings: [],
    availability: [],
    asyncUpdates: [],
  };

  const encoded = encodeWorkspace(sampleProject);
  assert.ok(encoded.length > 0);

  const decoded = decodeWorkspace(`#workspace=${encoded}`);
  assert.ok(decoded);
  assert.equal(decoded.name, sampleProject.name);
  assert.equal(decoded.course, sampleProject.course);
  assert.equal(decoded.members.length, 2);
  assert.equal(decoded.members[0].name, "Ammar Almeher");
  assert.equal(decoded.tasks[0].title, "Setup workspace sync");

  // Invalid payload returns null safely
  assert.equal(decodeWorkspace("#workspace=corrupted-junk-data"), null);
  assert.equal(decodeWorkspace(""), null);
});


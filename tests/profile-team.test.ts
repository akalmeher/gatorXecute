import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_TAGS, normalizeTags, profileToMember, sanitizeProfile } from "@/features/profile/profile";
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
  assert.deepEqual(demoSkills("I edit videos for film class and I'm okay at writing").skills, ["Writing", "Video editing"]);
  assert.deepEqual(demoSkills("I'm a business major").skills, []);
});

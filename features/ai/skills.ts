import { generateValidatedGeminiJson, isGeminiOffline } from "./gemini";
import { type ParseResult, asRecord, isStringArray, nonEmptyString, parseMode } from "./ai-parse";
import { MAX_TAG_CHARS, SKILL_SUGGESTIONS, normalizeTags } from "@/features/profile/profile";

/**
 * Feature Owner: Divij Anand
 * SERVER ONLY. POST /api/skills: "I'm in film, I edit videos and I'm okay at
 * writing" → skill tags and learning goals for the profile. Gemma 4 first
 * (fast tier). Only what the student said: no inferring ability from a major,
 * and no rating how good anyone is. The student edits the tags before saving.
 */

export interface SkillsResult {
  skills: string[];
  wantsToLearn: string[];
}

export type SkillsResponse =
  | { ok: true; source: "gemini" | "demo"; model?: string; result: SkillsResult }
  | { ok: false; error: string; message: string; issues?: string[] };

const MAX_TEXT_CHARS = 600;

export function parseSkillsRequest(body: unknown): ParseResult<{ mode: "live" | "demo"; text: string }> {
  const issues: string[] = [];
  const b = asRecord(body);
  const mode = parseMode(b.mode, issues);
  if (!nonEmptyString(b.text)) issues.push("Say a little about what you can do.");
  else if (b.text.length > MAX_TEXT_CHARS) issues.push(`Keep it under ${MAX_TEXT_CHARS} characters.`);
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: { mode, text: (b.text as string).trim() } };
}

export function validateSkills(raw: unknown): ParseResult<SkillsResult> {
  const r = asRecord(raw);
  const issues: string[] = [];
  if (!isStringArray(r.skills)) issues.push("skills must be a list of short strings.");
  if (!isStringArray(r.wantsToLearn)) issues.push("wantsToLearn must be a list of short strings.");
  if (issues.length > 0) return { ok: false, issues };
  const long = [...(r.skills as string[]), ...(r.wantsToLearn as string[])].filter((t) => t.length > MAX_TAG_CHARS);
  if (long.length > 0) issues.push(`Keep each tag under ${MAX_TAG_CHARS} characters: ${long.join(", ")}`);
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: { skills: normalizeTags(r.skills as string[]), wantsToLearn: normalizeTags(r.wantsToLearn as string[]) } };
}

/** Code-only fallback: picks suggested skills the student mentioned by name. */
export function demoSkills(text: string): SkillsResult {
  const lower = text.toLowerCase();
  const words: Record<string, string[]> = {
    Writing: ["writ", "essay"],
    Research: ["research", "sources"],
    Presenting: ["present", "public speaking"],
    "Slide design": ["slide", "deck", "powerpoint"],
    "Editing & proofreading": ["proofread", "edit text", "grammar"],
    "Data analysis": ["data", "excel", "spreadsheet"],
    Statistics: ["stat"],
    "Video editing": ["video", "film", "premiere"],
    "UI/UX design": ["design", "figma", "ui"],
    Frontend: ["frontend", "react", "html", "css"],
    Backend: ["backend", "api", "database", "server"],
    "Lab work": ["lab"],
    "Organizing the team": ["organiz", "schedul", "lead"],
    "Interviewing people": ["interview", "survey"],
  };
  const skills = SKILL_SUGGESTIONS.filter((s) => (words[s] ?? []).some((w) => lower.includes(w)));
  return { skills, wantsToLearn: [] };
}

const SYSTEM_INSTRUCTION = `A university student is describing, in their own words, what they can do and what they'd like to learn, so their group can split project work fairly.

- skills: short tags (1–3 words, Title case) for things they say they can do or have done, e.g. "Video editing", "Writing", "Python". Include modest claims ("okay at writing" → "Writing").
- wantsToLearn: short tags for things they say they want to learn or get better at.
- Only what they actually said. Never infer abilities from their major, year or background, never add levels or ratings, and never judge.
- Prefer these familiar tags when they fit: ${SKILL_SUGGESTIONS.join(", ")}.
- At most 8 of each. Empty lists if they said nothing relevant.`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    skills: { type: "ARRAY", items: { type: "STRING" } },
    wantsToLearn: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["skills", "wantsToLearn"],
  propertyOrdering: ["skills", "wantsToLearn"],
};

export async function readSkills(body: unknown): Promise<{ status: number; body: SkillsResponse }> {
  const parsed = parseSkillsRequest(body);
  if (!parsed.ok) {
    return { status: 400, body: { ok: false, error: "bad_request", message: parsed.issues[0], issues: parsed.issues } };
  }
  const { mode, text } = parsed.value;
  if (mode === "demo" || isGeminiOffline()) {
    return { status: 200, body: { ok: true, source: "demo", result: demoSkills(text) } };
  }
  const result = await generateValidatedGeminiJson<SkillsResult>({
    systemInstruction: SYSTEM_INSTRUCTION,
    buildPrompt: (issues) =>
      [
        `Student wrote:\n"""${text}"""`,
        issues.length > 0 ? `Your previous answer was rejected. Fix:\n- ${issues.join("\n- ")}` : "",
        "Return JSON matching the response schema.",
      ]
        .filter(Boolean)
        .join("\n\n"),
    responseSchema: RESPONSE_SCHEMA,
    validate: validateSkills,
    temperature: 0.2,
    cacheable: true,
    tier: "fast",
  });
  if (result.ok) return { status: 200, body: { ok: true, source: "gemini", model: result.model, result: result.value } };
  // Never a dead end: fall back to simple matching, labeled as not AI.
  return { status: 200, body: { ok: true, source: "demo", result: demoSkills(text) } };
}

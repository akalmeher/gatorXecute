import type { CoordinateIntent, CoordinateResponse, CoordinateResult } from "./coordinate-types";
import { generateValidatedGeminiJson, isGeminiOffline } from "./gemini";
import { type ParseResult, asRecord, isStringArray, nonEmptyString, parseMode } from "./ai-parse";

/**
 * Feature Owner: Divij Anand
 * SERVER ONLY. POST /api/coordinate: infer the workflow from intent, so students
 * never have to pick a feature. The result only routes; it never changes data.
 */

const INTENTS: CoordinateIntent[] = ["meet", "project", "update", "help", "unclear"];
const DURATIONS = [30, 45, 60, 90, 120];
const MAX_TEXT_CHARS = 500;

type Parsed = { mode: "live" | "demo"; text: string; knownPeople: string[] };

export function parseCoordinateRequest(body: unknown): ParseResult<Parsed> {
  const issues: string[] = [];
  const b = asRecord(body);
  const mode = parseMode(b.mode, issues);
  if (!nonEmptyString(b.text)) issues.push("Say what needs coordinating.");
  else if (b.text.length > MAX_TEXT_CHARS) issues.push(`Keep it under ${MAX_TEXT_CHARS} characters.`);
  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    value: {
      mode,
      text: (b.text as string).trim(),
      knownPeople: isStringArray(b.knownPeople) ? b.knownPeople.slice(0, 20).map((p) => p.slice(0, 60)) : [],
    },
  };
}

export function validateCoordinate(raw: unknown): ParseResult<CoordinateResult> {
  const issues: string[] = [];
  const r = asRecord(raw);
  if (!INTENTS.includes(r.intent as CoordinateIntent)) issues.push(`intent must be one of ${INTENTS.join(", ")}.`);
  if (typeof r.title !== "string") issues.push("title must be a string (empty if none).");
  if (!nonEmptyString(r.reply)) issues.push("reply is required.");
  if (r.people !== undefined && !isStringArray(r.people)) issues.push("people must be a list of names.");
  if (issues.length > 0) return { ok: false, issues };
  const minutes = typeof r.durationMinutes === "number" ? r.durationMinutes : 0;
  return {
    ok: true,
    value: {
      intent: r.intent as CoordinateIntent,
      title: (r.title as string).trim().slice(0, 80),
      // Snap to a length Quick Meet offers; default an hour when meeting.
      durationMinutes:
        r.intent === "meet" ? DURATIONS.reduce((best, d) => (Math.abs(d - minutes) < Math.abs(best - minutes) ? d : best), 60) : 0,
      people: isStringArray(r.people) ? r.people.map((p) => p.trim()).filter(Boolean).slice(0, 10) : [],
      reply: (r.reply as string).trim().slice(0, 160),
    },
  };
}

const SYSTEM_INSTRUCTION = `A university student typed one line into a coordination app. Decide what they want so the app can take them to the right place. You only classify; you never take actions.

intent:
- "meet": find a time to meet or study together ("find an hour with Maya", "study for calc with Alex Thursday", "when can the four of us eat").
- "project": start organizing a group assignment or project ("CSC 648 app due Oct 16", "we're making a short film for CINE 211").
- "update": report progress or being stuck on their own work ("finished the backend", "waiting on Ammar's UI").
- "help": the team is behind, someone is unavailable, or plans need rearranging ("we're behind and it's due Friday", "Maya is sick this week").
- "unclear": none of the above.

title: a short name for the thing ("Cinema presentation", "Calc midterm study"), or "" if none.
durationMinutes: for "meet", the length they asked for, else 60; for other intents, 0.
people: names they mentioned.
reply: one short, friendly line saying what happens next, e.g. "Let's find a time with Maya." or "Let's add that to your plan." Nothing has happened yet: never claim you shared, saved, sent or changed anything. Plain words, no jargon.`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    intent: { type: "STRING", enum: INTENTS },
    title: { type: "STRING" },
    durationMinutes: { type: "INTEGER" },
    people: { type: "ARRAY", items: { type: "STRING" } },
    reply: { type: "STRING" },
  },
  required: ["intent", "title", "durationMinutes", "people", "reply"],
  propertyOrdering: ["intent", "title", "durationMinutes", "people", "reply"],
};

/** Labeled non-AI fallback: simple keyword routing. */
export function buildDemoCoordinate({ text }: Parsed): CoordinateResult {
  const t = text.toLowerCase();
  const intent: CoordinateIntent = /\b(behind|sick|can't make|cannot make|help|late|rearrange)\b/.test(t)
    ? "help"
    : /\b(finished|done|stuck|waiting on|started)\b/.test(t)
      ? "update"
      : /\b(meet|time|when|free|study|hang|call|eat)\b/.test(t)
        ? "meet"
        : /\b(project|assignment|due|presentation|paper|film|report)\b/.test(t)
          ? "project"
          : "unclear";
  return { intent, title: "", durationMinutes: intent === "meet" ? 60 : 0, people: [], reply: "Matched by keywords (demo mode, not Gemini)." };
}

export async function coordinate(body: unknown): Promise<{ status: number; body: CoordinateResponse }> {
  const parsed = parseCoordinateRequest(body);
  if (!parsed.ok) {
    return { status: 400, body: { ok: false, error: "bad_request", message: parsed.issues[0], issues: parsed.issues } };
  }
  const request = parsed.value;
  if (request.mode === "demo" || isGeminiOffline()) {
    return { status: 200, body: { ok: true, source: "demo", result: buildDemoCoordinate(request) } };
  }

  const result = await generateValidatedGeminiJson<CoordinateResult>({
    systemInstruction: SYSTEM_INSTRUCTION,
    buildPrompt: (issues) =>
      [
        `Teammates the app knows: ${request.knownPeople.join(", ") || "(none)"}`,
        `What the student typed:\n"""${request.text}"""`,
        issues.length > 0 ? `Your previous answer was rejected. Fix:\n- ${issues.join("\n- ")}` : "",
        "Return JSON matching the response schema.",
      ]
        .filter(Boolean)
        .join("\n\n"),
    responseSchema: RESPONSE_SCHEMA,
    validate: validateCoordinate,
    temperature: 0.1,
    cacheable: true,
  });

  if (result.ok) return { status: 200, body: { ok: true, source: "gemini", model: result.model, result: result.value } };
  return {
    status: result.error === "missing_key" ? 503 : 502,
    body: { ok: false, error: result.error, message: "I couldn't read that one. Try rephrasing.", issues: result.issues },
  };
}

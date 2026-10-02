import type { ShareCheck, ShareCheckResponse, Wellbeing } from "./share-check-types";
import { generateValidatedGeminiJson, isGeminiOffline } from "./gemini";
import { type ParseResult, asRecord, nonEmptyString, parseMode } from "./ai-parse";
import { discreetNote, mentionsCrisis, mentionsPersonal, personalDetailsIn } from "./care";
import { addDays, isIsoDay, todayIsoDay } from "@/features/plan/plan-validation";

/**
 * Feature Owner: Divij Anand
 * SERVER ONLY. POST /api/share-check. Runs on Gemma 4 (fast tier) with Gemini
 * fallback. Code-enforced on top of the model:
 * - crisis language always yields wellbeing "crisis" (support is shown first);
 * - personal details always mark the message personal, and the shareable
 *   version may never contain them (falls back to a discreet template);
 * - away dates must be real, ordered and within the next 60 days.
 */

const MAX_TEXT_CHARS = 1000;
const WELLBEING: Wellbeing[] = ["none", "low", "crisis"];

type Parsed = { mode: "live" | "demo"; text: string; authorName: string };

export function parseShareCheckRequest(body: unknown): ParseResult<Parsed> {
  const issues: string[] = [];
  const b = asRecord(body);
  const mode = parseMode(b.mode, issues);
  if (!nonEmptyString(b.text)) issues.push("text is required.");
  else if (b.text.length > MAX_TEXT_CHARS) issues.push(`Keep it under ${MAX_TEXT_CHARS} characters.`);
  if (!nonEmptyString(b.authorName)) issues.push("authorName is required.");
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: { mode, text: (b.text as string).trim(), authorName: (b.authorName as string).trim().slice(0, 60) } };
}

/** Applies the code-enforced rules to whatever the model (or the fallback) produced. */
export function finalizeShareCheck(draft: ShareCheck, request: Parsed, today = todayIsoDay()): ShareCheck {
  const personal = draft.personal || mentionsPersonal(request.text);
  const wellbeing: Wellbeing = mentionsCrisis(request.text) ? "crisis" : draft.wellbeing;
  let awayFrom = draft.awayFrom && isIsoDay(draft.awayFrom) ? draft.awayFrom : undefined;
  let awayTo = draft.awayTo && isIsoDay(draft.awayTo) ? draft.awayTo : awayFrom;
  // A range already underway ("Thursday to Friday", said on Friday) starts today.
  if (awayFrom && awayTo && awayFrom < today && awayTo >= today) awayFrom = today;
  if (awayFrom && (awayFrom < today || awayFrom > addDays(today, 60) || !awayTo || awayTo < awayFrom)) {
    awayFrom = undefined;
    awayTo = undefined;
  }
  const leaks = personalDetailsIn(draft.shareable);
  // In a crisis, teammates only ever see the neutral template.
  const shareable = !personal
    ? request.text
    : wellbeing !== "crisis" && draft.shareable.trim() && leaks.length === 0 && draft.shareable.length <= 160
      ? draft.shareable.trim()
      : discreetNote(request.authorName, awayFrom, awayTo);
  return {
    personal,
    shareable,
    awayFrom,
    awayTo: awayFrom ? awayTo : undefined,
    wellbeing: personal && wellbeing === "none" ? "low" : wellbeing,
    acknowledgement: personal ? draft.acknowledgement.trim().slice(0, 160) || "I'm sorry you're going through this." : "",
  };
}

function validateDraft(raw: unknown): ParseResult<ShareCheck> {
  const r = asRecord(raw);
  const issues: string[] = [];
  if (typeof r.personal !== "boolean") issues.push("personal must be true or false.");
  if (typeof r.shareable !== "string") issues.push("shareable must be a string.");
  else if (personalDetailsIn(r.shareable).length > 0) {
    issues.push(`shareable must not mention personal details (${personalDetailsIn(r.shareable).join(", ")}); describe only the effect on the work.`);
  }
  if (!WELLBEING.includes(r.wellbeing as Wellbeing)) issues.push(`wellbeing must be one of ${WELLBEING.join(", ")}.`);
  for (const field of ["awayFrom", "awayTo"] as const) {
    if (r[field] && !isIsoDay(r[field])) issues.push(`${field} must be YYYY-MM-DD or "".`);
  }
  if (typeof r.acknowledgement !== "string") issues.push("acknowledgement must be a string.");
  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    value: {
      personal: r.personal as boolean,
      shareable: r.shareable as string,
      awayFrom: (r.awayFrom as string) || undefined,
      awayTo: (r.awayTo as string) || undefined,
      wellbeing: r.wellbeing as Wellbeing,
      acknowledgement: r.acknowledgement as string,
    },
  };
}

const SYSTEM_INSTRUCTION = `A university student wrote a message in a group-project app. Before anything is shared with their teammates, decide how to handle it with care.

- personal: true if it mentions health, family, grief, money or other private matters.
- shareable: one short sentence for teammates describing only the effect on the work, starting with the student's first name, e.g. "Divij is away Thursday–Friday for a personal matter." Keep any work progress, blockers or questions they mention (e.g. "Divij finished the API route stubs and is away Thursday–Friday."). Never include the reason, health or family details, or feelings. If nothing is personal, return the message's gist.
- awayFrom / awayTo: inclusive dates (YYYY-MM-DD) they can't work, resolved from today's date, or "" if they didn't say.
- wellbeing: "crisis" if there is any sign of risk of self-harm; "low" if they sound sad, stressed or grieving; otherwise "none".
- acknowledgement: if personal, one warm, plain sentence to the student (no advice, no clichés, no questions), e.g. "I'm so sorry about your mom. Take the time you need." Otherwise "".`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    personal: { type: "BOOLEAN" },
    shareable: { type: "STRING" },
    awayFrom: { type: "STRING" },
    awayTo: { type: "STRING" },
    wellbeing: { type: "STRING", enum: WELLBEING },
    acknowledgement: { type: "STRING" },
  },
  required: ["personal", "shareable", "awayFrom", "awayTo", "wellbeing", "acknowledgement"],
  propertyOrdering: ["personal", "shareable", "awayFrom", "awayTo", "wellbeing", "acknowledgement"],
};

function demoDraft(request: Parsed): ShareCheck {
  return {
    personal: mentionsPersonal(request.text),
    shareable: discreetNote(request.authorName),
    wellbeing: "none",
    acknowledgement: "I'm sorry you're going through this.",
  };
}

export async function shareCheck(body: unknown): Promise<{ status: number; body: ShareCheckResponse }> {
  const parsed = parseShareCheckRequest(body);
  if (!parsed.ok) {
    return { status: 400, body: { ok: false, error: "bad_request", message: parsed.issues[0], issues: parsed.issues } };
  }
  const request = parsed.value;
  if (request.mode === "demo" || isGeminiOffline()) {
    return { status: 200, body: { ok: true, source: "demo", check: finalizeShareCheck(demoDraft(request), request) } };
  }

  const today = todayIsoDay();
  const weekday = new Date(`${today}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
  const result = await generateValidatedGeminiJson<ShareCheck>({
    systemInstruction: SYSTEM_INSTRUCTION,
    buildPrompt: (issues) =>
      [
        `Today: ${today} (${weekday})`,
        `Student: ${request.authorName}`,
        `Message:\n"""${request.text}"""`,
        issues.length > 0 ? `Your previous answer was rejected. Fix:\n- ${issues.join("\n- ")}` : "",
        "Return JSON matching the response schema.",
      ]
        .filter(Boolean)
        .join("\n\n"),
    responseSchema: RESPONSE_SCHEMA,
    validate: validateDraft,
    temperature: 0.2,
    cacheable: true,
    tier: "fast",
  });

  if (result.ok) {
    return { status: 200, body: { ok: true, source: "gemini", model: result.model, check: finalizeShareCheck(result.value, request, today) } };
  }
  // Even if the AI is unavailable, care rules still apply: return the safe fallback.
  if (result.error !== "missing_key") {
    console.warn(`[share-check] AI unavailable (${result.error}); using the code-only fallback`);
  }
  return {
    status: 200,
    body: { ok: true, source: "demo", check: finalizeShareCheck(demoDraft(request), request, today) },
  };
}


import type { AvailabilityBlock } from "@/types";
import type {
  AvailabilityGrid,
  AvailabilityLevel,
  AvailabilityResponse,
  AvailabilityResult,
  AvailabilityRule,
  DayOfWeek,
} from "./availability-types";
import { DEFAULT_GRID } from "./availability-types";
import { generateValidatedGeminiJson, isGeminiOffline } from "./gemini";
import { type ParseResult, asRecord, isStringArray, nonEmptyString, parseMode } from "./ai-parse";
import { ALL_DAYS, applyRules, blocksFromCells, cellsFromBlocks, describeBlocks, parseClock } from "./availability-compile";

/**
 * Feature Owner: Divij Anand
 * SERVER ONLY. POST /api/availability: plain words -> availability blocks.
 * Gemini reads the words into rules; availability-compile.ts does the time math.
 */

const MAX_TEXT_CHARS = 2000;
const MAX_RULES = 40;
const LEVELS: AvailabilityLevel[] = ["preferred", "available", "if-needed"];

type ParsedAvailabilityRequest = {
  mode: "live" | "demo";
  memberId: string;
  text: string;
  current: AvailabilityBlock[];
  grid: AvailabilityGrid;
};

export function parseAvailabilityRequest(body: unknown): ParseResult<ParsedAvailabilityRequest> {
  const issues: string[] = [];
  const b = asRecord(body);
  const mode = parseMode(b.mode, issues);
  if (!nonEmptyString(b.memberId)) issues.push("memberId is required.");
  if (!nonEmptyString(b.text)) issues.push("Tell us when you're free, e.g. \"after 4 except Wednesdays\".");
  else if (b.text.length > MAX_TEXT_CHARS) issues.push(`Keep it under ${MAX_TEXT_CHARS} characters.`);

  const g = asRecord(b.grid);
  const grid: AvailabilityGrid = {
    days: isStringArray(g.days) && g.days.every((d) => ALL_DAYS.includes(d as DayOfWeek)) && g.days.length > 0
      ? (g.days as DayOfWeek[])
      : DEFAULT_GRID.days,
    startHour: typeof g.startHour === "number" ? g.startHour : DEFAULT_GRID.startHour,
    endHour: typeof g.endHour === "number" ? g.endHour : DEFAULT_GRID.endHour,
    slotMinutes: typeof g.slotMinutes === "number" ? g.slotMinutes : DEFAULT_GRID.slotMinutes,
  };
  if (!(Number.isInteger(grid.startHour) && Number.isInteger(grid.endHour) && grid.startHour >= 0 && grid.endHour <= 24 && grid.startHour < grid.endHour)) {
    issues.push("grid hours must be whole hours with startHour < endHour within 0–24.");
  }
  if (![15, 30, 60].includes(grid.slotMinutes)) issues.push("grid.slotMinutes must be 15, 30 or 60.");

  const current: AvailabilityBlock[] = Array.isArray(b.current)
    ? b.current.flatMap((raw) => {
        const c = asRecord(raw);
        const ok = ALL_DAYS.includes(c.dayOfWeek as DayOfWeek)
          && typeof c.startTime === "string" && parseClock(c.startTime) !== undefined
          && typeof c.endTime === "string" && parseClock(c.endTime) !== undefined;
        return ok ? [c as unknown as AvailabilityBlock] : [];
      })
    : [];

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: { mode, memberId: b.memberId as string, text: (b.text as string).trim(), current, grid } };
}

interface ParsedAiOutput {
  baseline: "replace" | "edit";
  summary: string;
  rules: AvailabilityRule[];
  questions: string[];
}

export function validateAvailabilityOutput(raw: unknown): ParseResult<ParsedAiOutput> {
  const issues: string[] = [];
  const r = asRecord(raw);
  if (r.baseline !== "replace" && r.baseline !== "edit") issues.push('baseline must be "replace" or "edit".');
  if (!nonEmptyString(r.summary)) issues.push("summary is required.");

  const rules: AvailabilityRule[] = [];
  if (!Array.isArray(r.rules) || r.rules.length > MAX_RULES) {
    issues.push(`rules must be a list of at most ${MAX_RULES} items.`);
  } else {
    r.rules.forEach((rawRule, index) => {
      const rule = asRecord(rawRule);
      const label = `rules[${index}]`;
      if (rule.effect !== "available" && rule.effect !== "unavailable") issues.push(`${label}.effect must be available or unavailable.`);
      if (!isStringArray(rule.days) || rule.days.length === 0 || !rule.days.every((d) => ALL_DAYS.includes(d as DayOfWeek))) {
        issues.push(`${label}.days must list days as ${ALL_DAYS.join(", ")}.`);
      }
      const start = typeof rule.start === "string" ? parseClock(rule.start) : undefined;
      const end = typeof rule.end === "string" ? parseClock(rule.end) : undefined;
      if (start === undefined || end === undefined) issues.push(`${label} needs start and end as 24-hour HH:MM.`);
      else if (start >= end) issues.push(`${label} must end after it starts (overnight ranges should be split).`);
      const level = nonEmptyString(rule.level) ? rule.level : undefined;
      if (level && !LEVELS.includes(level as AvailabilityLevel)) issues.push(`${label}.level must be one of ${LEVELS.join(", ")}.`);
      rules.push({
        effect: rule.effect as AvailabilityRule["effect"],
        level: rule.effect === "available" && level ? (level as AvailabilityLevel) : undefined,
        days: [...new Set((rule.days as DayOfWeek[]) ?? [])],
        start: rule.start as string,
        end: rule.end as string,
        label: nonEmptyString(rule.label) ? rule.label.trim().slice(0, 80) : undefined,
      });
    });
  }
  const questions = isStringArray(r.questions) ? r.questions.map((q) => q.trim()).filter(Boolean).slice(0, 3) : [];

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: { baseline: r.baseline as "replace" | "edit", summary: (r.summary as string).trim(), rules, questions } };
}

function systemInstruction(grid: AvailabilityGrid): string {
  return `You turn a university student's description of when they're free into weekly availability rules for a scheduling grid.
The grid covers ${grid.days.join(", ")} from ${String(grid.startHour).padStart(2, "0")}:00 to ${String(grid.endHour).padStart(2, "0")}:00, local time, as a repeating week.

Rules are applied in order; later rules override earlier ones.
- effect "available" marks free time; "unavailable" removes it. Use 24-hour "HH:MM" for start and end; end must be after start.
- days use Mon, Tue, Wed, Thu, Fri, Sat, Sun. Course schedules often use M T W R F (R = Thursday), MWF, TR or TTh.
- Plain time words: "morning" 09:00–12:00, "afternoon" 12:00–17:00, "evening" 17:00–21:00, "after 4" means 16:00 until the end of the grid, "anytime" means the whole grid day.
- "except Wednesdays" leaves Wednesday out. "Don't schedule me Friday evenings" is unavailable Fri 17:00–21:00.
- level (only for available): "preferred" for words like prefer/ideally/best; "if-needed" for if we have to/only if necessary/worst case; otherwise "available".
- A pasted class schedule lists BUSY times: add one unavailable rule per class with label set to the course code. If the student gives no free times at all, start with one rule making the whole grid available, then the class rules.
- baseline: "edit" if they describe a change to their existing availability ("Thursdays don't work anymore", "add Friday morning"); otherwise "replace".
- Don't invent times. If something is vague (e.g. "late"), pick the cautious reading and ask about it in questions (at most 3, short).
- summary: one plain sentence describing what you understood, with 12-hour times like "4 PM" (never 24-hour times).`;
}

function buildPrompt(request: ParsedAvailabilityRequest, previousIssues: string[]): string {
  const currentReadBack = request.current.length > 0
    ? describeBlocks(blocksFromCells(cellsFromBlocks(request.current, request.grid), request.memberId, request.grid), request.grid).join("\n")
    : "(nothing yet)";
  const lines = [
    `Current availability:\n${currentReadBack}`,
    `What the student wrote:\n"""${request.text}"""`,
  ];
  if (previousIssues.length > 0) lines.push(`Your previous answer was rejected. Fix every issue:\n- ${previousIssues.join("\n- ")}`);
  lines.push("Return JSON matching the response schema.");
  return lines.join("\n\n");
}

const RULE_FIELDS = ["effect", "level", "days", "start", "end", "label"];
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    baseline: { type: "STRING", enum: ["replace", "edit"] },
    summary: { type: "STRING" },
    rules: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          effect: { type: "STRING", enum: ["available", "unavailable"] },
          level: { type: "STRING", enum: LEVELS },
          days: { type: "ARRAY", items: { type: "STRING", enum: ALL_DAYS } },
          start: { type: "STRING" },
          end: { type: "STRING" },
          label: { type: "STRING" },
        },
        required: ["effect", "days", "start", "end"],
        propertyOrdering: RULE_FIELDS,
      },
    },
    questions: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["baseline", "summary", "rules", "questions"],
  propertyOrdering: ["baseline", "summary", "rules", "questions"],
};

function compile(request: ParsedAvailabilityRequest, output: ParsedAiOutput): AvailabilityResult {
  const start = output.baseline === "edit" ? cellsFromBlocks(request.current, request.grid) : new Map();
  const { cells, notes } = applyRules(start, output.rules, request.grid);
  const blocks = blocksFromCells(cells, request.memberId, request.grid);
  if (blocks.length === 0) notes.push("This leaves no free time on the grid. Double-check before saving.");
  return {
    memberId: request.memberId,
    blocks,
    summary: output.summary,
    readBack: describeBlocks(blocks, request.grid),
    notes: [...notes, ...output.questions],
    rules: output.rules,
  };
}

export async function generateAvailability(body: unknown): Promise<{ status: number; body: AvailabilityResponse }> {
  const parsed = parseAvailabilityRequest(body);
  if (!parsed.ok) {
    return { status: 400, body: { ok: false, error: "bad_request", message: "Invalid availability request.", issues: parsed.issues } };
  }
  const request = parsed.value;

  if (request.mode === "demo" || isGeminiOffline()) {
    const blocks = blocksFromCells(cellsFromBlocks(request.current, request.grid), request.memberId, request.grid);
    return {
      status: 200,
      body: {
        ok: true,
        source: "demo",
        result: {
          memberId: request.memberId,
          blocks,
          summary: "Demo mode can't read sentences, so nothing changed.",
          readBack: describeBlocks(blocks, request.grid),
          notes: ["Paint the grid directly instead."],
          rules: [],
        },
      },
    };
  }

  const result = await generateValidatedGeminiJson<ParsedAiOutput>({
    systemInstruction: systemInstruction(request.grid),
    buildPrompt: (issues) => buildPrompt(request, issues),
    responseSchema: RESPONSE_SCHEMA,
    validate: validateAvailabilityOutput,
    cacheable: true,
    temperature: 0.1,
  });

  if (result.ok) {
    return { status: 200, body: { ok: true, source: "gemini", model: result.model, result: compile(request, result.value) } };
  }
  return {
    status: result.error === "missing_key" ? 503 : 502,
    body: { ok: false, error: result.error, message: result.error === "missing_key" ? result.message : "I couldn't read that. Try rephrasing, or paint the grid directly.", issues: result.issues },
  };
}

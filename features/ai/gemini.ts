/**
 * Feature Owner: Divij Anand
 * Minimal server-side Gemini client over the REST API (no SDK dependency).
 *
 * SERVER ONLY: import this from route handlers, never from client components.
 *
 * Environment (.env.local, git-ignored):
 *   GEMINI_API_KEY  required for live generation (Google AI Studio key)
 *   GEMINI_MODEL    optional, defaults to DEFAULT_GEMINI_MODEL
 */

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
export const DEFAULT_GEMINI_MODEL = "gemini-flash-latest";
const REQUEST_TIMEOUT_MS = 30_000;

export type GeminiErrorCode = "missing_key" | "request_failed" | "empty_response" | "invalid_json";

export class GeminiError extends Error {
  constructor(
    public readonly code: GeminiErrorCode,
    message: string
  ) {
    super(message);
    this.name = "GeminiError";
  }
}

export function hasGeminiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

interface GenerateJsonOptions {
  systemInstruction: string;
  prompt: string;
  /** Gemini responseSchema (OpenAPI subset) describing the expected JSON. */
  responseSchema: Record<string, unknown>;
  temperature?: number;
}

interface GeminiResponseBody {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
}

/**
 * Calls Gemini in JSON mode and returns the parsed (still unvalidated) value.
 * Callers must validate the result before using it.
 */
export async function generateGeminiJson({
  systemInstruction,
  prompt,
  responseSchema,
  temperature = 0.4,
}: GenerateJsonOptions): Promise<{ data: unknown; model: string }> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new GeminiError("missing_key", "GEMINI_API_KEY is not set on the server.");
  }

  const model = getGeminiModel();
  let response: Response;
  try {
    response = await fetch(`${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature,
          responseMimeType: "application/json",
          responseSchema,
        },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    const reason = error instanceof Error && error.name === "TimeoutError" ? "timed out" : "could not be reached";
    throw new GeminiError("request_failed", `Gemini ${reason}.`);
  }

  if (!response.ok) {
    // Log details server-side only; never echo the key or raw upstream body to the client.
    const detail = await response.text().catch(() => "");
    console.error(`[gemini] ${model} returned ${response.status}: ${detail.slice(0, 500)}`);
    throw new GeminiError("request_failed", `Gemini returned HTTP ${response.status}.`);
  }

  const body = (await response.json()) as GeminiResponseBody;
  const candidate = body.candidates?.[0];
  const text = candidate?.content?.parts
    ?.filter((part) => !part.thought && typeof part.text === "string")
    .map((part) => part.text)
    .join("")
    .trim();

  if (!text) {
    const reason = body.promptFeedback?.blockReason ?? candidate?.finishReason ?? "no content";
    throw new GeminiError("empty_response", `Gemini returned no usable text (${reason}).`);
  }

  try {
    return { data: JSON.parse(text), model };
  } catch {
    throw new GeminiError("invalid_json", "Gemini returned text that is not valid JSON.");
  }
}

export type AiErrorCode = "bad_request" | "missing_key" | "gemini_request_failed" | "gemini_invalid_output";

export type GeminiValidationOutcome<T> =
  | { ok: true; value: T; model: string }
  | { ok: false; error: Exclude<AiErrorCode, "bad_request">; message: string; issues?: string[] };

/**
 * Calls Gemini and validates the result, retrying once with the validation
 * issues fed back into the prompt. Never returns unvalidated output.
 */
export async function generateValidatedGeminiJson<T>({
  systemInstruction,
  buildPrompt,
  responseSchema,
  validate,
  temperature,
  maxAttempts = 2,
}: {
  systemInstruction: string;
  buildPrompt: (previousIssues: string[]) => string;
  responseSchema: Record<string, unknown>;
  validate: (data: unknown) => { ok: true; value: T } | { ok: false; issues: string[] };
  temperature?: number;
  maxAttempts?: number;
}): Promise<GeminiValidationOutcome<T>> {
  if (!hasGeminiKey()) {
    return { ok: false, error: "missing_key", message: "Gemini is not configured on the server." };
  }

  let issues: string[] = [];
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { data, model } = await generateGeminiJson({
        systemInstruction,
        prompt: buildPrompt(issues),
        responseSchema,
        temperature,
      });
      const result = validate(data);
      if (result.ok) return { ok: true, value: result.value, model };
      issues = result.issues;
    } catch (error) {
      if (error instanceof GeminiError && (error.code === "invalid_json" || error.code === "empty_response")) {
        issues = [error.message];
        continue;
      }
      if (!(error instanceof GeminiError)) console.error("[gemini] unexpected error", error);
      const message = error instanceof GeminiError ? error.message : "Unexpected error while calling Gemini.";
      return { ok: false, error: "gemini_request_failed", message };
    }
  }

  return { ok: false, error: "gemini_invalid_output", message: "Gemini's response did not pass validation.", issues };
}

/** Shared POST handler: parses the JSON body and returns the service's status and body. */
export async function handleJsonPost(
  request: Request,
  service: (body: unknown) => Promise<{ status: number; body: unknown }>
): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "bad_request", message: "Request body must be valid JSON." },
      { status: 400 }
    );
  }
  const result = await service(body);
  return Response.json(result.body, { status: result.status });
}

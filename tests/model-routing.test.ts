import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { failureMessage, generateValidatedGeminiJson, modelsForTier } from "@/features/ai/gemini";

// Fake network: records which model each call went to and what it was sent.
type Reply = { status: number; json?: unknown };
let calls: { model: string; body: Record<string, unknown> }[] = [];
function fakeFetch(replies: Record<string, Reply[]>) {
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const model = decodeURIComponent(String(url).split("/models/")[1].split(":")[0]);
    calls.push({ model, body: JSON.parse(String(init?.body)) });
    const reply = replies[model]?.shift() ?? { status: 500 };
    const text = JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(reply.json ?? {}) }] } }] });
    return new Response(reply.status === 200 ? text : "error", { status: reply.status });
  }) as typeof fetch;
}

const ask = (tier: "fast" | "reasoning") =>
  generateValidatedGeminiJson<{ intent: string }>({
    systemInstruction: "sys",
    buildPrompt: () => "prompt",
    responseSchema: {},
    validate: (data) => {
      const d = data as { intent?: unknown };
      return d.intent === "meet" ? { ok: true, value: { intent: "meet" } } : { ok: false, issues: ["intent must be meet"] };
    },
    tier,
  });

beforeEach(() => {
  calls = [];
  process.env.GEMINI_API_KEY = "test-key-not-real";
  delete process.env.GEMMA_MODEL;
  delete process.env.AI_FORCE_MODEL;
  delete process.env.GEMINI_MODEL;
});

test("fast tasks go to Gemma 4 first, reasoning tasks only to Gemini", () => {
  assert.deepEqual(modelsForTier("fast"), ["gemma-4-26b-a4b-it", "gemini-flash-latest"]);
  assert.deepEqual(modelsForTier("reasoning"), ["gemini-flash-latest"]);
  process.env.GEMMA_MODEL = "off";
  assert.deepEqual(modelsForTier("fast"), ["gemini-flash-latest"]);
});

test("Gemma answers when it can, and never receives thinkingLevel", async () => {
  fakeFetch({ "gemma-4-26b-a4b-it": [{ status: 200, json: { intent: "meet" } }] });
  const result = await ask("fast");
  assert.ok(result.ok && result.model === "gemma-4-26b-a4b-it");
  assert.equal(calls.length, 1);
  assert.equal((calls[0].body.generationConfig as Record<string, unknown>).thinkingConfig, undefined);
});

test("a Gemma error falls back to Gemini (with thinkingLevel)", async () => {
  fakeFetch({ "gemma-4-26b-a4b-it": [{ status: 400 }], "gemini-flash-latest": [{ status: 200, json: { intent: "meet" } }] });
  const result = await ask("fast");
  assert.ok(result.ok && result.model === "gemini-flash-latest");
  assert.deepEqual(calls.map((c) => c.model), ["gemma-4-26b-a4b-it", "gemini-flash-latest"]);
  assert.deepEqual((calls[1].body.generationConfig as Record<string, unknown>).thinkingConfig, { thinkingLevel: "low" });
});

test("invalid Gemma output gets one try, then Gemini (which may retry)", async () => {
  fakeFetch({
    "gemma-4-26b-a4b-it": [{ status: 200, json: { intent: "dance" } }],
    "gemini-flash-latest": [{ status: 200, json: { intent: "wrong" } }, { status: 200, json: { intent: "meet" } }],
  });
  const result = await ask("fast");
  assert.ok(result.ok && result.model === "gemini-flash-latest");
  assert.deepEqual(calls.map((c) => c.model), ["gemma-4-26b-a4b-it", "gemini-flash-latest", "gemini-flash-latest"]);
});

test("reasoning tasks never touch Gemma", async () => {
  fakeFetch({ "gemini-flash-latest": [{ status: 200, json: { intent: "meet" } }] });
  await ask("reasoning");
  assert.deepEqual(calls.map((c) => c.model), ["gemini-flash-latest"]);
});

test("failure messages only ask students to rephrase when the AI misread them", () => {
  assert.doesNotMatch(failureMessage("missing_key", "Try rephrasing."), /rephras/i);
  assert.doesNotMatch(failureMessage("gemini_request_failed", "Try rephrasing."), /rephras/i);
  assert.equal(failureMessage("gemini_invalid_output", "Try rephrasing."), "Try rephrasing.");
});

test("every request tells the model not to guess pronouns or repeat personal details", async () => {
  fakeFetch({ "gemini-flash-latest": [{ status: 200, json: { intent: "meet" } }] });
  await ask("reasoning");
  assert.match(JSON.stringify(calls[0].body), /Never assume anyone's gender or pronouns/);
});

test("a guessed pronoun gets one rewrite", async () => {
  fakeFetch({
    "gemini-flash-latest": [
      { status: 200, json: { note: "Divij said he is done." } },
      { status: 200, json: { note: "Divij said they are done." } },
    ],
  });
  const result = await generateValidatedGeminiJson<{ note: string }>({
    systemInstruction: "sys",
    buildPrompt: (issues) => `prompt ${issues.join(" ")}`,
    responseSchema: {},
    validate: (data) => ({ ok: true, value: data as { note: string } }),
    tier: "reasoning",
  });
  assert.ok(result.ok && result.value.note === "Divij said they are done.");
  assert.equal(calls.length, 2);
});

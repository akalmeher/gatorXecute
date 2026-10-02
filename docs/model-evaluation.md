# Model evaluation: Gemma 4 vs Gemini

gatorXecute uses two models through the Gemini API:

| Role | Model | Why |
|---|---|---|
| **Fast tasks** | **`gemma-4-26b-a4b-it`** (Gemma 4, open weights, mixture-of-experts: 26B total, ~4B active per token) | As accurate as Gemini on short, high-volume reading tasks; open weights mean it could later run on SFSU's own infrastructure so student text never leaves campus |
| **Reasoning** | `gemini-flash-latest` | Reading whole assignments, planning and replanning |

Routing is decided per task by measurement, not preference.

## Method

`tests/eval/ai-eval.ts` runs the **real** services (same prompts, JSON
schemas and validators the app uses) on fixed scenarios against each model,
with the response cache disabled, and checks the answer is not just valid
but **correct** (e.g. "almost done" must not become done; a class ending
10:50 must block until 11:00; the PDF's deadline must be Oct 13).

```bash
node --env-file=.env.local --no-warnings \
  --import ./tests/setup/register.mjs tests/eval/ai-eval.ts 2
```

## Results (2 runs per scenario, Oct 2 2026)

| Task | Gemma 4 26B-A4B | Gemma 4 31B | Gemini Flash | Routed to |
|---|---|---|---|---|
| + Coordinate (intent) | **8/8 · 1.4s** | 8/8 · 1.6s | 8/8 · 1.3s | **Gemma 4** |
| + Update (progress → status) | **4/4 · 1.7s** | 4/4 · 4.2s | 4/4 · 1.3s | **Gemma 4** |
| Typed availability | 0/4 (timeouts) | 4/4 · 8.4s | 4/4 · 1.8s | Gemini |
| Catch-up | 2/2 · 3.8s | 0/2 | 2/2 · 2.2s | Gemini |
| Meeting brief | 1/2 · 9.0s | 2/2 · 3.3s | 2/2 · 2.2s | Gemini |
| Replanning | 1/2 · 12.7s | 0/2 | 2/2 · 1.9s | Gemini |
| Plan from assignment PDF | 0/2 (timeouts) | 0/2 (timeouts) | 2/2 · 5.5s | Gemini |

Times are medians. "x/y" counts answers that were valid **and** correct.

## Findings that shaped the code

- Gemma 4 supports system instructions, strict JSON schemas and PDF input
  through the Gemini API, but **rejects `thinkingConfig.thinkingLevel`
  (HTTP 400)**: the client only sends it to Gemini models.
- With a response schema Gemma answers in ~1–2s; without one it reasons for
  7–10s and drifts from the allowed values, so schemas are always sent.
- On tasks it can't do, Gemma sometimes stalls until the timeout. A model
  with a fallback behind it therefore gets **one try with a 10s limit**, then
  Gemini answers. Validation is identical for both models.
- Catch-up is honesty-critical, and the two Gemma sizes disagreed (2/2 vs
  0/2), so it stays on Gemini despite the 26B model passing.

## Configuration

```
GEMMA_MODEL=gemma-4-26b-a4b-it   # default; "off" routes everything to Gemini
GEMINI_MODEL=gemini-flash-latest # default
```

`GET /api/health` reports both models. The UI labels answers with the model
that produced them ("Gemma 4" or "Gemini").

## Licenses and references

- Gemma 4 models: https://ai.google.dev/gemma (terms: https://ai.google.dev/gemma/terms)
- Accessed via the Gemini API: https://ai.google.dev/gemini-api/docs

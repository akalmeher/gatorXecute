# Tests

Fast checks for the deterministic layer around the AI: plan validation,
plan health and replanning safety, availability time math, Quick Meet links,
and the AI request guards. They use Node's built-in test runner (Node 22+),
so there is nothing to install.

```bash
node --experimental-transform-types --no-warnings --import ./tests/setup/register.mjs --test "tests/**/*.test.ts"
```

Model evaluation (real API calls, needs `GEMINI_API_KEY`), comparing Gemma 4
and Gemini on the real services; see `docs/model-evaluation.md`:

```bash
node --env-file=.env.local --experimental-transform-types --no-warnings --import ./tests/setup/register.mjs tests/eval/ai-eval.ts 2
```

`tests/setup/` lets Node resolve `@/…` imports the same way Next.js does.
If the team wants `npm test`, add that command as a `test` script in
`package.json` (Ammar's call, per AGENTS.md).

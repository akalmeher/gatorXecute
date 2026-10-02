# Tests

Fast checks for the deterministic layer around the AI: plan validation,
plan health and replanning safety, availability time math, Quick Meet links,
and the AI request guards. They use Node's built-in test runner and Node's
built-in TypeScript type stripping, so there is nothing to install.

**Node version:** 22.18 or newer (type stripping is on by default there),
including Node 24 and 26. Verified on Node 24.13. No `--experimental-*` flags
are needed; source files avoid TypeScript syntax that needs transforming
(e.g. constructor parameter properties, enums).

```bash
node --no-warnings --import ./tests/setup/register.mjs --test "tests/**/*.test.ts"
```

Model evaluation (real API calls, needs `GEMINI_API_KEY`), comparing Gemma 4
and Gemini on the real services; see `docs/model-evaluation.md`:

```bash
node --env-file=.env.local --no-warnings --import ./tests/setup/register.mjs tests/eval/ai-eval.ts 2
```

`tests/setup/` lets Node resolve `@/…` imports the same way Next.js does.
If the team wants `npm test`, add that command as a `test` script in
`package.json` (Ammar's call, per AGENTS.md).

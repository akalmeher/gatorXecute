# Tests

Fast checks for the deterministic layer around the AI: plan validation,
plan health and replanning safety, availability time math, Quick Meet links,
and the AI request guards. They use Node's built-in test runner (Node 22+),
so there is nothing to install.

```bash
node --experimental-transform-types --no-warnings --import ./tests/setup/register.mjs --test "tests/**/*.test.ts"
```

`tests/setup/` lets Node resolve `@/…` imports the same way Next.js does.
If the team wants `npm test`, add that command as a `test` script in
`package.json` (Ammar's call, per AGENTS.md).

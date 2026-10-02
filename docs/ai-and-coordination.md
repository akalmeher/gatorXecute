# AI and coordination: Divij's contribution

gatorXecute helps SFSU student groups coordinate without anyone having to be
the project manager. This document covers the parts Divij built: every Gemini
feature, the answer-first Plan page, Quick Meet, the cockpit home, the
Collaboration Dock, and the reliability and test layer around them.

## The idea in one line

**First we meet, then (only if wanted) we plan.** Most group work just needs
a time; gatorXecute starts there and only becomes more when the group asks.

## Feature map

| Feature | Where | Gemini does | Code guarantees |
|---|---|---|---|
| Quick Meet | `/meet` | Reads "free after 4 except Wed" / class schedules into rules | Time math, cautious rounding; best time from Oscar's deterministic algorithm |
| Read the assignment | `/plan` | Reads the PDF: kind of work, deliverables, dates | Earlier deadline wins; file type/size checks |
| Plan | `/plan` | Drafts steps, owners (skills + learning goals), dates | Real owners, no cycles, dates in range, editable before accepting |
| + Update | Home, Plan | **Gemma 4** reads "finished the research btw" → status changes | Only real steps; cautious ("almost done" ≠ done); confirm first |
| Find a way forward | Home, Plan | Proposes the smallest fix, or "settle it together" | Finished steps untouched; dates in order; apply only on click |
| + Coordinate | Home | **Gemma 4** infers meet / project / update / help | Only routes; never claims an action |
| Catch-up, brief | API for Meetings | What you missed; what's worth discussing | No notes → no decisions; ids must exist |
| Cockpit home | `/` | (none) | Next step, attention and dates computed by plain code |
| Collaboration Dock | every page | (none) | Shows work state per person, never scores |

## Two models: Gemma 4 and Gemini

Fast, high-volume tasks (+ Coordinate, + Update) run on **Gemma 4**
(`gemma-4-26b-a4b-it`, open weights) with automatic Gemini fallback;
reading assignments, planning, replanning, catch-up and the brief run on
**Gemini**. The split comes from an evaluation of the real services on both
models ([model-evaluation.md](model-evaluation.md)): Gemma 4 matched Gemini
exactly on the fast tasks (8/8, 4/4) at similar speed. Open weights also
open a path to running it on SFSU infrastructure for privacy.

## Architecture

```
Next.js App Router (client)                      Server (route handlers)
───────────────────────────                      ───────────────────────
ProjectContext (one demo project, in memory)     /api/plan  /api/replan  /api/progress-update
features/start   cockpit + Coordinate     fetch  /api/availability  /api/coordinate
features/plan    Plan page            ─────────▶ /api/catch-up  /api/meeting-brief  /api/health
features/meet    Quick Meet (state in URL #)            │
components/shell Collaboration Dock (PR #4)             ▼
                                                 features/ai/gemini.ts
                                                   rate limit → cache → Gemini REST
                                                   → validate → retry once → fallback
```

- **No database, no accounts** (MVP non-goals). Project state is in memory;
  Quick Meet state lives in the link.
- **No new dependencies.** Gemini over `fetch`; tests on Node's built-in runner.
- **Ownership respected.** Shared files changed only via the agreed
  `replaceTasks` action and the shell PR (#4) reviewed by Ammar.

## Design principles applied

From the team's design philosophy:
- **Answer first, controls second**: the best time before the grid; "Got it,
  here's what I found" before the plan; NEXT before the full list.
- **AI works backstage**: no "Ask AI" buttons; Gemini is labeled quietly.
- **Humans decide**: every AI result is a proposal with [Use / Another / Keep].
- **No dead ends**: every problem has an action; every failure has a fallback.
- **Never ask twice**: identity is picked once.
- **Presence over menus**: people and the project live in the dock.
- **Coordinate the work, don't police the people**: no scores or judgments.

## Responsible AI

- **Bias:** owners come from listed skills and the student's own learning
  goals; role titles and majors are not used to assign work; every member is
  given a step that practices one of their goals.
- **Honesty:** fallbacks are always labeled "not AI"; catch-up never invents
  decisions; the coordinator never claims actions.
- **Prompt injection:** student content is treated as data in every prompt,
  and outputs are validated in code. Tested with a malicious assignment PDF
  and override attempts; none succeeded.
- **Privacy:** no accounts or stored profiles; Quick Meet polls live only in
  links; the Gemini key never leaves the server.
- **Human control:** nothing is saved without a click; everything is editable.

## Quality

- `npm run lint`, `npm run build`, `tsc --noEmit` pass (apart from one
  existing lint error in `features/scheduling/AvailabilityGrid.tsx:96`).
- **27 tests** (`tests/`, Node's runner, no dependencies): plan validation,
  plan health and replanning safety, availability time math, Quick Meet
  links, catch-up honesty rules, updates, cache, rate limit, and model
  routing (Gemma first, Gemini fallback, no unsupported settings to Gemma).
- **Model evaluation** (`tests/eval/ai-eval.ts`): 72 live calls across
  Gemma 4 26B, Gemma 4 31B and Gemini. Verified to
  catch regressions by re-breaking a fix.
- Live timings with `GEMINI_THINKING_LEVEL=low`: catch-up, brief,
  availability, updates, coordinate ~1–3 s; plan ~4–5 s; cached repeats ~30 ms.

## Demo-day checklist

1. Pull merged `main`, `npm install`, `.env.local` with `GEMINI_API_KEY`.
2. `npm run dev`, open `http://localhost:3000/api/health` → `"ready"`.
3. Bad Wi-Fi? `GEMINI_OFFLINE=1` → every step works with labeled fallbacks.
4. Demo prop: a sample assignment PDF (e.g. a CINE 211 group presentation).

## Known limitations

- One project in memory; refreshing resets demo data (by design for the MVP).
- Identity is a per-browser choice, not a login.
- Cache and rate limit are per server instance.
- Quick Meet: last link shared wins if two people edit at once.
- Meetings screen for catch-up/brief is Shreya's (endpoints ready).

## Roadmap at SFSU

SFSU SSO sign-in → shared storage (projects, plans, event log) → "since you
were here" summaries and ambient nudges → calendar and class-schedule import
with explicit consent → adaptive views per kind of work (film, lab, study).

## Pull requests

| PR | Contents | Merge order |
|---|---|---|
| #1 | All AI routes, Plan page, replanning, updates, availability | 1st |
| #3 | Cockpit, + Coordinate, Quick Meet (+ Oscar's grid), reliability, tests, docs | 2nd |
| #4 | Collaboration Dock, quiet header, `/` as home | 3rd |
| #5 | Gemma 4 integration, model routing, evaluation | 4th |

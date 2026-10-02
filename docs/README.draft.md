<!--
  DRAFT root README for Ammar to review and adopt (README.md is a shared file).
  Also usable as the ShipYard project description. Team sections are marked TODO
  for teammates to fill in their own parts.
-->

# gatorXecute

**Coordination without a coordinator, for SFSU student teams.**

Group projects fail on coordination, not effort: finding a time, figuring out
who does what, keeping up when someone misses a meeting, and recovering when
things slip. gatorXecute does that work so students can do the actual work, in
any major, from a cinema presentation to a software project.

> First we meet. Then, only if the group wants it, we plan.

## What it does

- **Quick Meet**: type "I'm free after 4 except Wednesdays" (or paste your
  class schedule), send a link, get "Monday 4–5 PM works for everyone". No
  account, no app.
- **Reads the assignment**: upload the PDF; "Got it. 5 things to hand in,
  final deadline Tue, Oct 13."
- **Drafts a fair plan**: steps, owners matched to skills *and* what each
  person wants to learn, realistic dates. Everything editable.
- **Updates in plain words**: "finished the research btw" updates the plan.
- **Finds a way forward**: when something slips, proposes the smallest fix,
  or suggests settling a disagreement together. Nothing changes until you choose.
- **Catches you up**: what was decided, what changed, and your part.

## Why it's trustworthy (Responsible AI)

- Gemini proposes; students decide. Every AI result is a suggestion.
- Every AI output is validated in code (real people, real dates, no cycles).
- Never judges students: no scores, no "behind"; work is assigned from skills
  and learning goals, never from major or stereotypes.
- Fallbacks are always labeled "not AI".
- Prompt-injection tested with a malicious assignment PDF.
- Privacy: no accounts or stored profiles; meeting polls live in the link.

## Built with

Next.js (App Router) · TypeScript · Tailwind CSS · **Google Gemini**
(`gemini-flash-latest` via the Gemini API, server-side only) · Google AI Studio

## Run it

```bash
npm install
```

Create `.env.local`:

```
GEMINI_API_KEY=your-key-from-aistudio.google.com
```

```bash
npm run dev
```

Open http://localhost:3000. Check http://localhost:3000/api/health shows
`"ready"`. No key or no Wi-Fi? Set `GEMINI_OFFLINE=1` to run on labeled fallbacks.

Tests:

```bash
node --experimental-transform-types --no-warnings --import ./tests/setup/register.mjs --test "tests/**/*.test.ts"
```

## Team

- **Ammar Almeher**: app shell, integration, shared types, dashboard. TODO
- **Divij Anand**: Gemini integration and every AI feature, Plan page, Quick
  Meet, cockpit home, Collaboration Dock, reliability and tests
  ([docs/ai-and-coordination.md](docs/ai-and-coordination.md))
- **Oscar Garcia**: scheduling grid and best-time algorithm. TODO
- **Shreya Rameshwar**: meetings, async updates, catch-up. TODO

## How it could be used at SFSU

Instructors enable it per course; students sign in with SFSU SSO; class
schedules import with consent; group work gets coordinated without a
dedicated project manager. See the roadmap in
[docs/ai-and-coordination.md](docs/ai-and-coordination.md).

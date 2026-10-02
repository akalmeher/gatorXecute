<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# gatorXecute — Hackathon Engineering Rules

gatorXecute is an SFSU AI Hackathon MVP for student group-project coordination.

## Product Goal

The core demo flow is:

Create Project
→ Add Team
→ AI Project Plan
→ Team Dashboard
→ Find Meeting Time
→ Generate Meeting Brief
→ Member Can't Attend
→ AI Catch-Up

Do not add stretch features until this entire flow works reliably.

## Priorities

1. Working demo over architectural complexity.
2. Keep the stack minimal.
3. Do not add new frameworks or dependencies without Ammar's approval.
4. Do not modify package.json without Ammar's approval.
5. Do not perform large cross-feature refactors without explaining them first.
6. Prefer small, reviewable changes.
7. Run lint and build after meaningful changes.

## Current Architecture

- Next.js App Router
- TypeScript
- Tailwind CSS
- Gemini API through server-side routes
- Zod for validating structured AI output
- Local/mock project state first
- Database/persistence only after the full demo flow works

## AI Rules

Use Gemini only where interpretation or reasoning is useful:

- assignment decomposition
- task-allocation recommendations
- meeting agenda generation
- missed-meeting catch-up
- project replanning

Do not use Gemini for deterministic logic such as:

- schedule intersection
- sorting
- basic status calculations
- simple validation

AI recommendations must always remain editable by the user.

Do not rank, score, or judge students by productivity, competence, or contribution quality.

## Team Ownership

Ammar Almeher:
- app shell
- integration
- shared types
- dashboard
- overall UI consistency
- final merges

Divij Anand:
- Gemini integration
- AI schemas
- AI prompts and server routes

Oscar Garcia:
- scheduling
- availability interface
- overlap algorithm

Shreya Rameshwar:
- meeting flow
- async updates
- Can't Attend flow
- catch-up interface

Avoid modifying another person's feature area unless explicitly coordinated.

Shared files require coordination before editing.

## Git Rules

- main must remain stable.
- Feature work happens on feature branches.
- Keep commits small and descriptive.
- Never force-push main.
- Do not merge automatically unless explicitly asked.
- Ammar performs final integration into main.

## MVP Non-Goals

Do not build these until the core MVP works:

- authentication
- chat
- notifications
- Google Calendar integration
- GitHub integration
- advanced analytics
- productivity scoring
- full SFSU infrastructure integration

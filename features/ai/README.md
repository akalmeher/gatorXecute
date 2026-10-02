# AI routes (owner: Divij)

All Gemini calls run on the server. Every response is validated before it is
returned; invalid output is retried once with the problems fed back, then
reported as an error. Nothing is written to shared state by these routes.

## Setup

`.env.local` (git-ignored, never commit):

```
GEMINI_API_KEY=...            # Google AI Studio key, required for live mode
GEMINI_MODEL=...              # optional, default gemini-flash-latest
```

## Common behavior

- Send `mode: "demo"` to get a deterministic fallback with `source: "demo"`.
  Always label it in the UI as not AI generated.
- Errors: `{ ok: false, error, message, issues? }` where `error` is
  `bad_request` (400), `missing_key` (503), `gemini_request_failed` (502) or
  `gemini_invalid_output` (502). On error, keep showing existing data and offer
  retry or the demo fallback.

## POST /api/plan

Types: `features/plan/plan-types.ts`. Used by `/plan`.

## POST /api/catch-up (for Shreya)

Types: `features/ai/catch-up-types.ts`.

Request: `{ meeting, notes?, absentMemberId?, asyncUpdates, tasks, members }`
using the canonical types from `types/index.ts`.

Response: `{ ok: true, source, catchUp: { summary, decisions[], actionItems[{ text, suggestedOwnerId?, relatedTaskId? }], missingInfo[] } }`

- No `notes` means `decisions` is always empty and `missingInfo` says so.
- `suggestedOwnerId` / `relatedTaskId` are always real ids from the request.
- Action items are suggestions: show them as such until the team accepts them.
- Show `missingInfo` to the user.

## POST /api/meeting-brief (for Shreya)

Types: `features/ai/meeting-brief-types.ts`.

Request: `{ project: { name, deadline }, meeting: { title, durationMinutes, attendeeIds }, tasks, asyncUpdates, members }`

Response: `{ ok: true, source, brief: { goal, agenda[{ title, minutes, relatedTaskIds[] }] } }`

- Agenda minutes never exceed `durationMinutes` in total.
- `toAgendaItems(brief)` converts to canonical `Meeting.agendaItems` strings.

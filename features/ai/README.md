# AI routes (owner: Divij)

All Gemini calls run on the server. Every response is validated before it is
returned; invalid output is retried once with the problems fed back, then
reported as an error. Nothing is written to shared state by these routes.

## Setup

`.env.local` (git-ignored, never commit):

```
GEMINI_API_KEY=...            # Google AI Studio key, required for live mode
GEMINI_MODEL=...              # optional, default gemini-flash-latest
GEMINI_THINKING_LEVEL=...     # optional, default low (fast: ~1-4s); "off" to disable
```

## Common behavior

- Send `mode: "demo"` to get a deterministic fallback with `source: "demo"`.
  Always label it in the UI as not AI generated.
- Errors: `{ ok: false, error, message, issues? }` where `error` is
  `bad_request` (400), `missing_key` (503), `gemini_request_failed` (502) or
  `gemini_invalid_output` (502). On error, keep showing existing data and offer
  retry or the demo fallback.
- Outputs use plain language (no task / dependency / blocked jargon) and never
  judge people.

## POST /api/plan

Types: `features/plan/plan-types.ts`. Used by `/plan`.

## POST /api/catch-up (for Shreya): "Here's what you missed"

Types: `features/ai/catch-up-types.ts`.

Request: `{ meeting, notes?, absentMemberId?, asyncUpdates, tasks, members }`
using the canonical types from `types/index.ts`.

Response `catchUp`:

| Field | Show as |
|---|---|
| `headline` | The one line at the top ("One decision was made. Your work hasn't changed.") |
| `decided[]` | **Decided** |
| `changed[]` | **Changed** |
| `yourPart[{ text, relatedTaskId? }]` | **Your part**. Empty means "Nothing else needs you." |
| `commitments[{ memberId?, text, due?, relatedTaskId? }]` | **What people agreed to** (suggestions until confirmed) |
| `openQuestions[]` | **Still open** |
| `missingInfo[]` | Small note at the bottom |

- No `notes` means `decided` is always empty and the headline says nothing is confirmed.
- No `absentMemberId` means `yourPart` is always empty.
- Member and task ids are always real ids from the request.
- Empty lists mean nothing to show: hide those sections.

## POST /api/meeting-brief (for Shreya): "Worth discussing"

Types: `features/ai/meeting-brief-types.ts`.

Request: `{ project: { name, deadline }, meeting: { title, durationMinutes, attendeeIds }, tasks, asyncUpdates, members }`

Response `brief`: `{ headline, worthDiscussing[{ title, why, kind, minutes, relatedTaskIds[] }], everythingElse, meetingNeeded }`

- `kind` is `decision | waiting | deadline | check-in` (pair any icon with a text label).
- Minutes never exceed `durationMinutes` in total.
- `meetingNeeded: false` means nothing needs the group live: offer
  **[Skip this meeting] [Keep it]**.
- `toAgendaItems(brief)` converts to canonical `Meeting.agendaItems` strings.

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

- Optional `assignment: { text?, file?: { name, mimeType, data } }`: pasted
  instructions and/or a PDF/text file (base64, max 4 MB). Gemini reads it directly.
- Response adds `understanding` ("Got it. Here's what I found"): `kind`, `summary`,
  `deliverables`, `milestones`, `finalDeadline`. If the assignment's deadline is
  earlier than the project deadline, the plan follows the earlier date.
- Steps are shaped to the kind of work (film, paper, presentation, study group, ...).

## POST /api/replan

Types: `features/plan/replan-types.ts`. Used by the Plan page.

- Problems are found with plain rules (`plan-health.ts`): late, stuck with
  nothing to wait for, or unowned. Gemini only proposes the fix.
- Request: `{ project, tasks, concern?, avoid? }`. `concern` is a student note
  ("Oscar is out sick until Thursday"); `avoid` lists proposals already shown.
- Response `suggestion`: `{ headline, situation, proposal, changes[{ taskId, ownerId?, dueDate?, why }], outcome, onTrack }`.
- Every change is checked in code (real steps and members, nothing done changes,
  dates between today and the deadline, order kept). Applied only on "Use suggestion".

## POST /api/availability (for Oscar): "Tell us when you're free"

Types: `features/ai/availability-types.ts`. Time math: `features/ai/availability-compile.ts`.

Request: `{ memberId, text, current?, grid? }`
- `text`: sentences ("free after 4 except Wednesdays, don't schedule me Friday
  evenings") or a pasted class schedule ("BIO 230 MWF 10:00-10:50").
- `current`: the member's existing blocks, so "Thursdays don't work anymore" edits them.
- `grid` defaults to Oscar's: Mon–Fri, 9 AM–9 PM, 30-minute cells, local time.

Response `result`: `{ blocks, summary, readBack[], notes[], rules[] }`
- `blocks` are canonical `AvailabilityBlock`s (assignable to `AvailabilityBlock[]`),
  ready for `updateMemberAvailability(memberId, blocks)`, **after the student confirms**.
- Optional `level` on a block: `"preferred"` or `"if-needed"` (absent = plain available).
  Grids that only know free/busy can ignore it.
- `summary` is what Gemini understood; `readBack` is what the grid now says,
  computed from the cells (not AI). Show both, then **[Looks right] [Edit on grid]**.
- `notes` lists anything skipped (e.g. Saturday on a weekday grid) or unclear.
- Gemini only reads words into rules. Rounding is cautious: free time shrinks to
  whole cells, busy time grows (a class ending 10:50 blocks until 11:00).

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

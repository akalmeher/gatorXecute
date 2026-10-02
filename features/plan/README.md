# Plan (owner: Divij)

The `/plan` page: from an assignment to a plan the team can see, update in
plain words, and fix when it slips. Gemini drafts and proposes; students
confirm everything.

## What the student sees

1. **No plan yet / Draft a fresh plan**: upload the assignment (PDF or text,
   ≤ 4 MB) or paste it (`AssignmentInput`).
2. **"Got it. Here's what I found."** (`FoundSummary`): kind of work,
   deliverables, key dates, final deadline; flags an assignment deadline
   earlier than the project's and plans for the earlier one.
3. **"I've drafted a plan for your team."** → **[Looks good]** or
   **[Review plan]** (`PlanDraftEditor`: edit title, owner, date, time; remove).
4. **Current plan**: progress rail (`ProgressRail`), **NEXT** with
   **[Done] [Need help]** and ⚠ attention items with **[Fix]** (`PlanFocus`),
   **+ Update** (`PlanQuickUpdate`), and every step (`PlanTimeline`).

## Files

| File | Role |
|---|---|
| `ProjectPlanView.tsx` | Page composition and draft/accept flow |
| `PlanFocus.tsx` | NEXT, attention, and the replanning suggestion panel (shared with Home) |
| `PlanQuickUpdate.tsx` | "+ Update": plain-words progress → confirmed status changes; shares the note for meetings |
| `ProgressRail.tsx`, `PlanTimeline.tsx` | Read-only views; state shown by shape + label, not color alone |
| `PlanDraftEditor.tsx`, `AssignmentInput.tsx`, `FoundSummary.tsx` | Drafting UI |
| `usePlanGeneration.ts`, `useReplan.ts` | Client hooks: one request at a time, abort on unmount |
| `plan-service.ts`, `plan-prompt.ts`, `plan-fallback.ts` | **Server**: `/api/plan` |
| `replan-service.ts` | **Server**: `/api/replan` |
| `update-service.ts` | **Server**: `/api/progress-update` |
| `plan-validation.ts` | Deterministic plan checks (also used client-side before accepting) |
| `plan-health.ts` | Deterministic problems (late, stuck, unowned, waiting) and safe change application |
| `plan-display.ts` | Ordering, plain-language dates and effort, summaries |
| `*-types.ts` | Request/response contracts |

## Rules worth knowing

- **Problems are found by plain code**, not AI: late (past due), stuck
  (waiting with nothing left to wait for), unowned. Waiting on an unfinished
  earlier step is normal and shown calmly, never as a warning.
- **Fixes are proposals.** `checkPlanChanges` re-validates against the current
  plan before applying; finished steps never change; a stuck step handed to a
  new owner starts fresh (prevents the banner looping).
- **Not every problem is who/when.** For a disagreement ("we can't agree on a
  film") the suggestion is to settle it together, with no plan change.
- **Never ask twice**: updates use the remembered identity
  (`features/identity/useCurrentMember.ts`) instead of asking for a name.
- **Shared state** goes through `ProjectContext` only: `replaceTasks`,
  `updateTaskStatus`, `addAsyncUpdate`.

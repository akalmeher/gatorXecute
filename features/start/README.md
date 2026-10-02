# Home cockpit (owner: Divij)

`/` (and `/start`): "What needs me?" Built to be understood while barely
reading. Not a menu of features.

| Left: what needs me | Right: when |
|---|---|
| "Good morning, Divij." (pick who you are once) | Next 7 days (◆ due dates) |
| **Your next step** · [Done] [Need help] | Coming up: meeting, steps (yours bold), ★ deadline |
| ⚠ one-line attention items · [Fix] | Team status: ✓ on track / ⚠ needs attention |
| Your stuff: compact rows | |
| **+ Coordinate** | |

## + Coordinate

One box instead of feature cards (`CoordinateBox.tsx`). `/api/coordinate`
infers the workflow from plain words and offers one next step:

| Typed | Intent | Next step |
|---|---|---|
| "find an hour for me and Maya for our Cinema presentation" | meet | Quick Meet, prefilled |
| "CSC 648 web app due Oct 16" | project | Start from the assignment |
| "finished the backend, waiting on the UI" | update | Inline update to confirm |
| "we're behind and it's due Friday" | help | Find a way forward |

The guess is always correctable ("Not quite?"), and the reply never claims an
action has happened.

## Never ask twice

`features/identity/useCurrentMember.ts` is the demo stand-in for a signed-in
user: chosen once, remembered in this browser only (falls back to memory if
storage is blocked), used by Home, + Update and the dock.

## Files

- `StartView.tsx`: the cockpit
- `CoordinateBox.tsx`: + Coordinate
- `StartIcons.tsx`: Lucide icons (ISC), inlined, no package

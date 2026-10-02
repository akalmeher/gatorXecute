# Quick Meet (owner: Divij, built on Oscar's grid)

`/meet`: "When can we meet?" with no account, no project and no app.
First we meet; planning is offered only afterwards, and only if wanted.

## Flow

1. Name it, then **type when you're free** ("after 4 except Wednesdays", or
   paste a class schedule; Gemini fills the grid via `/api/availability`) or
   **paint Oscar's grid**.
2. **Copy link** and send it anywhere.
3. The next person opens it ("Divij wants to find a time"), adds their times.
4. **The answer comes first**, from Oscar's `findBestMeetingTime`:
   "★ Best time · Monday 4:00–5:00 PM · You're both free · [This works]".
   Partial matches are labeled ("3 of 4 can make it. Maya can't.").
5. **Set**: add to calendar (`.ics`), copy link for the group, and a quiet
   "I can help plan the work too →".

## The link is the database

The whole poll lives in the URL `#fragment`, which browsers never send to a
server (`meet-link.ts`):

- `base64url(JSON)` with `{ v, title, duration, people[[id, name, cells]], chosen? }`
- each person's grid is one 24-bit mask per day (Mon–Fri, 9–9, 30-min cells),
  so a two-person link is ~150 characters
- invalid links decode to `null` and the page starts fresh with a note;
  opening a different link on the same page reloads that poll

**Privacy:** nothing about students is stored anywhere. Typed descriptions are
sent to the server only so Gemini can read them.

**Limitation:** people pass the link along in turn; if two edit at once, the
last link shared wins. A real version would add storage.

## Files

- `QuickMeetView.tsx`: the page (uses `AvailabilityGrid` and
  `findBestMeetingTime` from `features/scheduling`, unchanged)
- `meet-link.ts`: encode/decode, `.ics` builder

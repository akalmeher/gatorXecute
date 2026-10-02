# Quick Meet (owner: Divij, built on Oscar's grid)

`/meet`: "When can we meet?" with no account, no project and no app.
First we meet; planning is offered only afterwards, and only if wanted.

## Flow

1. Name it, then **type when you're free** ("after 4 except Wednesdays", or
   paste a class schedule; Gemini fills the grid via `/api/availability`) or
   **paint Oscar's grid**.
2. **Copy link** and send it anywhere.
3. The next person opens it ("Divij wants to find a time"), adds their times.
4. **The answer comes first**, from Oscar's `findBestMeetingTime`
   (`recommendMeeting` in `meet-link.ts`): "★ Best time · Monday 4:00–5:00 PM ·
   You're both free · [This works]". **Everyone in the poll counts**, so a
   person with no times makes it "2 of 3 can make it. Sara hasn't marked any
   free times", never "everyone". Each person's blocks are merged first so
   adjacent blocks cover longer meetings.
5. **Set**: the confirmation stores an explicit **date** (today if the slot
   hasn't started yet, otherwise next week), the **IANA time zone** and the
   **actual attendee ids**. "Monday, Oct 5 at 4:00 PM is set. 4:00–5:00 PM PDT
   with Divij and Maya. Sara can't make it." The `.ics` uses UTC times and
   lists who can't make it. Then copy the link, and a quiet "I can help plan
   the work too →".

## Where to meet

One optional "Where?" field, shown under the title (and on the confirmed
meeting). No AI and no accounts: `meet-where.ts` reads the text in code.

- **Type a place** ("Library 2nd floor"): in person, with an *Open in Maps* link.
- **Paste any link**: recognized by host as Zoom, Google Meet, Discord,
  Microsoft Teams, Webex (Cisco), FaceTime, Slack, WhatsApp, Skype or Jitsi
  (anything else is "Online") → a *Join Zoom* button. Only http/https links
  are ever produced.
- **Name an app** ("Discord", "Zoom 812 3456 7890"): online, link to come;
  digits next to an app name are a meeting ID, not a phone number.
- **Phone**: "Phone call" or a number → *Call* (with a note that anyone with
  the link can see it).
- **Place + link** ("Library room 2 and zoom.us/j/123"): hybrid.
- **One-tap chips** when empty: Library, Student Center (real SF State
  spots), Zoom, Google Meet, Discord, Phone call. App chips keep the field
  open so the link can be pasted next. "Decide later" never blocks anything.

It reads back live as you type ("Zoom · link ready ✓"). Once set, the place
becomes the action (Join / Open in Maps / Call). The raw text is stored in
the link (`w`) and survives time changes, and the `.ics` gets `LOCATION`,
`URL` and a "Join:" line.

## The link is the database

The whole poll lives in the URL `#fragment`, which browsers never send to a
server (`meet-link.ts`):

- format v2: `base64url(JSON)` with `{ v, title, duration, people[[id, name, cells]],
  chosen?[day, date, start, end, timeZone, attendeeIds], where? }`
- each person's grid is one 24-bit mask per day over Oscar's `DAYS` (Mon–Sun,
  9–9, 30-min cells), so a two-person link is ~200 characters
- invalid links decode to `null` and the page starts fresh with a note; a
  confirmed slot that isn't fully consistent (missing end, wrong length, date
  on the wrong weekday, bad time zone, unknown attendee) is dropped, so a bad
  link can never show a meeting as booked; opening a different link on the
  same page reloads that poll

**Privacy:** nothing about students is stored anywhere. Typed descriptions are
sent to the server only so Gemini can read them.

**Limitation:** people pass the link along in turn; if two edit at once, the
last link shared wins. A real version would add storage.

## Files

- `QuickMeetView.tsx`: the page (uses `AvailabilityGrid` and
  `findBestMeetingTime` from `features/scheduling`, unchanged)
- `meet-link.ts`: encode/decode, `.ics` builder
- `meet-where.ts`, `WhereField.tsx`: "Where?" parsing and the field

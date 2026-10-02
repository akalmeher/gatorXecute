# Profiles and teams (owner: Divij)

No passwords, no database: a profile is saved on the device and a team lives
in its invite link, like Quick Meet. Swappable for real accounts later
without changing the screens.

## Profile (`/profile`)

- Name, optional major, **skill tags** and **things to learn**.
- Tags: type + Enter (or commas), tap a suggestion, or **say it in your own
  words** ("I edit videos and I'm okay at writing") → `/api/skills` (Gemma 4,
  Gemini fallback, code-only fallback) turns it into tags the student checks.
- Only what the student said: never inferred from the major, never rated.
- Stored in `localStorage` (`gatorxecute:profile`); its id is the member id
  used everywhere, so nobody is asked "who are you?" twice.

## Team (`/team`)

1. No profile? It's asked for inline, once.
2. **Start the team** (name + optional class): you're in it; the address bar
   is the invite link.
3. Teammates open it ("Divij invited you to…"), **Join as Maya**, send it back.
4. "Together you can": who listed what. Describes skills, never ranks people;
   people with no skills listed are told they'll still get a fair share.
5. **Plan with this team** → `startProject` (fresh steps, meetings and
   updates; deadline kept until the plan sets one) → `/plan` drafts steps
   from everyone's skills and learning goals. The dock shows the real team,
   with each person's skills on hover.

## Files

- `features/profile/profile.ts`: model, tag normalization, sanitizing, `profileToMember`
- `features/profile/useProfile.ts`, `ProfileForm.tsx`, `TagInput.tsx`, `ProfileView.tsx`
- `features/team/team-link.ts`: link format v1, `joinTeam`, `skillCoverage`
- `features/team/TeamView.tsx`
- `features/ai/skills.ts`, `app/api/skills/route.ts`
- `context/ProjectContext.tsx`: `replaceMembers`, `startProject` (additive)
- Tests: `tests/profile-team.test.ts`

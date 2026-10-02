# Profiles and teams (owner: Divij)

No passwords, no database: a profile is saved on the device and a team lives
in its invite link, like Quick Meet. Swappable for real accounts later
without changing the screens.

## Profile (`/profile`) — Discord-Style Identity Model

Just like Discord has a Universal Profile and Per-Server Profiles:

1. **SFSU Uni Profile (Global)**:
   - Name, major/program, bio, master skill vault across colleges (CS & Tech, Cinema & Media, Design & UX, Business & Comms, Writing & Research, Science & Lab).
   - Natural language skill reader ("I edit videos and I'm okay at writing") → `/api/skills` (Gemma 4 first, Gemini fallback).
   - Saved locally (`localStorage["gatorxecute:profile"]`).

2. **Per-Project Profile (Per-Server / Course)**:
   - In a cinema class (CINE 211), your CSC 667 distributed systems skills aren't relevant, but video editing and scriptwriting are. In software engineering (CSC 648), technical skills take the lead.
   - Project-specific role (e.g. "Lead Editor & Storyboarder" vs "Backend Architect").
   - **Active Skills Picker**: toggle skills from your master Uni profile with intelligent course-context matching (`matchSkillsToCourse`).
   - Project-specific learning goals.
   - **Discord-style Live Preview Card**: real-time preview of how teammates and Gemini perceive you in this workspace.
   - Saved locally (`localStorage["gatorxecute:project-profiles"]`).

3. **AI Task Allocation Grounding**:
   - `/api/plan` receives each member's *active project skills* rather than a noisy universal list, allowing Gemini to decompose tasks accurately for the course domain.

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

- `features/profile/profile.ts`: models (`Profile`, `ProjectProfile`), catalogs (`SKILL_CATEGORIES`), sanitizers, `resolveMemberForProject`, `matchSkillsToCourse`
- `features/profile/useProfile.ts`: reactive external stores for Uni profile and project profiles
- `features/profile/ProfileForm.tsx`: master profile editor with bio and category pill browser
- `features/profile/ProjectProfileEditor.tsx`: per-project profile editor with course matching and Discord preview
- `features/profile/ProfileView.tsx`: tabbed dual-identity switcher
- `features/profile/TagInput.tsx`: keyboard-friendly tag input
- `features/team/team-link.ts`: link format v1, `joinTeam`, `skillCoverage`
- `features/team/TeamView.tsx`: team formation and link sharing
- `features/ai/skills.ts`, `app/api/skills/route.ts`
- `context/ProjectContext.tsx`: `replaceMembers`, `startProject` (additive)
- Tests: `tests/profile-team.test.ts` (67 tests passing)

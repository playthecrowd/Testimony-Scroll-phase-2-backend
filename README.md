# Quest for the Kingdom

A Next.js app for **Quest for the Kingdom**: every church lesson becomes a member journey —
**Captured → Studied → Experienced → Applied → Added to the Story.**

**Backend Milestone One** connected real Supabase authentication and lesson capture/publish (see
`docs/SUPABASE_SETUP.md`). Journey, Quest, Leaderboard, Testimony, Kingdom Scroll, Story, Characters, Episodes,
and the OpenAI/Higgsfield/email integrations are still fully mocked (localStorage + `/data`) — see
Section 6 below.

---

## 1. Getting Started (Beginner Friendly)

You'll need [Node.js](https://nodejs.org) version 18.18 or newer installed on your computer.

1. **Unzip the project** and open a terminal in the project folder.
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Set up Supabase** — copy `.env.example` to `.env.local` and follow `docs/SUPABASE_SETUP.md` to create a
   project, run the migrations, and seed sample data. Without this, the app still runs and every
   still-mocked feature works, but sign-in/sign-up, Capture, the Lessons Library, Lesson Detail, and Church
   Archive pages will show a "Supabase isn't configured" message instead of crashing.
4. **Run the development server:**
   ```bash
   npm run dev
   ```
5. Open **http://localhost:3000** in your browser.

To create a production build:
```bash
npm run build
npm run start
```

The app deploys to [Vercel](https://vercel.com) — see `docs/SUPABASE_SETUP.md` Section 3 for which
environment variables to set there.

---

## 2. How to Explore the Prototype

- Visit `/` for the public campaign homepage.
- Click **Sign In / Create Account** and choose **Church Host** or **Kingdom Member** — this creates a real
  Supabase account. A new Church Host is walked through **Complete Church Setup** before reaching their
  dashboard.
- As a **Church Host**, visit `/capture` to submit a new lesson. It's saved as a **draft** — open it to
  preview and click **Publish Lesson** to make it appear in `/lessons` and the church's archive page.
- As a **Kingdom Member**, open any lesson and click **Start This Journey**, then walk through:
  **Studied → Experienced (Simulate Quest Completion) → Applied (submit + dev-approve a testimony) → Added to
  the Story (publish to the Kingdom Scroll).**
- Visit `/kingdom-scroll`, `/story`, `/characters`, and `/episodes` to see how an approved testimony becomes a
  story character, a story entry, and connects to episodes.

All of your progress is saved to your browser's `localStorage`, so it will persist between page reloads. Use
your browser's dev tools (Application → Local Storage) to clear it and start fresh, or clear cookies for this
site.

---

## 3. Project Structure

```text
/app                  Next.js App Router routes (one folder per screen)
/components
  /layout              Top bar, sidebar, footer, page shell, account menu
  /journey              Journey stage pipeline + stepper components
  /lessons               Lesson card
  /auth                   Sign in / create account screen
  /ui                       Buttons, stat pills, auth-gate modal
/context               React context for the (now Supabase-backed) auth session
/data                  Centralized mock seed data + TypeScript types re-exports
/services              Mock service layer (the "API" the still-mocked pages talk to)
/services/supabase     Real Supabase-backed service layer (Lessons Library, Lesson Detail, Church Archive)
/lib/supabase          Browser/server/admin Supabase clients + env handling
/supabase/migrations   SQL migrations (tables, indexes, functions/RPCs, RLS)
/scripts               Dev-only seed script
/types                 Shared TypeScript interfaces for every entity
/lib                   Small helpers (storage, images, class names)
```

### Why two service layers?

Journey/Quest/Leaderboard/Testimony/Scroll/Story/Characters/Episodes still read through the original mock
`/services/*.ts` functions (e.g. `getAllLessons()`, `submitTestimony()`), backed by `/data` + `localStorage` —
unchanged by Backend Milestone One. Capture, the Lessons Library, Lesson Detail, and Church Archive instead go
through `/services/supabase/*`, which talks to the real database. Keeping them separate meant converting the
four real surfaces to Supabase couldn't silently break the ~20 pages still relying on the mock layer.

### Where things are stored

`/lib/storage.ts` wraps `localStorage` with a seed-fallback pattern: the first time a collection (lessons,
journeys, testimonies, badges, etc.) is requested, it's seeded from `/data` and then persisted. Submitting a
lesson, starting a journey, completing a quest, or submitting/approving a testimony all write back to
`localStorage` through the relevant service.

---

## 4. Key Simulated Systems

| System | How it's simulated |
| --- | --- |
| AI lesson processing | Cosmetic "AI Processing Preview" panel on `/capture` |
| 3D Quest completion | "Simulate Quest Completion" dev button generates a randomized score, time, and leaderboard entry |
| Testimony review | "Dev: Approve Testimony" button on the Applied stage and Host Dashboard |
| AI story/character generation | `services/storyService.ts` deterministically turns an approved testimony into a character + story entry |
| Badges | `services/badgeService.ts` awards badges automatically as journey stages complete |

---

## 5. Account Types

- **Church Host** — capture lessons, review member testimonies, view a church-level dashboard at
  `/host-dashboard`.
- **Kingdom Member** — browse lessons, progress through journeys, appear on the leaderboard, submit
  testimonies, and view their story contribution.

Account type is chosen at signup and is a real, fixed attribute of the account (`profiles.account_type`) —
there's no dev persona switcher anymore, since that was simulated-auth tooling with no meaning once accounts
are real.

---

## 6. What's Still Mocked

- Journey, Quest (3D experience + leaderboard), Testimony, Kingdom Scroll, Story, Characters, and Episodes —
  all still `/data` + `localStorage`, via the original `/services/*.ts` files.
- AI lesson processing (OpenAI), story/video/character generation (Higgsfield), and email notifications.
- Production file storage for uploaded documents/video/audio (Capture's file drop zone is still cosmetic;
  media is captured as links or pasted text/transcript).

See `docs/SUPABASE_SETUP.md` for how the now-real pieces (auth, Capture, Lessons Library, Lesson Detail,
Church Archive) are configured and tested.

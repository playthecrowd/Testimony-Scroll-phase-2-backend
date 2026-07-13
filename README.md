# Quest for the Kingdom — Phase One Prototype

A fully clickable Next.js prototype of **Quest for the Kingdom**: every church lesson becomes a member journey —
**Captured → Studied → Experienced → Applied → Added to the Story.**

This is Phase One: a front-end prototype with realistic mock data and simulated services. No production
database, authentication, AI, email, or payment systems are connected yet — those arrive in Phase Two.

---

## 1. Getting Started (Beginner Friendly)

You'll need [Node.js](https://nodejs.org) version 18.18 or newer installed on your computer.

1. **Unzip the project** and open a terminal in the project folder.
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Run the development server:**
   ```bash
   npm run dev
   ```
4. Open **http://localhost:3000** in your browser.

That's it — the whole prototype runs locally, no external accounts required.

To create a production build:
```bash
npm run build
npm run start
```

The app is also ready to deploy to [Vercel](https://vercel.com) — just import the project, no environment
variables are required for Phase One.

---

## 2. How to Explore the Prototype

- Visit `/` for the public campaign homepage.
- Click **Sign In / Create Account** and choose **Church Host** or **Kingdom Member**. Sign-in is simulated —
  any email/password combination works.
- Once logged in, use the **avatar menu (top right) → "Dev: Preview as"** to instantly switch between the
  Church Host and Kingdom Member experience without signing out.
- As a **Church Host**, visit `/capture` to submit a new lesson — it will immediately appear in `/lessons` and
  on the church's archive page.
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
/context               React context for the simulated auth session
/data                  Centralized mock seed data + TypeScript types re-exports
/services              Mock service layer (the "API" the UI talks to)
/types                 Shared TypeScript interfaces for every entity
/lib                   Small helpers (storage, images, class names)
```

### Why a service layer?

Every page requests data through a function in `/services` (e.g. `getAllLessons()`,
`submitTestimony()`, `simulateQuestCompletion()`) instead of importing mock data directly. In Phase Two,
these functions will be rewritten to call Supabase and secure server APIs — the pages themselves should not
need to change.

### Where things are stored

`/lib/storage.ts` wraps `localStorage` with a seed-fallback pattern: the first time a collection (lessons,
journeys, testimonies, badges, etc.) is requested, it's seeded from `/data` and then persisted. Submitting a
lesson, starting a journey, completing a quest, or submitting/approving a testimony all write back to
`localStorage` through the relevant service.

---

## 4. Key Simulated Systems

| System | How it's simulated |
| --- | --- |
| Authentication | `services/authService.ts` — instant sign-in/sign-up, no real credentials checked |
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

Switch between them anytime from the avatar menu — this is a Phase One development convenience and will be
replaced by real role-based accounts in Phase Two.

---

## 6. What's Next (Phase Two, not included here)

- Supabase/Postgres-backed data instead of `localStorage`
- Real authentication & role-based access control
- OpenAI/Higgsfield-powered lesson processing, story generation, and video/character creation
- Production file storage for uploaded documents, video, and audio
- Email notifications and payment/subscription handling

Everything in `/services` is written so those integrations can replace the mock implementations behind the
same function signatures, without needing to rewrite the pages that call them.

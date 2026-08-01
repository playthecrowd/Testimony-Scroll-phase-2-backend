# Supabase Setup Guide (Backend Milestone One)

Beginner-friendly walkthrough for connecting this app to a real Supabase backend. Written for someone who has
never used Supabase before.

---

## 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in (or create a free account).
2. Click **New Project**.
3. Choose an organization, give the project a name (e.g. `qftk-production` or `qftk-dev`), set a database
   password (save it somewhere safe), and pick a region close to your users.
4. Click **Create new project** and wait a minute or two for it to finish provisioning.

You can create separate projects for local development and production if you want fully isolated data — most
teams start with one project and add more later.

---

## 2. Find your project URL and publishable key

1. In your Supabase project, go to **Project Settings → Data API**. Copy the **Project URL** — this is
   `NEXT_PUBLIC_SUPABASE_URL`.
2. Go to **Project Settings → API Keys**. Copy the **publishable** (or `anon`) key — this is
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. It's safe to expose in the browser; RLS is what actually protects
   your data.
3. On the same page, copy the **service role** key — this is `SUPABASE_SERVICE_ROLE_KEY`. **This key bypasses
   all security rules.** Never put it in a `NEXT_PUBLIC_` variable, never commit it, and never import it from
   client-side code. It's only used by `scripts/seed.ts`.

Copy `.env.example` to `.env.local` and fill in the four values (the fourth, `NEXT_PUBLIC_APP_URL`, is just your
app's own base URL — `http://localhost:3000` locally).

---

## 3. Which values go in Vercel Environment Variables

In your Vercel project: **Settings → Environment Variables**.

| Variable | Environments | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview, Development | Safe to expose |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Production, Preview, Development | Safe to expose |
| `SUPABASE_SERVICE_ROLE_KEY` | Production only (and only if you run the seed script via a Vercel-hosted job — most teams run it locally instead) | **Never** mark this "Expose to Browser"; never add a `NEXT_PUBLIC_` version |
| `NEXT_PUBLIC_APP_URL` | Production, Preview, Development | Match each environment's real URL |

---

## 4. Run the migrations

The SQL files live in `supabase/migrations/`, numbered in the order they must run:

- `0001_tables.sql` — all 9 tables
- `0002_indexes.sql` — indexes on foreign keys and filter columns
- `0003_functions.sql` — helper functions, triggers, and the two RPCs (`create_church_with_host`,
  `submit_lesson_draft`)
- `0004_rls.sql` — enables Row Level Security and adds every policy

**Easiest way (no CLI required):** open your Supabase project → **SQL Editor** → paste the contents of each
file in order (0001, then 0002, then 0003, then 0004) → click **Run** for each one.

**If you use the Supabase CLI:** `supabase link` your project, then `supabase db push`.

`0003_functions.sql` creates a `private` schema for an internal helper function. **Do not** add `private` to
**Project Settings → Data API → Exposed schemas** — it must stay unreachable from outside the database.

---

## 5. Seed the sample data

This populates the same sample churches/speakers/lessons used by the original prototype, so the Lessons
Library, Lesson Detail, and Church Archive pages have something to show.

```bash
npm run seed
```

Requires `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`. Safe to re-run — it
upserts rows keyed on a deterministic id, so it won't create duplicates. All seeded rows are marked
`is_demo = true`.

**This step is required** for links from the still-mocked pages (homepage, Journey, Story, etc.) into the
Lessons Library to resolve, since those links use the same lesson `slug` values the seed script preserves.

---

## 6. Configure email confirmation

By default, new Supabase projects require users to confirm their email before they get a session.

**For local testing**, the simplest option is to turn this off: **Authentication → Providers → Email → Confirm
email → off**. Signup will then log the user in immediately.

**For production**, leave email confirmation **on** and instead:

1. Go to **Authentication → Emails → Confirm signup** and replace the link in the template with:
   ```
   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
   ```
1b. Do the same for **Authentication → Emails → Reset Password** (used by the "Forgot password?"
   flow on `/login`), replacing its link with:
   ```
   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery
   ```
   Both templates point at the same `/auth/confirm` route -- it branches on `type` to send
   signup confirmations to the user's dashboard and recovery links to `/reset-password`.
2. Go to **Authentication → URL Configuration** and set:
   - **Site URL**: your real production domain, e.g. `https://your-app.vercel.app`
   - **Redirect URLs** (allow list), add all of:
     - `http://localhost:3000/**` (local dev)
     - `https://*.vercel.app/**` (Vercel Preview deployments — the URL changes per branch/PR, so a wildcard is
       required)
     - `https://your-production-domain.com/**` (your real production domain)

With this configured, the flow is: user signs up → sees "check your email" → clicks the link → lands on
`/auth/confirm` → gets signed in → a Host with no church yet is sent to **Complete Church Setup**
(`/onboarding/church`); everyone else goes to their dashboard.

---

## 7. Test signup

1. Run `npm run dev`, visit `/signup`.
2. Try both account types:
   - **Kingdom Member**: after confirming (or immediately, if confirmation is off), you land on `/dashboard`.
   - **Church Host**: you're sent to `/onboarding/church` to create your church, then land on
     `/host-dashboard`.
3. Check the `profiles` table in the Supabase Table Editor — a row should exist with your `account_type`.

---

## 8. Test lesson submission

1. Sign in as a Church Host who has completed church setup.
2. Go to `/capture`, fill in the required fields, and provide at least one content source (Notes, Video,
   Audio, Slides, Document link, or Transcript).
3. Submit. You should land on a success screen linking to the new lesson.
4. Check the `lessons` table — the new row should have `status = 'draft'`.

---

## 9. Publish a lesson

1. Click **View Draft & Publish** from the success screen (or navigate to `/lessons/<slug>` while signed in as
   that lesson's host).
2. Because the lesson is still a draft, you'll see a **"This lesson is a draft"** banner with a **Publish
   Lesson** button (only the host who manages that church sees this — a public visitor hitting the same URL
   gets a normal "not found").
3. Click it. The lesson's `status` flips to `published` and it now appears in `/lessons` and the church's
   `/churches/<slug>` archive page for everyone.

---

## 10. Redeploy the `Production` branch as a Vercel Preview

1. In Vercel, open the project → **Deployments**.
2. Find the latest deployment for the `Production` branch (or push a new commit to it).
3. Use **Redeploy** (or let the new push trigger a build) — Vercel will build a **Preview** deployment for
   the `Production` branch automatically, since only `main` is configured as the Production environment.
4. Make sure the Preview environment's env vars (Section 3) are set, and that its URL is covered by the
   `https://*.vercel.app/**` entry in Supabase's Redirect URLs (Section 6) so auth confirmation links work on
   that preview.

---

## What's still mocked

Journey, Quest, Leaderboard, Testimony, Kingdom Scroll, Story, Characters, Episodes, OpenAI, Higgsfield, and
Email remain fully mocked (localStorage + `/data`), unchanged by this milestone.

# Isolated QA Supabase Project — Setup Instructions

> **SUPERSEDED (2026-07-21).** After this document was written, the explicit decision was made to
> use the existing shared Supabase project for QA instead of creating an isolated one, because the
> project is pre-launch and has no real users/churches/financial records yet — see
> `docs/QA_SHARED_DATABASE.md` for the current plan and environment classification. This document
> is kept for reference (e.g. if isolation is revisited post-launch) but does not describe the
> current approach — do not follow it without re-confirming that decision has changed again.

**Why this exists (historical):** Vercel inspection (2026-07-21) confirmed every current Supabase environment
variable is scoped to "Production and Preview" with no branch override, so the `Production` git
branch and `main` currently share the same Supabase project and credentials. QA user/data
provisioning must not run against that shared project. This document is the exact, no-secrets-shown
procedure for standing up an isolated QA project before any provisioning happens.

This document does not run migrations, does not change any current Vercel variable, does not
provision users, and does not push or deploy anything. It is instructions for you to execute by
hand in the Supabase and Vercel dashboards / your local terminal.

---

## 1. Every Supabase-related environment variable the application actually uses

Found by grepping every `process.env.*` reference under `app/`, `components/`, `context/`, `lib/`,
`services/`, `scripts/`, and `proxy.ts`.

| Variable | Required by | Where it's read | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Deployed app + all scripts | `lib/supabase/env.ts` (`getSupabasePublicEnv`, `getSupabaseAdminEnv`) | Public by design, shipped to the browser. Format `https://<project-ref>.supabase.co`. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Deployed app | `lib/supabase/env.ts` (`getSupabasePublicEnv`) | Public/anon key. Safe to expose; RLS is the actual boundary. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Local scripts only** (`scripts/seed.ts`, `scripts/qaSeed.ts`) via `lib/supabase/admin.ts` | Never read by any deployed route, page, Server Action, or `proxy.ts` | **Confirmed by grep: no file under `app/`, `components/`, or `services/` imports `createAdminClient`/`lib/supabase/admin`.** The deployed runtime does not need this variable at all — see §6. |
| `NEXT_PUBLIC_APP_URL` | Documented in `.env.example`/`docs/SUPABASE_SETUP.md` | **Not currently read anywhere in application source** (confirmed by grep — zero matches outside docs/env files) | Still worth setting per the documented convention (harmless, future-proofing, and Supabase's own "Site URL"/redirect-URL dashboard config depends on knowing each environment's real URL even though the Next app itself doesn't read this var yet). |

No other Supabase-specific variables exist in the codebase (no storage bucket name overrides, no
separate DB connection string, no custom JWT secret reference — the app only ever talks to Supabase
through `@supabase/ssr`/`@supabase/supabase-js` using the two public values above, or the
service-role key for local scripts).

---

## 2. Migrations 0001–0035 — inventory and ordering

Confirmed: exactly 35 files, numbered `0001`–`0035` with **no gaps and no duplicate numbers**
(verified programmatically). Apply in ascending numeric order — every migration only references
objects created by an earlier-numbered one.

```
0001_tables.sql                              0019_story_engine.sql
0002_indexes.sql                             0020_events.sql
0003_functions.sql                           0021_admin_completion.sql
0004_rls.sql                                 0022_church_experiences.sql
0005_lesson_thumbnails.sql                   0023_church_experience_registration_rpcs.sql
0006_lesson_media_review_fields.sql          0024_church_experience_walk_ins.sql
0007_lesson_editing.sql                      0025_church_experience_ownership_protection.sql
0008_lesson_journeys.sql                     0026_church_experience_journey_sync.sql
0009_church_memberships_manager_read.sql     0027_credit_wallets_ledger.sql
0010_church_profile_fields.sql               0028_credit_wallet_rpcs.sql
0011_church_invites.sql                      0029_credit_requests.sql
0012_church_members_profile_read.sql         0030_credit_request_rpcs.sql
0013_church_member_count_sync.sql            0031_experience_credit_costs.sql
0014_lesson_questions.sql                    0032_progression_schema.sql
0015_experiences_catalog.sql                 0033_progression_award_rpcs.sql
0016_lesson_documents_storage.sql            0034_progression_trigger_rename.sql
0017_lesson_requests.sql                     0035_wallet_reconciliation_diagnostic.sql
0018_testimonies.sql
```

(`0018` and `0019` list out of order in a plain directory listing on some filesystems because of
how `ls`/`Glob` sort — the filenames themselves are correctly numbered; apply strictly by the
numeric prefix, not directory order.)

Two migrations do more than plain SQL DDL and need to succeed for the app to work correctly:

- **`0003_functions.sql`** creates a `private` schema (for `private.is_church_manager` and the
  internal progression-award function). **After running migrations, do not add `private` to
  Supabase Project Settings → Data API → Exposed Schemas** — it must stay unreachable from the
  public API, by design.
- **`0005_lesson_thumbnails.sql`** and **`0016_lesson_documents_storage.sql`** each create a
  Storage bucket (`lesson-thumbnails`, `lesson-documents`) and their RLS policies via
  `insert into storage.buckets ...` — both are self-contained in the migration SQL; no separate
  manual bucket-creation step in the dashboard is needed.

---

## 3. Creating the new QA project and applying migrations

### 3a. Create the project

1. Go to [supabase.com](https://supabase.com), sign in, **New Project**.
2. Name it clearly as QA, e.g. `qftk-qa`. Pick any region. Set a database password (save it in
   your own password manager — it is separate from anything this repo needs, only used if you ever
   connect via `psql`/direct Postgres connection string).
3. Wait for provisioning to finish.

### 3b. Link and apply migrations via the Supabase CLI (recommended — 35 files by hand in the SQL editor is impractical and error-prone)

Run these from the repo root, in your own terminal (not something I run for you):

```bash
# Install the CLI if you don't have it
npm install -g supabase

# Authenticate (opens a browser)
supabase login

# Link this repo to the NEW QA project specifically -- it will prompt for the project's
# database password (the one you set in 3a.2), not shown or logged to a file by the CLI.
supabase link --project-ref <new-qa-project-ref>

# Apply all 35 migrations in order in one step
supabase db push
```

`supabase db push` applies every file under `supabase/migrations/` that the target project hasn't
already applied yet, in filename order — on a brand-new empty project this means all 35, in the
correct `0001`→`0035` order automatically. It records what's applied in the project itself, so
it's safe to re-run later (a future `git pull` that adds `0036_...` would apply only the new file).

### 3c. Fallback: manual SQL Editor (if you don't want the CLI)

Open the QA project → **SQL Editor** → paste and **Run** each file's contents in order, `0001`
through `0035`, one at a time, waiting for each to succeed before the next (this exactly mirrors
what `docs/SUPABASE_SETUP.md` §4 already documents for the first four files — just continue through
all 35 instead of stopping at `0004`).

### 3d. After migrations succeed (dashboard config, not SQL — do this before real testing)

These aren't asked for in this task, but are required for `/signup` and `/login` to work
end-to-end on the new project, per `docs/SUPABASE_SETUP.md` §6 — flagging them so you don't hit a
confusing dead end later:

- **Authentication → Providers → Email → Confirm email**: turn **off** for the fastest QA
  iteration (signup logs the user in immediately, no inbox needed), or leave **on** and set the
  confirm-signup email template to
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email` if you want to exercise the
  real confirmation flow.
- **Authentication → URL Configuration → Site URL** and **Redirect URLs**: add the QA deployment's
  real URL (`https://production.quest4thekingdom.com/**`) and `http://localhost:3000/**`.
- Confirm **Project Settings → Data API → Exposed Schemas** does **not** include `private` (§2
  above).

### 3e. Do not run any of this yet

Per your instructions, nothing in §3 has been executed — this is the procedure for you to follow
once you're ready, not something already done.

---

## 4. Branch-specific Vercel variables for the `Production` Preview branch (exact case)

Vercel supports scoping a variable to Preview deployments of one specific branch, which takes
precedence over a broader "Preview" (all branches) value of the same key — this lets `Production`
get the new QA project's credentials without touching what `main`/other branches currently see.

**In the Vercel dashboard**, for this project → **Settings → Environment Variables**:

For each of the four variables below: click **Add New** (or **Edit** if a broad "Preview" value
already exists and you're adding a branch override alongside it — Vercel allows both to coexist,
the branch-specific one wins for that branch):

1. **Key**: the variable name (see table below).
2. **Value**: paste the new QA project's value (you'll do this yourself — I never see or ask for
   these).
3. **Environments**: check **Preview** only (leave Production and Development unchecked for these
   QA-scoped entries).
4. Once **Preview** is checked, Vercel reveals a **"Branch"** field — enter exactly:
   ```
   Production
   ```
   (capital `P`, matching this repo's actual git branch name exactly — Vercel branch matching is
   case-sensitive, and the local branch here is `Production`, not `production`.)
5. **Save**.

| Key | Value source |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | New QA project's Project URL (Project Settings → Data API) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | New QA project's publishable/anon key (Project Settings → API Keys) |
| `SUPABASE_SERVICE_ROLE_KEY` | Only add this if you decide to keep it in Vercel at all — see §6's recommendation to *not* set it there and instead keep it purely local. If you do add it, it must point at the **new QA project's own** service-role key, never the shared one. |
| `NEXT_PUBLIC_APP_URL` | `https://production.quest4thekingdom.com` |

After saving, the next deployment of the `Production` branch (a new commit, or a manual redeploy)
will pick up these branch-scoped values; `main` and any other branch continue seeing whatever
broader "Production and Preview" values already exist, completely unchanged.

**Nothing in this section has been done** — these are the exact steps for you to perform; I have
not opened or modified any Vercel setting.

---

## 5. Verifying it worked (after you've done §3 and §4, before any provisioning)

1. Trigger a redeploy of the `Production` branch (or push a commit to it) so the new branch-scoped
   env vars take effect.
2. Visit `https://production.quest4thekingdom.com/signup`, and confirm the page loads without a
   "Supabase is not configured" error.
3. In the new QA Supabase project's Table Editor, confirm the `profiles`/`churches` tables exist
   and are empty (proof you're looking at the new project, not the shared one).
4. Only then run `npm run qa:seed:dry` with `.env.qa.local` pointed at the new project — its
   `QA_SUPABASE_PROJECT_REF` guard will refuse to run if the ref doesn't match
   `NEXT_PUBLIC_SUPABASE_URL`, which is exactly the fail-closed check for this scenario.

---

## 6. Security finding: `SUPABASE_SERVICE_ROLE_KEY` scoped to all Preview deployments

**Finding:** Vercel inspection shows `SUPABASE_SERVICE_ROLE_KEY` currently scoped to "Production
and Preview" — meaning it is injected into the server runtime of **every** Preview deployment
(every branch, every PR build), not just `main`. That key bypasses RLS entirely.

**Why this matters:** RLS is this application's real authorization boundary (church isolation,
wallet security, progression security, host/member role boundaries all depend on it — see
`CLAUDE.md`). A key that bypasses it, present in every Preview deployment's environment, means any
bug, debug endpoint, dependency compromise, or verbose error message in *any* branch's Preview
build has a path to full, unrestricted read/write access to the real database — not scoped to that
branch's own data, because today there is no branch-specific database at all.

**Confirmed by code audit:** the deployed Next.js application itself never reads this variable.
`lib/supabase/admin.ts`'s `createAdminClient()` — the only thing that touches
`SUPABASE_SERVICE_ROLE_KEY` — is imported exclusively by `scripts/seed.ts` and the new
`scripts/qaSeed.ts`, both standalone local scripts, never by any `app/`, `components/`, or
`services/` file reachable from a live request. So the deployed runtime does not need this
variable present at all today.

**Recommended safe final arrangement (not implemented — for your decision):**

1. **Primary recommendation:** remove `SUPABASE_SERVICE_ROLE_KEY` from Vercel entirely (all
   environments). Since no deployed code path reads it, this closes the exposure completely with
   zero functional loss — `npm run seed` / `npm run qa:seed` are already meant to be run locally
   (or from a controlled CI job with its own secret store), never from the Vercel runtime.
2. **If you want it available in Vercel for some future serverless/admin use case instead:** at
   minimum, remove it from the general "Preview" scope and only add it back as a **branch-specific
   Preview override** (same mechanism as §4) — and even then, point it at the **new, isolated QA
   project's** service-role key, never the credential that has power over the shared/eventual-live
   database. That way a compromised or buggy Preview build can, at worst, corrupt disposable QA
   data.
3. Either way, once the isolated QA project exists, the shared project's service-role key should
   stop being reachable from *any* Preview deployment — only from `main`'s Production environment,
   if it's ever legitimately needed there (audit whether it's needed there too, by the same
   grep-for-`createAdminClient` method used above, before assuming it is).

I have not changed this or any other current Vercel variable — this is a finding and
recommendation only, per your explicit instruction.

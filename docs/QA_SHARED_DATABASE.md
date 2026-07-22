# QA on the Shared Pre-Launch Development and QA Database

## Environment classification

The existing Supabase project — the one `NEXT_PUBLIC_SUPABASE_URL` currently points at for both
the `Production` branch's deployed Preview and `main` — is the **shared pre-launch development and
QA database**.

It is:

- **Not** an isolated QA database (there is no separate project).
- **Not** a live customer database.
- **Not** the final production database.

It is the one database the `Production` git branch and `main` currently both use, by explicit,
accepted decision, for the pre-launch period only — accepted specifically because, as of this
decision (2026-07-21), the project has no real platform users, churches, customers, or real
financial records. This classification must be re-confirmed before real users are ever accepted
(see "Pre-launch requirement" below) and must not be assumed to still hold true indefinitely.

If this changes (real users start signing up, or an isolated QA project is created later), every
guard described below (`QA_SUPABASE_PROJECT_REF`, `QA_ENVIRONMENT`) needs to be re-evaluated
against the new reality, not just left as-is.

## Approved synthetic QA accounts

Five accounts, all on the one approved domain `qa.quest4thekingdom.com`:

| Label | Email | Role |
|---|---|---|
| Church A Host | `qa.church-a-host@qa.quest4thekingdom.com` | `account_type=host`, manages Church A |
| Church A Member | `qa.church-a-member@qa.quest4thekingdom.com` | `account_type=member`, joined Church A only |
| Church B Host | `qa.church-b-host@qa.quest4thekingdom.com` | `account_type=host`, manages Church B |
| Church B Member | `qa.church-b-member@qa.quest4thekingdom.com` | `account_type=member`, joined Church B only |
| Platform Administrator | `qa.platform-admin@qa.quest4thekingdom.com` | `is_platform_admin=true` |

Two synthetic churches: **"Quest for the Kingdom QA -- Church A"** and **"Quest for the Kingdom QA
-- Church B"**, both `churches.is_demo = true`.

## How QA/test data is marked

The safest mechanism the existing schema actually supports, used consistently:

- **Auth users**: `user_metadata.qa_seed = true` and `user_metadata.qa_label = "<identity key>"`
  (e.g. `"church-a-host"`), set only by `scripts/qaSeed.ts`'s `admin.createUser()` call. Both
  `qaSeed.ts` and `qaCleanup.ts` refuse to touch any account at one of the five approved emails
  that doesn't carry these exact markers — an "identity collision" fails closed rather than
  reusing/deleting an unidentified account.
- **Churches**: `is_demo = true` (the column the schema already provides for exactly this) plus the
  unmistakable name prefix `"Quest for the Kingdom QA -- "`. `qaCleanup.ts` additionally verifies
  `created_by` is one of the five approved QA profile ids before treating a matching-named church
  as QA data.
- **Everything else** (memberships, wallets, journeys, etc.) is identified transitively — a row
  belongs to QA data only if it's reachable from one of the five QA profile ids or two QA church
  ids via the schema's own foreign keys, never by guessing from a name or date range.
- **Global reference/catalog data is never touched**: `badge_definitions`,
  `progression_award_rules`, `progression_level_thresholds`, the `experiences` catalog,
  `characters`, `episodes` have no foreign key to any QA-owned row and neither script reads or
  writes them.

## Running provisioning (`scripts/qaSeed.ts`)

```
npm run qa:seed:dry     # read-only: prints the plan, mutates nothing
npm run qa:seed         # --execute: creates/reuses the five accounts + two churches + baseline wallets
```

Both require `.env.qa.local` (gitignored — copy `.env.qa.example`) with:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` —
  the existing shared project's real values.
- `QA_SUPABASE_PROJECT_REF` — must match the project ref embedded in the URL above, or the script
  refuses to run.
- `QA_ENVIRONMENT=shared-prelaunch-dev-qa` — exact literal required.
- `QA_EMAIL_DOMAIN=qa.quest4thekingdom.com` — exact literal required (hard-locked in code, not
  just documented).
- `ALLOW_QA_SEED=true` — required for `--execute` only.
- The five `QA_*_PASSWORD` values.

`npm run qa:seed:dry` additionally reports, read-only:

- A required-table check (`profiles`, `churches`, `church_memberships`, `member_wallets`,
  `church_wallets`, `credit_ledger_entries`) — supports confirming migrations 0001–0035 are
  applied without needing separate dashboard access.
- A count of total Auth users on the project vs. on the approved QA domain, with any other domains
  present shown redacted (domain only) — supports confirming there are no unexpected real users,
  every time the script runs, not just once.

Scope note: this first pass covers the five identities, two isolated churches, roles, and a
baseline wallet state (one member funded, one at zero; one church wallet funded, one at zero).
Lessons/journeys/experiences/progression/testimony synthetic-data matrices are not yet
implemented — `qaSeed.ts` prints this gap explicitly every run rather than overclaiming coverage.

## Running cleanup (`scripts/qaCleanup.ts`)

**Do not run this until QA testing is complete and before the platform accepts real users.**

```
npm run qa:cleanup:dry   # read-only: itemized per-table manifest of what would be removed
npm run qa:cleanup       # --execute: removes it, then re-verifies zero rows remain
```

`--execute` requires two separate confirmations beyond the shared project/environment/domain
guards, deliberately distinct from `qaSeed.ts`'s guard so approving seeding never accidentally
approves cleanup:

- `ALLOW_QA_CLEANUP=true`
- `CONFIRM_QA_CLEANUP=yes-delete-qa-data`

Mechanically: the schema cascades broadly from `churches.id` and `profiles.id` (verified against
every migration's `on delete cascade`/`set null` clause). Deleting the two QA churches, then the
five QA auth users, is sufficient for Postgres to correctly remove every dependent row — wallets,
ledger entries, progression summaries/awards/log, lessons and their media/hosts/questions,
journeys and journey items, Experiences/occurrences/registrations (including waitlisted rows —
"waitlisted" is a status value on `church_experience_registrations`, not a separate table),
testimonies and testimony likes — without the script hand-rolling ~20 individual deletes (which
would just be a worse-audited reimplementation of what the FK graph already guarantees correctly).
`admin_moderation_log` rows referencing a QA actor are preserved with `actor_id` set to `NULL`
(the schema's own audit-trail design), never deleted.

The script computes the same itemized manifest before deleting (the dry-run report) and again
after deleting (verification), and fails loudly if anything expected to be gone still has rows.

## Pre-launch requirement

**All synthetic QA users and related data must be removed and verified before the platform accepts
real users.** After running `npm run qa:cleanup`, confirm all of the following before launch:

- [ ] The five QA Auth users no longer exist.
- [ ] The two synthetic churches ("Quest for the Kingdom QA -- Church A/B") no longer exist.
- [ ] No QA wallet or credit ledger records remain.
- [ ] No QA progression, badge, lesson, journey, Experience, registration, testimony, or reward
      records remain.
- [ ] Required reference/configuration data (badge definitions, progression thresholds/rules, the
      Experiences/characters/episodes catalogs) and the schema itself are intact and unmodified.
- [ ] No migration history was removed or altered — `supabase/migrations/0001`–`0035` are exactly
      as applied, nothing rolled back.

`qa:cleanup`'s own post-delete verification step covers the first four automatically (it fails
loudly, non-zero exit, if any of them aren't true); the last two are a manual dashboard/repo check
since cleanup never touches migrations or reference data in the first place.

## Security note (carried forward — still applies)

`SUPABASE_SERVICE_ROLE_KEY` for this project is currently scoped to "Production and Preview" in
Vercel, exposing it to every Preview deployment (any branch), even though no deployed route/action/
page reads it (only local scripts do — see `docs/QA_ISOLATED_PROJECT_SETUP.md` §6 for the full
finding and recommendation, which still applies unchanged to this shared project). This has not
been fixed, per instruction not to change Vercel variables in this pass.

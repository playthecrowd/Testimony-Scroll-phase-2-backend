# Phase 11.3 Audit — Points, XP, Levels, Badges, Trophies & Leaderboards

Scope: the automatic progression system on top of Phase 11.1/11.2's wallet/credit foundation —
Points, XP, Levels, Badges (including Trophies as a badge category), and a Global/My Church
leaderboard read model, wired to real, already-verified platform events. No Rewards catalog,
Square, or new UI/page routes — those remain later Phase 11 stages, per this phase's scope
(the existing Phase 11 implementation plan's Phase 11.3 outline, since no new detailed brief was
given this time).

Migrations `0032`–`0033`, written and dry-run-verified against the linked Supabase project
(`ytnftubajizhuylhmsib`). At the time this phase's implementation was first committed, they had not
been pushed live — the owner chose to hold off until that was separately confirmed. **That
confirmation has since been given explicitly, and migrations `0032`–`0033` are now live on the
linked project**, alongside a fresh migration-status audit confirming `0027`–`0031` were already
live from the prior Phase 11.2 verification step. See §11 "Database deployment verification" below
for the full record. The rest of this document (§1–§10) is left as the accurate record of what
this phase's *implementation* commit (`f13ec98`) covered at that time.

## 1. Schema

Six new tables (migration `0032`): `progression_award_rules`, `progression_level_thresholds`,
`member_progression_summaries`, `progression_award_log`, `badge_definitions`,
`member_badge_awards`. Two views (migration `0033`): `leaderboard_global`, `leaderboard_my_church`.
No existing table is altered.

- **Points and XP are independent columns** on `member_progression_summaries`
  (`points_total`, `xp_total`), per the owner-approved decision (spec §34.1) — Points is the
  lifetime, non-spendable ranking score; XP only ever feeds `current_level`.
- **Trophies are a `badge_definitions.category = 'trophy'` value**, not a separate table (spec
  §15/§35 entry 3) — the one seeded v1 trophy is "Kingdom Scroll Contributor."
- **Fixed event types, no open rule engine** (explicit brief instruction, spec §11/§12):
  `progression_award_rules.event_type` is a `check`-constrained enum with exactly five values,
  matched 1:1 to the five real platform events identified in the Phase 11A audit as genuinely
  verifiable today.

## 2. Award rules and levels

`progression_award_rules` seeded with five rows: `lesson_studied` (10 points, XP read from the
triggering lesson's own `xp_reward` column, capped at `xp_reward_ceiling = 300`),
`experience_completed` (15/15), `testimony_submitted` (10/10), `testimony_church_approved`
(15/15), `testimony_kingdom_scroll_published` (25/25). These are conservative starting values,
data not code, tunable by a platform admin later without a deploy (RLS: public read, admin-only
write via `profiles.is_platform_admin`, matching every other admin-only table in this app).

`progression_level_thresholds` seeded with 10 levels (0, 50, 120, 220, 350, 520, 730, 990, 1300,
1700 XP). `member_progression_summaries.current_level` is a reconciled cache — recomputed from
this table on every XP-changing event inside `private.award_progression_event`, never
independently incremented.

**Owner decision §34.2 implemented exactly as approved**: `lesson_studied`'s XP amount is
`least(lessons.xp_reward, xp_reward_ceiling)`, computed inside `private.award_progression_event`
— an unrestricted host-entered `xp_reward` value can never translate into unlimited XP. The
ceiling (300) is a first, conservative starting value; the Phase 11A spec named a required
spot-check of real production `lessons.xp_reward` values before finalizing this number (§33) —
this is called out explicitly in "Known limitations" below since it has not been performed against
live production lesson data in this sandbox.

## 3. Badges and trophies

Five v1 badges seeded (`badge_definitions`), each a `single_event`-requirement, "first time"
milestone mapped to one of the five real event types: **First Lesson Completed**
(`lesson_studied`), **First Experience Completed** (`experience_completed`), **First Testimony
Submitted** (`testimony_submitted`), **Church-Approved Testimony** (`testimony_church_approved`),
**Kingdom Scroll Contributor** (`testimony_kingdom_scroll_published`, `category = 'trophy'`).

**Deliberate v1 simplification from the original spec**: `member_badge_awards` uses
`unique(member_id, badge_id)` — a member can earn each named badge at most once ever, not once per
lesson/Experience/testimony. The Phase 11A spec's terminology section allowed for a
per-lesson-repeatable badge instance "where meaningful," modeled on the old mock badge system's
per-lesson badges — but all five concrete v1 badges named in the brief are genuinely "first ever"
milestones, so the simpler one-time-per-member constraint is both correct for what's actually being
built and a real database-level duplicate-award guard (not just an application check). This is
documented here as a deliberate scope decision, not an oversight.

Revocation is supported (`revoked_at`/`revocation_reason`, never a hard delete, matching this
project's standing convention) but no admin RPC exists yet to actually perform a revocation or a
manual award — see "Known limitations."

## 4. The award-processing entry point

`private.award_progression_event` (migration `0033`) is the single place every point, XP, level,
and badge computation happens — mirroring `private.promote_next_waitlisted` (Phase 10.1) and
`private.apply_refund` (Phase 11.2)'s exact trust model: never granted to `authenticated`/`anon`,
safe only because its five real callers are triggers firing on an already-verified column
transition, never directly reachable.

Sequence: look up the active rule for the event type (return silently if none/inactive) → compute
points/XP (with the lesson-XP-ceiling special case) → **insert into `progression_award_log`,
catching `unique_violation`** — this insert-or-bail-out step is the actual duplicate-award
guard, enforced by the table's own `unique(member_id, event_type, source_row_id)` constraint, not
just an application-level check — → lock (`for update`) and lazily create the member's progression
summary row → update cumulative points/XP and re-derive the level from
`progression_level_thresholds` → award any matching, not-yet-held `single_event` badge via
`insert ... on conflict (member_id, badge_id) do nothing`.

## 5. The five real triggers

| Trigger | Table | Fires on | Reads |
|---|---|---|---|
| `award_progression_on_lesson_studied_trigger` | `lesson_journeys` | `current_stage` transition into `'studied'` | `new.user_id`, `new.lesson_id` |
| `award_progression_on_experience_completion_trigger` | `church_experience_registrations` | `completion_status` transition into `'completed'` | `new.profile_id`; `experience_id` via a join through `church_experience_occurrences` |
| `award_progression_on_testimony_submitted_trigger` | `testimonies` | every insert | `new.submitted_by` |
| `award_progression_on_testimony_church_approval_trigger` | `testimonies` | `church_status` transition into `'approved'` | `new.submitted_by` |
| `award_progression_on_testimony_kingdom_scroll_publication_trigger` | `testimonies` | the combined condition (`church_status='approved' AND platform_status='approved' AND visibility='public'`) becoming newly true | `new.submitted_by` |

**No existing application code needed to change at all** to get any of this — `markStudiedComplete()`
(`services/supabase/journeys.ts`), the Experience completion flow, and every testimony
submission/approval path already perform exactly the column transitions these triggers observe.
This mirrors the same "extend by trigger, not by touching the calling code" pattern used
successfully for Experience credit charging in Phase 11.2.

**Deliberately not implemented this phase** (see the Phase 11A audit's own findings, carried
forward unchanged): "Reflection completed," "Event attended" (no attendance model exists on
`events`), "Story contribution featured," and "Community milestone" — none of these map to a real,
already-existing, verifiable database event today. Building a trigger for any of them now would be
speculative schema for data that doesn't exist yet.

## 6. Leaderboard read model

Two views, both selecting only `profile_id`/`full_name`/`points_total`/`xp_total`/`current_level`/
`rank` — **never email or any other `profiles` column** (spec §17). Ranking is by lifetime Points
(never XP or credits), with a stable earned-first tiebreak (`created_at ascending`), matching spec
§17 exactly.

- **`leaderboard_global`**: every non-opted-out (`leaderboard_opt_out = false`) member, ranked
  platform-wide.
- **`leaderboard_my_church`**: scoped to only the churches the *calling* member actually belongs
  to, via an `auth.uid()` filter evaluated at query time — this works correctly regardless of the
  view's own ownership/RLS-bypass status, since the isolation is enforced by the view's own
  `WHERE` clause, not by relying on `member_progression_summaries`' restrictive per-row RLS (which
  the view, like any view, does not automatically re-apply for a different querying context).

**Deferred, per spec §17/§33**: Lesson-scoped, Experience-scoped, Seasonal, and All-time-as-a-
distinct-scope leaderboards. This schema tracks one cumulative points/XP total per member, not a
per-lesson or per-experience score — there is no real data to rank a "top scorers for lesson X"
view by yet, and building one now would be speculative. "All-time" is effectively the same as
"Global" given nothing here resets periodically yet (no season concept exists).

## 7. Service layer

`services/supabase/progression.ts` (new) — read-only: `getMyProgressionSummary`,
`getMemberProgressionSummary`, `getAllBadgeDefinitions`, `getMyBadgeAwards`,
`getGlobalLeaderboard`, `getMyChurchLeaderboard`. No function in this file can write a point, an
XP amount, a level, or a badge — every award happens exclusively inside the database triggers
above. `getMyProgressionSummary` returns `null` for a member who has never triggered a real event
yet (no lazy-create here, unlike wallets — a progression summary is created automatically, inside
`private.award_progression_event`, the moment the member's first real event fires; `null` means
"treat as 0 points, 0 XP, level 1," not an error).

`lib/progressionLevels.ts` (new) — `calculateLevelFromXp`, `xpToNextLevel`: pure, read-only preview
helpers mirroring `lib/experienceCredits.ts`'s precedent exactly. The database function remains the
sole authority on a member's actual `current_level`.

**Naming-collision avoidance**: the new leaderboard entry type is named
`ProgressionLeaderboardEntry`, not `LeaderboardEntry` — `types/index.ts` already has a pre-Supabase
mock `LeaderboardEntry` interface (the old `services/questService.ts` quest-score shape,
`{rank, userId, userName, userAvatarUrl, score, time, date, lessonId}`). This collision was
predicted in the Phase 11A audit (§2d.2) and was actually hit while building this service layer
(TypeScript's structural typing initially accepted the mismatched shape until a stricter check
caught it) — confirming the audit's concern was well-founded, not hypothetical.

## 8. Tests

- `tests/progressionLevels.test.ts` (new) — 7 pure-function unit tests for
  `calculateLevelFromXp`/`xpToNextLevel`.
- `tests/progressionAwards.test.ts` (new) — 25 structural tests: schema shape and constraints for
  all six tables, RLS policy shape (public-read/admin-write catalogs; own-row/church-manager/admin
  scoping on summaries and badge awards; member-or-admin-only on the audit log, explicitly *not*
  church-manager-visible), `private.award_progression_event`'s exposure, XP-ceiling clamp,
  duplicate-award guard, row-locking and level re-derivation, badge-award idempotency, each of the
  five triggers' transition-only firing condition, both leaderboard views' no-email and
  `auth.uid()`-scoping guarantees, and a grep-based check that no application code writes to any
  progression table directly.
- All Phase 1–11.2 tests re-verified unaffected. **224/224 total passing** (192 before this phase +
  32 new).

## 9. Security review

- **No open rule engine**: every event type, point/XP amount, and badge-requirement mapping is
  fixed, database-backed, and admin-editable only through direct `is_platform_admin`-gated RLS —
  never a client-configurable rule.
- **Forged events impossible**: every trigger reads its event data from the actual, already-
  persisted row (`new.*`) that fired it — a client cannot claim "I completed this" without the
  real, verified column transition (`current_stage`, `completion_status`, `church_status`,
  `platform_status`/`visibility`) actually having happened, gated by each table's own pre-existing
  authorization (host/admin-only for Experience completion marking, church/platform-admin-only for
  testimony status columns via `protect_testimony_status_columns`, 0018).
- **Duplicate-award prevention is database-level, not just application-level**: both
  `progression_award_log`'s `unique(member_id, event_type, source_row_id)` and
  `member_badge_awards`' `unique(member_id, badge_id)` are real constraints; `private.
  award_progression_event` relies on catching the resulting `unique_violation`/using `on conflict`
  rather than a racy "check then insert."
- **Race conditions**: the member's `member_progression_summaries` row is locked (`for update`)
  before its cumulative points/XP/level are changed, exactly matching every prior Phase 11 RPC's
  pattern.
- **No client balance/level/badge manipulation**: no RLS policy grants `authenticated` a direct
  INSERT/UPDATE/DELETE on any of the six new tables (except the admin-only catalog-write policies
  on `progression_award_rules`/`progression_level_thresholds`/`badge_definitions`, which are
  intentional and admin-gated) — confirmed by a structural test and a grep-based
  no-direct-application-write test.
- **Leaderboard privacy**: `leaderboard_opt_out` excludes a member from both views entirely; only
  display name, points, XP, and level are exposed — never email, never any church-private data
  beyond church membership itself (already public within a church's own roster).

## 10. Known limitations

- ~~Not pushed live~~ — **resolved**: migrations `0032`/`0033` were pushed to the linked project on
  explicit owner authorization; see §11.
- **`xp_reward_ceiling` (300) is a first, unvalidated guess** — the Phase 11A spec explicitly named
  a required step (spot-check real production `lessons.xp_reward` values, spec §33) before setting
  this number; that spot-check has still not been performed even now that live data could be
  queried. Recommend doing so before this value is relied on for real awards.
- **A `create trigger` identifier was silently truncated by Postgres's 63-byte limit** — see §11;
  the trigger is fully functional under its truncated name, but the migration source's declared
  name no longer matches what a live `pg_trigger` query returns.
- **No admin RPC exists yet for a manual badge award or revocation** (spec §19's "manual admin
  adjustments") — this phase built the automatic system only; manual admin tooling is a reasonable
  fit for Phase 11.4's UI/workflow stage instead, since it's inherently an admin-facing action with
  no meaningful "database foundation" left to build beyond what already exists (an admin can
  already `insert`/`update` `member_badge_awards`/`member_progression_summaries` as `postgres`,
  bypassing RLS, but no `SECURITY DEFINER` RPC formalizes this for a real admin session yet).
- **"Reflection completed," "Event attended," "Story contribution featured," and "Community
  milestone"** remain unimplemented — no real, verifiable trigger event exists for any of them yet
  (unchanged finding from the Phase 11A audit).
- **Lesson/Experience/Seasonal leaderboard scopes are deferred** (§6) — this schema has no
  per-lesson or per-experience score concept, only one cumulative total per member.
- **No UI consumes any of this yet** — `/badges`, `/leaderboard`, and `/rewards` still show the old
  mock data (or don't exist) until Phase 11.4 replaces them, per the standing roadmap.

## 11. Database deployment verification

Performed on explicit owner authorization, as a dedicated migration-status audit before Phase 11.4.
**This repo has exactly one linked Supabase project (`ytnftubajizhuylhmsib`); there is no separate
development database. This push modified that same real, shared project every prior phase has
used.**

**Pre-push state**: `Production` branch, clean working tree, commits `f13ec98` (Phase 11.3),
`de71257` (Phase 11.2), and `d69c928` (Phase 11.1) all confirmed present in `git log`.

**Exact pending migration list**: `npx supabase migration list` showed `0001`–`0031` with matching
local/remote entries (already live, from the Phase 11.2 verification step) and `0032`/`0033` with
an empty remote entry (pending). `npx supabase db push --dry-run` confirmed the same: **only**
`0032_progression_schema.sql` and `0033_progression_award_rpcs.sql` were pending — `0027`–`0031`
were explicitly *not* in the pending list, contrary to what an assumption (rather than a check)
might have concluded.

**Safety-review findings**: a full grep of both pending migration files for `drop `, `truncate`,
`delete from`, and unsafe `alter ... type`/`drop` statements found none — every statement in both
files is purely additive (`create table`/`index`/`trigger`/`policy`/`view`/`function`,
`alter table ... enable row level security`, `grant`/`revoke`, `insert`). No existing table is
altered or has its data touched. Seed `insert` statements have no `on conflict` guard, but this
matches this repo's own established convention for one-time schema-creation seeds (e.g. `0022`)
and is safe here specifically because Supabase's migration tracking guarantees each file runs
exactly once — this is not a claim that the inserts are safely re-runnable outside that guarantee.
Dependency order is correct: `0032` creates every table `0033`'s functions/triggers/views reference,
before `0033` runs.

**Dry-run result**: clean, listing exactly the two expected migrations, nothing unexpected.

**Push result**: both migrations applied successfully. One **NOTICE** (not an error) was raised:
`identifier "award_progression_on_testimony_kingdom_scroll_publication_trigger" will be truncated
to "award_progression_on_testimony_kingdom_scroll_publication_trigg"` — Postgres's 63-byte
identifier limit silently truncated this one trigger name. Verified live: the trigger exists under
its truncated name, is attached to the correct table (`testimonies`), and is enabled
(`tgenabled = 'O'`) — it is fully functional; only the *name* differs from what the migration
source declares. This is a real, cosmetic naming-hygiene defect introduced in Phase 11.3, harmless
to behavior, and not fixed in this verification-only step (renaming a live trigger is its own
schema change, out of scope for a verification pass) — recommended as a small follow-up migration
if exact-name clarity in `pg_trigger` ever becomes operationally important.

**Exact applied migrations**: `0032_progression_schema.sql`, `0033_progression_award_rpcs.sql`.
Post-push, `npx supabase migration list` confirmed all of `0001`–`0033` now match local and remote
exactly.

**Wallet and credit verification** (re-confirmed unaffected by this push, not re-derived from
scratch — full detail already on record in `docs/PHASE11_2_AUDIT.md` §11): `member_wallets`,
`church_wallets`, `credit_ledger_entries`, `credit_requests` all present (4/4); all 12 wallet/
credit RPCs present; both credit-related triggers (`charge_credits_on_registration_confirmation_
trigger`, `refund_registrations_on_occurrence_cancellation_trigger`) present; both Experience/
occurrence credit-cost columns present.

**Progression verification** (newly pushed, verified in full):

- All six tables (`progression_award_rules`, `progression_level_thresholds`,
  `member_progression_summaries`, `progression_award_log`, `badge_definitions`,
  `member_badge_awards`) confirmed live with the exact designed column set.
- Both leaderboard views (`leaderboard_global`, `leaderboard_my_church`) confirmed live, selecting
  only `profile_id`/`full_name`/`points_total`/`xp_total`/`current_level`/`rank` (+`church_id` on
  the church-scoped view) — **no `email` column anywhere in either view**.
- All five seeded v1 badges confirmed present with the correct `category`/`requirement_type`/
  `related_event_type` (including `kingdom-scroll-contributor` as the one `trophy`-category row).
- All five seeded `progression_award_rules` confirmed present with the correct amounts, including
  `lesson_studied`'s `xp_reward_ceiling = 300`.
- Both duplicate-award unique constraints confirmed live:
  `progression_award_log_member_id_event_type_source_row_id_key` and
  `member_badge_awards_member_id_badge_id_key`.
- All six progression functions (`award_progression_event` plus the five trigger functions)
  confirmed `security definer` with `search_path=""` locked.
- All five progression triggers confirmed present and enabled (`tgenabled = 'O'`), attached to
  their correct tables (`lesson_journeys`, `church_experience_registrations`, `testimonies` ×3) —
  including the one with the truncated name, noted above.

**RLS and permission verification**:

- RLS enabled on all six progression tables.
- `member_progression_summaries`, `progression_award_log`, `member_badge_awards`: **SELECT-only**
  policies — no INSERT/UPDATE/DELETE policy exists on any of the three, confirming direct client
  progression writes are blocked regardless of any table grant; every write is trigger-only.
- `progression_award_rules`, `progression_level_thresholds`, `badge_definitions`: public
  `SELECT` (members need to see these catalogs) plus an admin-only `ALL` policy gated directly on
  `profiles.is_platform_admin` — this is the intentional, documented exception (an admin manages
  these definitions), not a gap.
- `private.award_progression_event` confirmed to have **no** EXECUTE grant to `authenticated` or
  `anon` — only `postgres` (the function owner) — matching `private.apply_refund`/`private.
  promote_next_waitlisted`'s exact trust model.

**Final lint/typecheck/test/build results** (re-run after the push; unchanged, since no application
code changed in this step): 0 lint errors, 15 known warnings, clean typecheck, 224/224 tests
passing, successful build.

## Confirmation

- Only the expected migrations (`0032`, `0033`) were applied — `0027`–`0031` were already live from
  the prior Phase 11.2 verification step, confirmed rather than assumed.
- The linked Supabase project (`ytnftubajizhuylhmsib`) — the repository's only linked project, the
  same one every prior phase has used — was modified with explicit owner approval.
- No application deployment occurred (this step ran database migrations via the Supabase CLI only,
  never `vercel deploy` or any build/release action).
- Work remains on `Production`; nothing was merged into `main`.
- Phase 11.4 was not started.

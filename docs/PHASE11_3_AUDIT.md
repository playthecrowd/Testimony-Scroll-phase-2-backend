# Phase 11.3 Audit — Points, XP, Levels, Badges, Trophies & Leaderboards

Scope: the automatic progression system on top of Phase 11.1/11.2's wallet/credit foundation —
Points, XP, Levels, Badges (including Trophies as a badge category), and a Global/My Church
leaderboard read model, wired to real, already-verified platform events. No Rewards catalog,
Square, or new UI/page routes — those remain later Phase 11 stages, per this phase's scope
(the existing Phase 11 implementation plan's Phase 11.3 outline, since no new detailed brief was
given this time).

Migrations `0032`–`0033`, written and dry-run-verified against the linked Supabase project
(`ytnftubajizhuylhmsib`). **Not pushed live in this step** — following the same pattern established
in Phase 11.1/11.2, an actual `supabase db push` is treated as its own explicitly-authorized action,
not assumed.

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

- **Not pushed live** — migrations `0032`/`0033` are written and dry-run-verified only; a live
  push requires the same separate, explicit authorization every Phase 11 database change has
  required since Phase 11.1.
- **`xp_reward_ceiling` (300) is a first, unvalidated guess** — the Phase 11A spec explicitly named
  a required step (spot-check real production `lessons.xp_reward` values, spec §33) before setting
  this number; that spot-check has not been performed. Recommend revisiting this value once live
  data can actually be queried (i.e., once these migrations are pushed).
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

# Phase 10.1 — Experience Platform Database Foundation

Date: 2026-07-18. Database-foundation-only, per this phase's explicit instructions: no React
components, pages, routes, navigation, or dashboards were created. This document records what was
actually implemented, any deviations from `docs/PHASE10_EXPERIENCE_PLATFORM_SPEC.md` /
`docs/PHASE10_IMPLEMENTATION_PLAN.md`, and known limitations.

## Schema

Three new migrations, continuing this repo's one-migration-per-concern convention:

- **`0022_church_experiences.sql`** — the four tables (`church_experiences`,
  `church_experience_occurrences`, `church_experience_lessons`,
  `church_experience_registrations`), `churches.timezone`, all indexes, `updated_at` triggers
  (reusing `public.set_updated_at()`, defined in `0008_lesson_journeys.sql` — not redefined), and
  all RLS policies. Matches spec §10/§13 exactly, with one addition: `capacity_override boolean
  not null default false` on `church_experience_registrations` (see "Deviations" below).
- **`0023_church_experience_registration_rpcs.sql`** — `register_for_experience_occurrence`,
  `cancel_experience_registration`, `promote_waitlist_registration`, and a shared, unexposed
  helper `private.promote_next_waitlisted`.
- **`0024_church_experience_walk_ins.sql`** — `record_experience_walk_in`.

No unrelated table was modified except `churches` (the new `timezone` column, required by the
approved spec §9 — not a foreign key, but explicitly part of the approved schema). No existing
table was renamed. `public.experiences` (the unrelated catalog table) was not touched.

## Enums (CHECK constraints)

| Table.column | Values |
|---|---|
| `church_experiences.type` | `volunteer, outreach, prayer_gathering, worship_gathering, small_group, bible_study, service_project, community_event, online_gathering, custom` |
| `church_experiences.format` | `in_person, online, hybrid, self_guided` |
| `church_experiences.status` | `draft, published, archived` |
| `church_experiences.visibility` | `church_only, invited_only, public` (`public` unused in v1, per owner decision 4) |
| `church_experiences.completion_method` | `host_marked, self_attested` |
| `church_experience_occurrences.status` | `scheduled, cancelled, completed` |
| `church_experience_lessons.relationship` | `required, recommended` |
| `church_experience_registrations.status` | `pending, confirmed, waitlisted, cancelled, rejected` |
| `church_experience_registrations.registration_source` | `self, host_walk_in` |
| `church_experience_registrations.attendance_status` | `not_recorded, attended, absent, excused` |
| `church_experience_registrations.completion_status` | `not_started, completed` |

Plus one cross-column CHECK: `church_experiences_custom_type_label_check` — `type = 'custom'`
requires `custom_type_label is not null`.

## RPCs implemented

All four `SECURITY DEFINER`, all row-lock via `for update`, all `revoke all ... from public` +
`grant execute ... to authenticated` (matching `accept_church_invite`'s established pattern,
`0011_church_invites.sql`):

1. **`register_for_experience_occurrence(p_occurrence_id uuid)`** — signed-in member registers.
   Re-validates occurrence status, registration window, Experience `published` status, church
   membership, and duplicate registration, all inside the function (never trusts the client,
   since this function's elevated privileges bypass the normal RLS the client would otherwise be
   subject to). Respects `approval_required` (→ `pending`) vs. capacity/waitlist (→ `confirmed`/
   `waitlisted`).
2. **`cancel_experience_registration(p_registration_id uuid)`** — the registrant themselves, or a
   church manager, cancels. If the cancelled row was `confirmed`, atomically promotes the next
   waitlisted registration in the same transaction via the shared private helper.
3. **`promote_waitlist_registration(p_occurrence_id uuid)`** — a standalone, church-manager-gated
   entry point for the same promotion logic, for a host to trigger manually. Delegates to the same
   `private.promote_next_waitlisted` helper `cancel_experience_registration` uses internally, so
   there is exactly one implementation of "who gets promoted and when," not two.
4. **`record_experience_walk_in(p_occurrence_id, p_profile_id, p_attendance_status, p_override_capacity)`**
   — host/admin records an existing church member's attendance without a prior registration.
   Verifies real `church_memberships` for that church (no anonymous attendees), rejects a
   duplicate registration with a clear error, and enforces capacity by default — an explicit
   `p_override_capacity = true` is required to exceed it, and that fact is recorded on the row via
   `capacity_override`.

A fifth function, **`private.promote_next_waitlisted(p_occurrence_id uuid)`**, holds the actual
locking/promotion logic. It is deliberately in the `private` schema (mirroring
`private.is_church_manager`'s placement) and never granted `execute` to `authenticated`/`anon` —
it trusts its caller entirely, safe only because both real entry points (`cancel_experience_registration`,
`promote_waitlist_registration`) perform their own authorization check before calling it.

## RLS policies added

Every policy reuses `private.is_church_manager(church_id)` — no new authorization helper was
invented. No `using(true)` anywhere. No policy or RPC hardcodes `churches[0]` or assumes a single
church; every check operates on the row's own `church_id` (directly or via a join), and every RPC
parameter is an explicit occurrence/registration id, never an implicit "current church."

- `church_experiences`: `church_experiences_select_published_or_managed` (published + member of
  that church, or manager/admin) and `church_experiences_write_managed` (manager/admin only, `for
  all`).
- `church_experience_occurrences`: `church_experience_occurrences_select_follows_experience`
  (follows the parent Experience's visibility) and `church_experience_occurrences_write_managed`.
- `church_experience_lessons`: `church_experience_lessons_select_follows_parents` (follows either
  parent — the Experience or the linked lesson) and `church_experience_lessons_write_managed`.
- `church_experience_registrations`: `church_experience_registrations_select_own`,
  `church_experience_registrations_select_managed`, and
  `church_experience_registrations_update_managed`. **No INSERT policy** — registration only
  happens through the RPCs above, enforced at the grant level (`grant select, update` only, no
  `insert`).

## Indexes and constraints

- `church_experiences`: index on `church_id`, `ministry_id`.
- `church_experience_occurrences`: index on `experience_id`, `church_id`, `starts_at`.
- `church_experience_lessons`: index on `experience_id`, `lesson_id`; `unique(experience_id, lesson_id)`.
- `church_experience_registrations`: index on `occurrence_id`, `profile_id`; `unique(occurrence_id, profile_id)`
  — the hard backstop against duplicate registration, enforced at the database level regardless of
  what any RPC checks first.
- Capacity is **not** a CHECK constraint (a `CHECK` cannot count sibling rows) — enforced entirely
  by the RPCs' row-locked count-then-decide logic, per spec §12/§19.

## Types

No Supabase generated-types pipeline exists anywhere in this repository (confirmed: no
`supabase gen types` reference, no `database.types.ts`/`supabase.types.ts` file, no such npm
script). Every existing table's TypeScript shape in this codebase is hand-written in
`types/index.ts` with a manual `mapX()` row-mapper in each `services/supabase/*.ts` file — there is
nothing to "regenerate." Phase 10.1 follows this exact existing convention: added
`ChurchExperience`, `ChurchExperienceOccurrence`, `ChurchExperienceLessonLink`,
`ChurchExperienceRegistration` (plus their status/enum union types) to `types/index.ts`, matching
the new schema field-for-field. No `services/supabase/churchExperiences.ts` or any query/mutation
function was created — that remains Phase 10.2's job per the approved implementation plan; Phase
10.1 added only the type shapes the schema now supports, since "Types" was explicitly called out
in this phase's instructions.

## Tests added

Extended `tests/rlsChurchIsolation.test.ts` (static analysis of migration text — this repo has no
live Supabase project wired into `npm test`, same limitation every prior phase has documented) with
15 new tests:

- The three published-or-managed tables (`church_experiences`, `church_experience_occurrences`,
  `church_experience_lessons`) were added to the existing `CHURCH_SCOPED_TABLES` array, gaining the
  generic "has a policy / no `using(true)` / reuses `is_church_manager`" battery for free.
- `church_experience_registrations` got its own dedicated tests (own-row-or-managed shape, no
  INSERT policy, no INSERT grant), matching the precedent already set for `lesson_requests`/
  `testimonies`/`events`.
- Each of the four RPCs plus the private helper got a dedicated test confirming: `security
  definer`, `for update` locking, the expected authorization check, the expected business-rule
  guard (duplicate prevention, membership check, capacity-override requirement, etc.), and the
  correct `revoke`/`grant` pair.
- Constraint tests for the custom-type-label CHECK, the two new `church_experience_registrations`
  columns' defaults, and both `unique` constraints.

All 94 tests pass (79 pre-existing + 15 new).

## Verification results

| Command | Result |
|---|---|
| `npm run lint` | 0 errors, 15 warnings (unchanged from the Phase 9.5 baseline — no new warnings) |
| `npx tsc --noEmit` | Clean |
| `npm test` | 94/94 passing |
| `npm run build` | Successful — identical route manifest to before this phase (expected: no routes were added) |

## Deviations from the approved specification

1. **RPC naming.** This phase's instructions named the four functions `register_for_experience()`,
   `cancel_experience_registration()`, `promote_waitlist_registration()`, and
   `record_experience_walk_in()`. The approved spec (§19) named the first
   `register_for_experience_occurrence(p_occurrence_id uuid)` and did not include
   `promote_waitlist_registration` as a separate function at all — it specified waitlist promotion
   as logic *inside* `cancel_experience_registration` only. Resolution: kept the spec's precise,
   more descriptive name for registration (`register_for_experience_occurrence` — it registers for
   an *occurrence*, not the Experience definition itself, which is not something one "registers"
   for), and added `promote_waitlist_registration` as a **new, standalone function** per this
   phase's explicit instructions, implemented via a shared private helper so both the automatic
   (on-cancellation) and manual (host-triggered) promotion paths use identical logic. This is an
   addition on top of the approved design, not a contradiction of it.
2. **Walk-in capacity behavior, refined.** The approved spec (Decision Log entry 12) said a walk-in
   is always allowed to exceed capacity, with only a UI-level warning. This phase's instructions
   instead specified "capacity enforced by default... host/admin override supported... override
   must be intentional and recorded." The implementation follows **this phase's more precise
   instruction**: `record_experience_walk_in` raises an exception at capacity unless
   `p_override_capacity = true` is explicitly passed, and records that fact via a new
   `capacity_override` column. This is a refinement of the walk-in design, not a reversal of any
   other approved decision — it makes the "must be intentional and recorded" requirement concrete
   at the schema level.
3. **Types added, service layer not.** Per the approved implementation plan, `types/index.ts`
   additions were Phase 10.2's job (bundled with the service/data-access layer). This phase's
   instructions called out "Types" as its own required section under database-foundation scope, so
   the type definitions were added now; the actual `services/supabase/churchExperiences.ts` query/
   mutation layer was **not** built, staying deferred to Phase 10.2 as originally planned — adding
   it now would have crossed into "building the data-access layer," arguably UI-adjacent scope this
   phase's instructions repeatedly say to avoid ("Do not build..." list).
4. **No approve/reject RPC.** The four requested RPCs don't include one, and a plain
   `UPDATE ... status = 'confirmed'`/`'rejected'` by a host/admin is already fully covered by the
   existing `church_experience_registrations_update_managed` RLS policy — no capacity race exists
   at approval time that would require a locking RPC (a host approving a specific pending
   registration is a deliberate, singular judgment call, not a concurrent-registration scenario).
   Not a gap; a deliberate simplification consistent with "do not overcomplicate v1."

## Known limitations

- **Update (2026-07-18, post-deployment)**: a live Supabase project became linked partway through
  Phase 10.3, and migrations `0001`–`0026` (including this phase's `0022`–`0024`) are now
  successfully deployed and verified live — see `docs/PHASE10_3_AUDIT.md` §21 for the full
  verification results (all tables/RLS/RPCs confirmed present and correctly shaped). One
  documentation correction from that live check: this table's own migration comment says "no
  INSERT grant is given" for `church_experience_registrations` — that's imprecise. Live inspection
  shows `authenticated` actually holds the full default privilege set (INSERT/DELETE/etc.) on this
  table, same as every other table in this project (a project-wide Supabase default-privileges
  configuration, not something this migration controls). The real reason direct inserts are
  blocked is that **no INSERT policy exists at all** — confirmed live — and Postgres RLS denies any
  command with no matching policy regardless of the underlying grant. Functionally this is exactly
  as secure as intended; only the migration comment's stated *mechanism* was imprecise. Not edited
  in the migration itself, since it's now deployed and immutable.
- The paragraph below described this file's original, pre-deployment state and is kept for
  history: **no live Supabase project existed in this environment** (confirmed — no `.env.local`,
  only `.env.example`), so none of the following could be exercised against a real database in
  that session: actual migration application, RPC execution, concurrency/race-condition behavior,
  capacity/waitlist correctness under real simultaneous requests, or RLS cross-church isolation
  with real signed-in users. All of the above was **code-reviewed and statically tested only** at
  the time — the same limitation every prior phase (1 through 9.5) documented for real-Supabase-
  backed work. Recommend running the manual/integration QA already specified in spec §27 with a
  real signed-in session, now that the schema itself is live.
- **`church_experiences.registration_required` is not yet enforced anywhere.** It exists as a
  schema field (per spec §10) but no RPC checks it — a `false` value currently has no behavioral
  effect. This is intentional for Phase 10.1 (an unenforced UI-hint field is a documented, minor,
  non-blocking note, not a defect) and should be revisited once the member-facing registration UI
  (Phase 10.5/10.6) actually needs to decide whether to show a "Register" button at all.
- **`church_experiences.default_duration_minutes` is unused by any RPC or constraint** — purely
  descriptive, consumed only by a future UI (Phase 10.4+), matching the same "schema-ready, not
  yet enforced" shape as several other descriptive-only fields in the approved schema.

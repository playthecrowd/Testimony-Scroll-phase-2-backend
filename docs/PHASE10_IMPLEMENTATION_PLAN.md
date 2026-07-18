# Phase 10 Implementation Plan — Experience Platform

Companion to `docs/PHASE10_EXPERIENCE_PLATFORM_SPEC.md` (read that first — this document assumes
its terminology, schema, RLS design, and decision log, including the ten owner decisions of
2026-07-18). Ten small, independently reviewable stages. **No stage here has been started or
implemented** — this is planning only; Phase 10.1 begins only when explicitly instructed.

Each stage should, when actually executed, follow this repo's established phase discipline: run
`npm run lint` / `npx tsc --noEmit` / `npm run build` / `npm test` before considering the stage
done, extend `tests/rlsChurchIsolation.test.ts` alongside any new RLS, and get explicit
user go-ahead before committing (per this project's established working style).

---

## Phase 10.1 — Database foundation

**Goal:** Land the schema from spec §10 as a real migration, nothing else.

- **Migrations**: `0022_church_experiences.sql` — all four tables
  (`church_experiences`, `church_experience_occurrences`, `church_experience_lessons`,
  `church_experience_registrations`, the latter including the owner-approved
  `registration_source` column, spec §7/D), `churches.timezone` column, all indexes, all RLS
  policies from spec §13. No RPC functions yet (10.6/10.7 own those, once the registration/
  attendance UI needs them). No `experience_templates` table (owner decision 6 — future work,
  documentation only, spec §26).
- **Files likely affected**: `supabase/migrations/0022_church_experiences.sql` only.
- **API/data functions**: none.
- **Components**: none.
- **Authorization**: RLS only at this stage (no app code reads/writes these tables yet).
- **Tests**: extend `tests/rlsChurchIsolation.test.ts` with a `church_experience*` section —
  no bare `using(true)`, `church_experiences`/`church_experience_occurrences` write policies
  reuse `is_church_manager`, `church_experience_registrations` has no direct authenticated
  `insert` grant (enforced-via-RPC-only, verified by asserting the grant statement's column list
  excludes insert — mirrors this file's existing assertion style).
- **Manual QA**: none possible yet (no app code touches these tables); confirm migration applies
  cleanly if/when a Supabase project is available (`supabase db push` or dashboard SQL editor).
- **Acceptance criteria**: migration file is syntactically valid, lint/typecheck/build/test all
  still pass (schema-only change, zero application code touched), new RLS tests pass.
- **Dependencies**: none — first stage.
- **Rollback**: drop the four tables + the `churches.timezone` column; no other table is touched.

## Phase 10.2 — Experience service/data layer

**Goal:** `services/supabase/churchExperiences.ts` (data-only, no UI) — the query/mutation layer
every later stage builds on.

- **Files likely affected**: new `services/supabase/churchExperiences.ts`,
  new `types/index.ts` additions (`ChurchExperience`, `ChurchExperienceOccurrence`,
  `ChurchExperienceLessonLink`, `ChurchExperienceRegistration` — prefixed per spec §2/§4 to avoid
  the existing `Experience` type collision).
- **Migrations**: none.
- **API/data functions**: `getManagedExperiences(supabase, churchId)`,
  `getExperienceById(supabase, id)`, `createExperience`, `updateExperience`,
  `updateExperienceStatus` (draft/published/archived), `getPublishedExperiencesForMember(supabase,
  churchIds)`, `replaceExperienceLessons` (delete-then-insert, mirrors
  `replaceLessonExperiences`'s existing pattern exactly), `getExperienceLessons`.
- **Components**: none (pure data layer, following this repo's `services/supabase/*.ts`
  convention of zero JSX in this layer).
- **Authorization**: every write function assumes the caller already passed RLS (no
  `requirePlatformAdmin`-equivalent needed here — `private.is_church_manager` via RLS is the real
  gate, matching every other church-scoped service module in this repo).
- **Tests**: none beyond what 10.1 already covers (this is a thin query layer, consistent with
  this repo's existing services having no dedicated unit tests of their own — correctness is
  covered by RLS tests + manual/integration QA).
- **Manual QA**: none yet (no page calls this layer).
- **Acceptance criteria**: typecheck clean, no runtime code path exists to exercise yet (expected
  at this stage).
- **Dependencies**: 10.1.
- **Rollback**: delete the new service file and type additions; nothing else references them yet.

## Phase 10.3 — Host Experience management (CRUD, no scheduling yet)

**Goal:** A host can create, edit, publish, archive, and link lessons to an Experience.

- **Files likely affected**: `app/host-dashboard/experiences/page.tsx` (list),
  `app/host-dashboard/experiences/new/page.tsx` + `ExperienceForm.tsx`,
  `app/host-dashboard/experiences/[experienceId]/page.tsx` (overview, Lessons tab only at this
  stage — Occurrences tab lands in 10.4), `app/host-dashboard/experiences/[experienceId]/edit/page.tsx`,
  `app/host-dashboard/experiences/actions.ts` (server actions:
  `createExperienceAction`, `updateExperienceAction`, `updateExperienceStatusAction`,
  `replaceExperienceLessonsAction`).
- **Migrations**: none.
- **API/data functions**: consumes 10.2's service layer.
- **Components**: `ExperienceForm.tsx` (create+edit, matching `ChurchProfileForm.tsx`'s
  client-component-with-server-action shape), `ExperienceLessonsEditor.tsx` (mirrors
  `EpisodeLessonsEditor.tsx`'s existing delete-then-insert join-table editor pattern).
- **Authorization**: server actions verify `church_memberships.role in ('host','admin')` for the
  target church before calling the service layer (mirrors `hasChurchEditAccess` + the real RLS
  gate underneath — belt-and-suspenders, matching every other host-write action in this repo).
- **Tests**: none new beyond 10.1's RLS tests (no automated UI test infra in this repo, per
  CLAUDE.md's "no large test framework installed" note).
- **Manual QA**: create/edit/publish/archive an Experience as a host; confirm a different church's
  host cannot see or edit it (requires live Supabase credentials — flag as
  code-reviewed-only if unavailable, matching Phase 9.5's documented QA-limitation pattern).
- **Acceptance criteria**: a host can complete the full create → link lessons → publish → archive
  cycle; RLS blocks cross-church access.
- **Dependencies**: 10.1, 10.2.
- **Rollback**: delete the new route files/components/actions; schema (10.1) is unaffected and can
  stay in place with zero rows.

## Phase 10.4 — Scheduling and occurrences

**Goal:** A host can schedule, edit, and cancel occurrences of a published (or draft) Experience.

- **Files likely affected**: `app/host-dashboard/experiences/[experienceId]/schedule/page.tsx` +
  `OccurrenceForm.tsx`, `app/host-dashboard/experiences/[experienceId]/page.tsx` (add the
  Occurrences tab), `app/host-dashboard/experiences/actions.ts` (add
  `createOccurrenceAction`, `updateOccurrenceAction`, `cancelOccurrenceAction`).
- **Migrations**: none (schema already supports this from 10.1).
- **API/data functions**: `createOccurrence`, `updateOccurrence`, `cancelOccurrence`,
  `getOccurrencesForExperience` in `services/supabase/churchExperiences.ts`.
- **Components**: `OccurrenceForm.tsx` (starts_at/timezone/capacity-override/location-override
  fields; timezone select defaults from `churches.timezone` per spec §9).
- **Authorization**: same church-manager pattern as 10.3.
- **Tests**: unit test for the timezone display helper (`tests/experienceTimezone.test.ts`, pure
  function, no Supabase needed — spec §27).
- **Manual QA**: schedule an occurrence, confirm displayed time matches the entered timezone,
  confirm DST-boundary dates display correctly (e.g., schedule one in March/November).
- **Acceptance criteria**: occurrence CRUD works; cancelling sets `status='cancelled'` without
  deleting the row or its registrations (none exist yet at this stage, but the code path must not
  delete on cancel).
- **Dependencies**: 10.1–10.3.
- **Rollback**: delete the new route/component/action code; existing occurrence rows (if any) are
  simply unreachable, not corrupted.

## Phase 10.5 — Member discovery and details

**Goal:** A member can browse and view Experiences at their own church(es).

- **Files likely affected**: `app/experiences/page.tsx`, `app/experiences/[experienceId]/page.tsx`,
  `components/experiences/ExperienceCard.tsx`, `components/experiences/ExperienceFilters.tsx`.
- **Migrations**: none.
- **API/data functions**: `getPublishedExperiencesForMember`, `getExperienceById`,
  `getUpcomingOccurrences` (10.2, already built — this stage is the first consumer).
- **Components**: card grid + filter bar (type/format/ministry/lesson/date) + detail page with an
  occurrence list (register button wired in 10.6, disabled placeholder until then).
- **Authorization**: page-level — redirect signed-out visitors to `/login` (spec §8); RLS already
  restricts the query to the member's own church(es) regardless.
- **Tests**: none new.
- **Manual QA**: browse/filter as a member of church A; confirm church B's Experiences never
  appear; confirm signed-out visit redirects.
- **Acceptance criteria**: discovery + detail pages render correctly for a real member; loading/
  empty/error states all present per spec §17's table.
- **Dependencies**: 10.1–10.3 (needs published Experiences to exist).
- **Rollback**: delete the new routes/components; no data impact.

## Phase 10.6 — Registration, capacity, and waitlist

**Goal:** A member can register, get confirmed/waitlisted correctly, and cancel; a host sees and
manages the registration list.

- **Migrations**: `0023_church_experience_registration_rpcs.sql` —
  `register_for_experience_occurrence(p_occurrence_id uuid)` and
  `cancel_experience_registration(p_registration_id uuid)`, both `SECURITY DEFINER`, per spec §19's
  exact locking/promotion logic.
- **Files likely affected**: `app/experiences/[experienceId]/actions.ts` (register/cancel
  actions calling the RPCs), `app/my-experiences/page.tsx`,
  `app/host-dashboard/experiences/[experienceId]/registrations/page.tsx` +
  `RegistrationsList.tsx`, `app/host-dashboard/experiences/actions.ts` (add
  `approveRegistrationAction`, `rejectRegistrationAction`).
- **API/data functions**: `registerForOccurrence`, `cancelRegistration` (call the RPCs via
  `supabase.rpc(...)`), `getMyRegistrations`, `getRegistrationsForOccurrence`.
- **Components**: `RegistrationsList.tsx` (host view, approve/reject actions),
  register/waitlist/cancel buttons on the member detail page and `/my-experiences`.
- **Authorization**: RPCs are `SECURITY DEFINER` and check `auth.uid()` internally for
  registration/cancellation ownership; approve/reject actions use the standard
  church-manager check.
- **Tests**: **integration tests against a real Supabase instance are the only way to meaningfully
  verify capacity/waitlist/concurrency** (spec §27) — flag explicitly if unavailable in the
  implementing session; static RLS tests only confirm the *permission* shape (no direct insert
  grant), not the RPC's runtime correctness.
- **Manual QA**: register into an unlimited-capacity occurrence (confirmed immediately); register
  into a full occurrence (waitlisted); cancel a confirmed registration and confirm the earliest
  waitlisted member is promoted; attempt a duplicate registration (rejected with a clear error);
  attempt two near-simultaneous registrations for the last seat (requires either a live environment
  or a scripted concurrency test — document whichever was actually possible).
- **Acceptance criteria**: every rule in spec §19 is demonstrated to hold, or explicitly flagged as
  unverified pending live credentials.
- **Dependencies**: 10.1–10.5.
- **Rollback**: drop the two RPC functions; revert the action/page files. Existing registration
  rows (if any) are retained as historical data, not deleted.

## Phase 10.7 — Attendance, completion, and host-recorded walk-ins

**Goal:** A host can record attendance, finalize completion, and record a walk-in for an
unregistered church member; a self-guided Experience lets a member self-attest.

- **Files likely affected**: `app/host-dashboard/experiences/[experienceId]/attendance/page.tsx`
  + `AttendanceList.tsx` (+ a "record walk-in" control, member picker scoped to the occurrence's
  church roster), `app/host-dashboard/experiences/actions.ts` (add
  `updateAttendanceAction`, `finalizeAttendanceAction`, `recordWalkInAction`),
  `app/experiences/[experienceId]/actions.ts` (add `selfAttestCompletionAction`, gated on
  `completion_method = 'self_attested'` and `occurrence.starts_at` in the past).
- **Migrations**: `0024_church_experience_walk_ins.sql` — the `record_experience_walk_in(
  p_occurrence_id uuid, p_profile_id uuid, p_attendance_status text default 'attended')`
  `SECURITY DEFINER` RPC per spec §19 (owner decision 5/12): locks the occurrence row, verifies
  the caller is `private.is_church_manager` for the occurrence's church, verifies `p_profile_id`
  has a `church_memberships` row for that same church, raises a clear exception if a registration
  already exists for that pair, then inserts one row with `registration_source = 'host_walk_in'`,
  `status = 'confirmed'`, and the given attendance status.
- **API/data functions**: `updateAttendanceStatus`, `updateCompletionStatus`,
  `finalizeOccurrenceAttendance` (stamps `attendance_finalized_at`), `recordWalkIn` (calls the
  new RPC via `supabase.rpc(...)`).
- **Components**: `AttendanceList.tsx` (per-registrant attendance/completion toggles + bulk
  "mark all confirmed as attended" + a walk-in entry row that visibly flags
  `registration_source = 'host_walk_in'` rows and surfaces an "over capacity" indicator per spec
  §19 if a walk-in pushes confirmed count past the occurrence's capacity).
- **Authorization**: host/admin church-manager check for the host-facing actions (both the normal
  ones and `recordWalkInAction`, which additionally relies on the RPC's own internal
  membership-authorization check per owner decision 5 — "do not allow walk-ins to bypass church
  membership or authorization rules"); the self-attest action checks `profile_id = auth.uid()`
  (already the RLS shape) plus the `completion_method`/timing guard in the action itself
  (defense-in-depth, not relied on alone).
- **Tests**: extend `tests/rlsChurchIsolation.test.ts` to confirm `church_experience_registrations`
  still has no direct authenticated `insert` grant even after this stage (the walk-in RPC is
  `SECURITY DEFINER`, bypassing RLS *inside* the function body only, never via a client-facing
  grant) — mirrors 10.1's original assertion, re-verified here since it's easy for a later change
  to accidentally widen a grant.
- **Manual QA**: mark attendance for a `host_marked` Experience; self-attest completion for a
  `self_guided` one before/after `starts_at` (confirm it's blocked before); record a walk-in for a
  church member with no prior registration (confirm it succeeds, is marked `host_walk_in`, and a
  second attempt for the same person is rejected with a clear error, not a raw constraint
  violation); attempt a walk-in for a profile with no membership in that church (confirm it's
  rejected).
- **Acceptance criteria**: attendance/completion states update correctly and match spec §7/E's
  rules; walk-ins satisfy every rule in owner decision 5; no write to `lesson_journeys` occurs
  anywhere in this stage's code.
- **Dependencies**: 10.1–10.6.
- **Rollback**: drop the `record_experience_walk_in` RPC; delete the new route/component/action
  code; attendance/completion columns simply stay at their default values. Any walk-in
  registrations already created remain valid historical rows (they're ordinary
  `church_experience_registrations` rows, distinguished only by `registration_source`) — rolling
  back the RPC does not orphan or corrupt them.

## Phase 10.8 — Minimal Journey integration point (design only, per spec §7/E)

**Goal:** Confirm Phase 10's data shape is genuinely sufficient for a future Phase 12 to consume —
**no `lesson_journeys` write is added in Phase 10 itself.**

- **Files likely affected**: none, or at most a documentation note in
  `docs/PHASE10_EXPERIENCE_PLATFORM_SPEC.md`/a new short `docs/PHASE12_JOURNEY_INTEGRATION_NOTES.md`
  stub if the implementing session wants to record findings for whoever picks up Phase 12.
- **Migrations**: none.
- **API/data functions**: none new — this stage is a verification checkpoint, not a build stage.
- **Components**: none.
- **Authorization**: n/a.
- **Tests**: a **read-only** sanity check (script or manual query) confirming: given a completed
  registration + a `required` lesson link, the exact query Phase 12 would need
  (`church_experience_registrations` join `church_experience_occurrences` join
  `church_experience_lessons` join `lesson_journeys`) actually returns the expected row shape.
- **Manual QA**: n/a.
- **Acceptance criteria**: written confirmation (in the stub doc or a commit message) that the
  Phase 12 consumption query is straightforward given Phase 10's schema — or a note on what's
  missing if it isn't.
- **Dependencies**: 10.1–10.7.
- **Rollback**: n/a (no code changes expected).

## Phase 10.9 — Reporting

**Goal:** The minimal v1 reporting scope from spec §21, surfaced on the host Experience overview
page.

- **Files likely affected**: `app/host-dashboard/experiences/[experienceId]/page.tsx` (Overview
  tab gains the reporting numbers), `services/supabase/churchExperiences.ts` (add
  `getExperienceParticipationSummary`).
- **Migrations**: none (all reporting is a live query over existing tables, per spec §21 — "no
  full analytics warehouse").
- **API/data functions**: `getExperienceParticipationSummary(experienceId)` — registrations by
  status, attendance count, completion count, capacity utilization per occurrence, cancellation/
  no-show counts.
- **Components**: simple stat-pill/table display, reusing `components/ui/StatPill.tsx` (existing
  shared component, already used across `/host-dashboard`, `/dashboard`, `/admin`).
- **Authorization**: same church-manager check as every other host page.
- **Tests**: none new.
- **Manual QA**: confirm numbers match manual counts on a small test dataset.
- **Acceptance criteria**: every metric in spec §21 is visible somewhere on the host overview.
- **Dependencies**: 10.1–10.7.
- **Rollback**: delete the new query function and its UI section; no schema impact.

## Phase 10.10 — Tests, QA, documentation, stabilization

**Goal:** Close out Phase 10 the same way Phase 9.5 closed out Phases 1–9: verify, document, no
new feature work.

- **Files likely affected**: `tests/rlsChurchIsolation.test.ts` (final pass over all
  `church_experience*` policies), a new `docs/PHASE10_AUDIT.md` (implementation summary + manual
  QA checklist, matching every prior phase's closing-doc convention).
- **Migrations**: none (unless a real defect is found — per this project's standing rule, only
  with a documented reason).
- **API/data functions**: none new — bug fixes only, if any are found.
- **Components**: none new — bug fixes only.
- **Authorization**: final review that every server action in `app/host-dashboard/experiences/*`
  and `app/experiences/*` performs a real server-side check, not just a client-side one (matching
  Phase 9's "final permission review" precedent).
- **Tests**: run the full suite (`npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm test`);
  confirm the `church_experience*` RLS section is complete.
- **Manual QA**: full run-through of every workflow in spec §14/§15, documented per-route with the
  same "code verified / build verified / manually verified / not verified without live credentials"
  distinction Phase 9.5 established.
- **Acceptance criteria**: matches Phase 9.5's bar — 0 new lint errors, clean typecheck, successful
  build, all tests passing, every warning either fixed or explicitly documented as deferred.
- **Dependencies**: 10.1–10.9.
- **Rollback**: n/a (documentation + verification stage).

---

## Cross-stage notes

- **Commit granularity**: one commit per stage (10.1 through 10.10), matching this project's
  established one-phase-one-commit convention — never batch multiple stages into one commit.
- **User approval**: per this project's standing working style, each stage should be reported as
  complete and await explicit go-ahead ("yes"/"comit") before starting the next, exactly like
  Phases 1–9 and 9.5 were run.
- **Branch**: all ten stages happen on `Production`; nothing merges to `main` at any stage.

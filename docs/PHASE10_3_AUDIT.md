# Phase 10.3 — Combined Experience Platform Workflows

Date: 2026-07-18. This phase combined the originally-separate 10.2 (server actions), 10.3 (host
UI), 10.4 (member discovery/registration), and 10.5 (attendance/Journey integration) stages from
`docs/PHASE10_IMPLEMENTATION_PLAN.md` into one milestone, per this phase's own instructions.
Source of truth throughout: `docs/PHASE10_EXPERIENCE_PLATFORM_SPEC.md`,
`docs/PHASE10_IMPLEMENTATION_PLAN.md`, `docs/PHASE10_1_AUDIT.md`, `docs/PHASE10_2_AUDIT.md`.

## 1. Internal checkpoints completed

All nine checkpoints from this phase's brief: (1) server actions, (2) host Experience UI, (3)
occurrence management, (4) lesson relationships, (5) member Experience UI, (6) waitlist behavior,
(7) walk-ins, (8) attendance/completion, (9) Journey integration — plus the required ownership
edge-case review and the mid-phase database-push fix (see §19, §21).

## 2. Files created

**Migrations:**
- `supabase/migrations/0025_church_experience_ownership_protection.sql`
- `supabase/migrations/0026_church_experience_journey_sync.sql`

**Library:**
- `lib/churchExperienceForm.ts` — shared Experience/occurrence field validation
- `lib/experienceTimezone.ts` — timezone display helpers

**Server actions:**
- `app/host-dashboard/experiences/actions.ts`
- `app/experiences/actions.ts`

**Pages/routes:**
- `app/host-dashboard/experiences/page.tsx`
- `app/host-dashboard/experiences/new/page.tsx`
- `app/host-dashboard/experiences/[experienceId]/page.tsx`
- `app/host-dashboard/experiences/[experienceId]/edit/page.tsx`
- `app/host-dashboard/experiences/[experienceId]/occurrences/new/page.tsx`
- `app/host-dashboard/experiences/[experienceId]/occurrences/[occurrenceId]/page.tsx`
- `app/host-dashboard/experiences/[experienceId]/occurrences/[occurrenceId]/edit/page.tsx`
- `app/experiences/page.tsx`
- `app/experiences/[experienceId]/page.tsx`
- `app/my-experiences/page.tsx`

**Components:**
- `components/experiences/ExperienceStatusBadge.tsx`
- `components/experiences/ExperienceForm.tsx`
- `components/experiences/ExperienceLessonsEditor.tsx`
- `components/experiences/ExperienceStatusActions.tsx`
- `components/experiences/OccurrenceForm.tsx`
- `components/experiences/RegistrationsList.tsx`
- `components/experiences/WalkInForm.tsx`
- `components/experiences/OccurrenceCancelAction.tsx`
- `components/experiences/ExperienceCard.tsx`
- `components/experiences/ExperiencesBrowser.tsx`
- `components/experiences/OccurrenceRegisterAction.tsx`

**Tests:**
- `tests/churchExperienceForm.test.ts` (21 tests)
- `tests/experienceTimezone.test.ts` (10 tests)
- `tests/churchExperienceAuthorization.test.ts` (5 tests)

## 3. Files modified

- `services/supabase/churchExperiences.ts` — occurrence CRUD, registration/attendance reads,
  RPC wrapper functions, list-view aggregates (`getExperienceSummaries`,
  `getParticipationCountsForOccurrences`), `getMyRegistrationForOccurrence`.
- `services/supabase/churches.ts` — added `getMyChurches` (any role, for member-facing discovery;
  `getMyHostChurches` remains host/admin-only).
- `lib/navigation.ts` — added "Experiences" to the member and host sidebars.
- `tests/rlsChurchIsolation.test.ts` — added coverage for the two new triggers (§8).

## 4. Routes added

Host (all under the existing `/host-dashboard` prefix, per this phase's explicit instruction not
to create a new `/church-management/*` hierarchy):
`/host-dashboard/experiences`, `/new`, `/[experienceId]`, `/[experienceId]/edit`,
`/[experienceId]/occurrences/new`, `/[experienceId]/occurrences/[occurrenceId]`,
`/[experienceId]/occurrences/[occurrenceId]/edit`.

Member: `/experiences`, `/experiences/[experienceId]`, `/my-experiences`.

## 5. Server actions implemented

All in `app/host-dashboard/experiences/actions.ts` / `app/experiences/actions.ts`, following the
exact shape already established by `app/host-dashboard/church-profile/actions.ts`: validate input,
authenticate, re-verify church access for the specific church involved, call the service/RPC
layer, revalidate, never leak a raw Supabase error.

- `createExperienceAction`, `updateExperienceAction`, `updateExperienceStatusAction`
- `createOccurrenceAction`, `updateOccurrenceAction`, `cancelOccurrenceAction`
- `replaceExperienceLessonsAction`
- `updateRegistrationStatusAction` (approve/reject), `promoteWaitlistRegistrationAction`
- `recordWalkInAction`, `updateAttendanceStatusAction`, `updateCompletionStatusAction`,
  `finalizeOccurrenceAttendanceAction`
- `registerForExperienceOccurrenceAction`, `cancelMyRegistrationAction` (member-facing)

Every action that acts on an existing experienceId/occurrenceId/registrationId resolves the row
server-side first and checks `church_memberships` for the *church that row actually belongs to* —
never trusts a client-supplied churchId directly for authorization (only `createExperienceAction`
takes an explicit churchId, and it's independently verified against the caller's own membership
before anything is written).

## 6. Host workflows

Create → link lessons → publish/archive; schedule/edit/cancel occurrences; view registrations per
occurrence with approve/reject for pending ones; promote from waitlist manually; record walk-ins;
update attendance/completion per registrant; finalize attendance. Participation summary (confirmed/
waitlisted/attended/completed/cancelled) shown on the Experience detail page, aggregated across all
its occurrences.

## 7. Member workflows

Discover published Experiences at their own church(es) with type/format/ministry filters; view
Experience + upcoming occurrence details; register (confirmed/pending/waitlisted depending on the
Experience's settings); cancel; view all registrations (upcoming/past) on `/my-experiences`.

## 8. Registration and waitlist behavior

Unchanged from the Phase 10.1 RPC design (already live and tested) — this phase only added the UI/
actions layer on top. Verified live against the deployed database (§21) that
`register_for_experience_occurrence`/`cancel_experience_registration`/
`promote_waitlist_registration` all exist, are `SECURITY DEFINER`, and that
`church_experience_registrations` has no INSERT or DELETE policy at all — every registration
mutation is confirmed to only be reachable through the RPCs, not a direct client write.

## 9. Walk-in behavior

`WalkInForm.tsx` searches the church's own member roster (never another church's, never an
anonymous/guest concept), excludes members already registered for the occurrence, and requires an
explicit confirmation checkbox before submitting an over-capacity override — `recordWalkInAction`
→ `recordWalkIn` → the `record_experience_walk_in` RPC, matching the schema/authorization design
from Phase 10.1 exactly. No guest/plus-one walk-in exists — the approved schema never supported one
(Phase 10.1's decision 5), so none was added here.

## 10. Attendance and completion

Kept as two independent controls throughout (`RegistrationsList.tsx`) — never coupled, never
inferred from one another. A host can set either regardless of the other's current value; the
Experience's `completionMethod` is purely informational context for the host's own judgment in
this phase (no automatic attendance→completion promotion was added, matching "do not
overcomplicate").

## 11. Journey integration

**A correction to the original spec's assumption, found during this phase's required audit of the
existing Journey implementation**: `services/supabase/journeys.ts`'s `markStudiedComplete()`
(already shipped, Phase 5) already advances `lesson_journeys.current_stage` from `studied` to
`experienced` immediately and unconditionally when a member finishes the Studied checklist — this
has nothing to do with attending a real-world Experience. The spec's Phase 10A assumption that
completing an Experience should drive `studied → experienced` was therefore wrong. No code in this
repository had ever written `applied` to a real `lesson_journeys` row before (confirmed —
`testimonies_before_insert` only reads `studied_completed_at`, never writes `current_stage`; the
real Applied-stage UI is still entirely mock). Completing a real-world Experience is the natural
real-world equivalent of "applying what you studied," so `0026_church_experience_journey_sync.sql`
makes that the one narrow write path for the `experienced → applied` transition:

- Fires only on the `completion_status` `not_started → completed` transition (idempotent by
  construction — a retried action or duplicate page load that re-submits `'completed'` is a no-op).
- Only advances lessons linked with `relationship = 'required'` (a documented v1 choice —
  `recommended` links don't gate progression).
- Only touches a journey sitting exactly at `current_stage = 'experienced'` with
  `studied_completed_at is not null` already on record — never skips stages, never touches the
  wrong member's or wrong lesson's journey (both are matched exactly via the registration's own
  `profile_id` and the Experience's actual linked lessons for that occurrence).
- `SECURITY DEFINER`, since the acting user is typically the host (not the journey owner) and
  `lesson_journeys_update_own` correctly restricts ordinary updates to the owning member only —
  this is the same narrowly-scoped trigger pattern already established by
  `testimonies_before_insert`/`protect_lesson_ownership`, not a broad Journey rewrite.

Verified live (§21): the function and trigger exist on the deployed database, `SECURITY DEFINER`
confirmed.

## 12. Authorization protections

Every host action re-derives the owning church server-side (`getAuthorizedExperience`/
`getAuthorizedOccurrence`/`getAuthorizedRegistration` in `app/host-dashboard/experiences/actions.ts`)
and checks `church_memberships` for that specific church before writing anything — confirmed by a
new structural test (`tests/churchExperienceAuthorization.test.ts`) that greps the actual action
source for these guard calls, and confirms no file anywhere in `app/`, `components/`, `services/`,
or `lib/` directly inserts into `church_experience_registrations`. Member actions
(`app/experiences/actions.ts`) call only the RPC wrapper functions, confirmed the same way.

**What could not be tested end-to-end in this environment** (no browser automation tool, and full
interactive sign-in flows require a real user session): a live "member of church A gets rejected
managing church B's Experience" click-through. This is covered at the RLS level (verified live,
§21) and at the server-action code level (verified via the structural test above), but not via an
actual two-account browser session in this pass.

## 13. Ownership edge-case resolution (required review)

Phase 10.2 flagged: `updateExperience`'s input type excludes `churchId`, but RLS's
`is_church_manager(church_id)` check alone does not prevent a host who manages two+ churches from
reassigning an Experience between them via a raw UPDATE (both the old and new `church_id` would
independently pass the check). **Resolved**, not just re-documented:
`0025_church_experience_ownership_protection.sql` adds `protect_church_experience_ownership`, a
`before update` trigger that unconditionally blocks `church_id`/`created_by` from ever changing —
the exact same shape as the pre-existing `protect_lesson_ownership` trigger for `lessons`
(`0003_functions.sql`). Verified live (§21): the trigger exists and is attached. Covered by a new
test in `tests/rlsChurchIsolation.test.ts`.

## 14. Automated tests added

36 new tests: 21 in `tests/churchExperienceForm.test.ts` (pure validation logic), 10 in
`tests/experienceTimezone.test.ts` (pure timezone display logic, including a real daylight-saving
boundary check), 5 in `tests/churchExperienceAuthorization.test.ts` (structural authorization
guards), plus 2 more added to `tests/rlsChurchIsolation.test.ts` for the two new triggers.

## 15. Total tests passing

**132 / 132** (96 pre-existing + 36 new).

## 16. Manual QA performed

- **Live database verification** (new capability this phase — the Supabase project became linked
  and migrations 0001–0026 were deployed mid-phase): confirmed via `supabase db query --linked`
  that all four `church_experience*` tables exist with RLS enabled; all four RPCs plus the private
  helper exist and are `SECURITY DEFINER`; `church_experience_registrations` has exactly three
  policies (`select_own`, `select_managed`, `update_managed`) and **no INSERT or DELETE policy at
  all**, confirming registration is only ever reachable through the RPCs regardless of the
  broader default table grants every table in this project carries (see §20); both new triggers
  (`protect_church_experience_ownership`, `sync_journey_on_experience_completion`) exist and are
  attached. This is materially stronger verification than the static-text-parsing tests alone.
- **Dev-server HTTP-level checks** (same method as every prior phase, since no browser automation
  tool exists in this environment): requested every new route. Found and fixed a real bug (§17) —
  four pages called `createClient()` outside their own try/catch, so the well-understood "no
  `.env.local` in this environment" condition crashed them with a raw 500 instead of the intended
  branded error page. After the fix, all four return 200 with the graceful error state.
- **Not verified in this pass** (would need a live signed-in session and/or a browser tool):
  interactive registration/cancellation/waitlist-promotion click-through, walk-in recording,
  attendance/completion toggling, actual capacity-race behavior under concurrency, real
  cross-account authorization denial. All of these are code-reviewed, RLS-verified, and/or
  structurally test-covered as described above, but not click-tested end-to-end.

## 17. Documentation updated

- `docs/PHASE10_IMPLEMENTATION_PLAN.md` — status note added (this phase superseded the original
  10.2–10.5 staging; see the note at the top of that file).
- `docs/PHASE10_3_AUDIT.md` — this file (new).

## 18. Deviations

1. **Stage consolidation** — per this phase's explicit instructions, originally-separate stages
   10.2 (service/actions) through 10.5 (attendance/Journey) were combined into one milestone.
2. **Journey integration target corrected** — `experienced → applied`, not `studied → experienced`
   as the original spec assumed (§11) — discovered via the required Journey-implementation audit,
   not a deviation taken lightly.
3. **Ownership edge case fixed, not just documented** — per this phase's explicit instruction to
   resolve rather than re-flag it (§13).
4. **`createClient()`-outside-try bug fixed** in four pages during manual QA (§16) — in scope
   since these are new files from this same phase, unlike the identical pre-existing pattern in
   `app/experience-builder/page.tsx`/`app/host-dashboard/page.tsx`, which predate this phase and
   were left untouched (matching Phase 9.5's precedent of documenting rather than fixing
   out-of-scope pre-existing instances of the same issue).

## 19. Mid-phase event: Supabase db push and the 0018 migration fix

While this phase's work was paused, the user ran `supabase db push` against the linked project and
migration `0018_testimonies.sql` failed with a genuine pre-existing bug (unrelated to Phase 10):
`when 'first_name', 'username' then` inside a simple CASE expression is not valid PostgreSQL syntax
(a simple CASE's WHEN clause accepts exactly one comparison value). Fixed by converting to a
searched CASE with `in (...)` for the shared branch — confirmed via a repo-wide search that this
was the only invalid CASE construct across all 26 migration files, including this phase's own new
ones. Committed separately (`d4ad6dd`) from this phase's work, per the user's explicit instruction.
**Migrations 0001–0026 are now deployed and treated as immutable** — any further schema change
from this point forward goes in a new `0027_...` migration; nothing already applied was rewritten.

## 20. Known limitations

- **Default table grants are broader than each migration's own `grant` statement specifies, project-wide** — confirmed live that `church_experience_registrations` (and, for comparison, the
  pre-existing `lesson_requests`/`testimonies`/`events`) all show `authenticated` holding
  INSERT/DELETE/TRUNCATE/REFERENCES/TRIGGER in addition to whatever each migration's own `grant`
  line specifies. This is a pre-existing, project-wide Supabase default-privileges configuration
  (not something Phase 10 introduced or can fix via a migration alone), and it does not weaken
  actual security: RLS is confirmed to be the real enforcement boundary throughout this schema —
  a table with RLS enabled and no policy for a given command denies that command entirely,
  regardless of the broader grant. `church_experience_registrations` has no INSERT/DELETE policy
  at all (verified live), so it is exactly as protected as intended. The `0022` migration's own
  comment language ("no INSERT grant is given") is technically imprecise about *why* direct
  inserts are blocked (RLS policy absence, not grant absence) — noted here rather than edited in
  the migration file itself, since `0022` is now deployed and immutable per the user's instruction.
- Interactive end-to-end QA gaps listed in §16.
- `church_experiences.registration_required` remains an unenforced UI-hint field (carried over
  from Phase 10.1's own documented limitation — still true, no RPC or action checks it yet).
- The lesson picker in `ExperienceLessonsEditor.tsx` only ever shows the host's own church's
  lessons (via `getManagedLessonsByChurch`) — cross-church published-lesson linking is technically
  possible at the RLS level (the join table's write policy only checks the Experience's church,
  not the lesson's) but the UI never offers it, so this is a low-severity, UI-scoped limitation,
  not a data-exposure one (linking to another church's lesson ID would not itself expose that
  lesson's content beyond what its own RLS already permits).

## 21. Live database verification results (raw)

Run via `npx supabase db query --linked` against project `ytnftubajizhuylhmsib`:

- 4/4 `church_experience*` tables present, RLS enabled on all.
- 7/7 expected functions present (`register_for_experience_occurrence`,
  `cancel_experience_registration`, `promote_waitlist_registration`, `record_experience_walk_in`,
  `promote_next_waitlisted` in `private` schema, `protect_church_experience_ownership`,
  `sync_journey_on_experience_completion`), all `SECURITY DEFINER`.
- `church_experience_registrations`: exactly 3 policies (`select_own`, `select_managed`,
  `update_managed`); no INSERT or DELETE policy.
- Migration tracking: `supabase_migrations.schema_migrations` shows all 26 versions (`0001`–`0026`)
  applied; local and remote match.

## 22. Deferred work (unchanged from the approved spec's explicit out-of-scope list)

Credits/rewards, ChatGPT content generation, recurring occurrence series, Experience Templates,
cross-church public discovery, anonymous registration/guest storage, a new ministry-leader role, a
multi-church selector redesign, real notification delivery, Square payments — none touched, exactly
as instructed.

## Verification results

| Command | Result |
|---|---|
| `npm run lint` | 0 errors, 15 warnings (unchanged baseline) |
| `npx tsc --noEmit` | Clean |
| `npm test` | 132/132 passing |
| `npm run build` | Successful — all new routes compiled |

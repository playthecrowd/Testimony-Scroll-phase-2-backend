# Phase 10.4 Audit — Combined Experience Platform Finalization

Scope: finalize and stabilize the Experience Platform built in Phases 10A/10.1/10.2/10.3, without
adding new product features, without a multi-church selector, and without starting Phase 11
("Kingdom Economy"). This phase is a verification, regression-testing, security/performance/
accessibility review, and bug-fix pass over already-shipped Phase 10.1–10.3 work.

## 1. Baseline verification

- Branch: `Production` (confirmed via `git branch --show-current`).
- Working tree: clean at the start of this phase (`git status` → "nothing to commit, working tree
  clean"), 6 commits ahead of `origin/Production`.
- Required commits present in `git log`: `1fa44c5` (Phase 10.3), `d4ad6dd` (0018 CASE fix),
  `306e901` (Phase 10.2). All three confirmed present, in that order.
- `npm run lint`: 0 errors, 15 pre-existing warnings (all `@next/next/no-img-element`, all in files
  outside the Experience Platform, unrelated to this phase).
- `npx tsc --noEmit`: clean, no output.
- `npm test`: 132/132 passing (baseline, before this phase's own test additions).
- `npm run build`: succeeded; every Experience route present in the route manifest
  (`/experiences`, `/experiences/[experienceId]`, `/my-experiences`,
  `/host-dashboard/experiences` and its `new`/`[experienceId]`/`edit`/`occurrences/*` subroutes).

## 2. Migration and remote database verification

- Local migrations present: `0001`–`0026`, no gaps, no files past `0026` at the start of this
  phase (confirmed via directory listing).
- `npx --no-install supabase migration list` against the linked project (`ytnftubajizhuylhmsib`):
  every local migration `0001`–`0026` has a matching remote entry. Local and remote match exactly.
- No new migration was required this phase — all Phase 10.4 fixes are service/page/test-layer
  changes only, with no schema change. Per the binding instruction from the prior session,
  migrations `0001`–`0026` remain untouched and immutable; the next schema change (if any future
  phase needs one) starts at `0027`.
- Live database checks run directly against the linked project (read-only `supabase db query`),
  not inferred from migration source alone:
  - All 7 Experience-related functions (`register_for_experience_occurrence`,
    `cancel_experience_registration`, `promote_waitlist_registration`, `record_experience_walk_in`,
    `promote_next_waitlisted`, `sync_journey_on_experience_completion`,
    `protect_church_experience_ownership`) are `SECURITY DEFINER` with `search_path=""` locked, as
    designed.
  - RLS policies on `church_experiences`, `church_experience_occurrences`,
    `church_experience_lessons`, `church_experience_registrations` match the documented design
    exactly: registrations has SELECT (own, managed) + UPDATE (managed) only, no INSERT/DELETE
    policy.
  - Table grants on `church_experience_registrations`: both `anon` and `authenticated` hold broad
    default privileges (INSERT/UPDATE/DELETE/SELECT/etc.) — this is the same project-wide Supabase
    default-privilege convention already documented in `docs/PHASE10_1_AUDIT.md` for every other
    table (`lesson_requests`, `testimonies`, `events`), not a new issue. The real write boundary is
    the absence of an INSERT/DELETE RLS policy, confirmed live.
  - Function EXECUTE grants: all four RPCs are also granted to `anon` at the live-DB level (in
    addition to `authenticated`), again via the same project-wide default-privilege convention —
    not something any Phase 10 migration explicitly grants. This is harmless: every RPC's first
    statement is `if auth.uid() is null then raise exception ...`, confirmed by direct source
    inspection of `0023_church_experience_registration_rpcs.sql` and
    `0024_church_experience_walk_ins.sql`, so an `anon`-role call is rejected before any read or
    write happens regardless of the grant. Noted here so a future audit doesn't re-discover this
    as if it were new.
  - Row-level locking (`for update`) confirmed present in every RPC that reads-then-writes an
    occurrence or registration row: `register_for_experience_occurrence` (occurrence, twice),
    `cancel_experience_registration` (registration), `record_experience_walk_in` (occurrence).
  - Indexes confirmed present on every foreign-key column actually queried:
    `church_experiences.church_id`/`ministry_id`; `church_experience_occurrences.experience_id`/
    `church_id`/`starts_at`; `church_experience_lessons.experience_id`/`lesson_id` (plus the unique
    `(experience_id, lesson_id)`); `church_experience_registrations.occurrence_id`/`profile_id`
    (plus the unique `(occurrence_id, profile_id)`).

## 3. Automated regression tests

Starting point: 132 tests (Phase 10.3 baseline), all passing. Added this phase:

- Three new structural RLS tests pinning down the specific "published-or-managed" SELECT shape on
  `church_experiences`, `church_experience_occurrences`, and `church_experience_lessons` — the
  pre-existing generic `CHURCH_SCOPED_TABLES` loop only confirmed *some* manager-gated policy
  exists on these tables; these new tests confirm the actual member-visibility branch (published
  status + real church membership) is present and correct.
- Two new structural tests guarding the N+1 fix described in section 6 below: one confirming
  `getMyRegistrationsForOccurrences` uses a single `.in()` query (and that the old per-occurrence
  function was fully removed, not left as dead code), one confirming the member Experience detail
  page actually calls the batched function and not a `Promise.all` per-occurrence loop.

Final count: **137/137 passing**, 0 failures.

As with every prior phase, this repo has no live Supabase credentials wired into `npm test`, so
these remain static/structural regression guards (reading actual migration SQL and TypeScript
source) rather than true integration tests against a running database. Real behavioral
verification happened via the direct `supabase db query` checks in section 2 and the manual QA in
section 4.

## 4. Manual QA

No `.env.local` exists in this dev sandbox (confirmed in Phase 10.3 — this is a pre-existing
environment limitation, not new to this phase), so there is no way to sign in as a real user and
click through the app in a browser from here. The checklist below is organized by account type,
with an honest status for each row:

- **Click-tested**: exercised against a running dev server in this environment.
- **Code-reviewed**: traced through the actual server action → service function → RPC/RLS chain
  and confirmed correct by reading the real code and live DB state; not clicked.
- **Blocked by environment**: requires a live Supabase session (`.env.local`) this sandbox doesn't
  have.
- **Needs Vercel Preview**: requires a deployed environment with real auth cookies/session
  handling that can't be reproduced locally without credentials.

| # | Account type | Workflow | Status |
|---|---|---|---|
| 1 | Anonymous visitor | `/experiences` redirects to `/login` | Code-reviewed (page checks `auth.getUser()`, redirects if null) |
| 2 | Platform admin | Sees all churches' Experiences via `private.is_church_manager`'s admin branch | Code-reviewed (same helper used everywhere else; no Experience-specific admin bypass exists) |
| 3 | Church A Host | Create/edit/publish/archive an Experience for Church A | Code-reviewed via `createExperienceAction`/`updateExperienceAction`/`updateExperienceStatusAction` — each re-derives `churchId` from the experience row, never trusts the client |
| 4 | Church A Host | Schedule/edit/cancel an occurrence | Code-reviewed via `createOccurrenceAction`/`updateOccurrenceAction`/`cancelOccurrenceAction` — `getAuthorizedExperience`/`getAuthorizedOccurrence` gate every call |
| 5 | Church A Host | Attach/detach required vs. recommended lessons | Code-reviewed via `replaceExperienceLessonsAction`; duplicate-lesson guard confirmed by existing unit test |
| 6 | Church A Host | View registrations, confirm/reject a pending registration | Code-reviewed via `updateRegistrationStatusAction` + `getAuthorizedRegistration` |
| 7 | Church A Host | Promote a waitlisted registrant after a cancellation frees a seat | Code-reviewed via `promoteWaitlistRegistrationAction` → `promote_waitlist_registration` RPC → `private.promote_next_waitlisted` |
| 8 | Church A Host | Record a walk-in for a real church member, with and without capacity override | Code-reviewed via `recordWalkInAction` → `record_experience_walk_in` RPC; capacity/duplicate/membership checks confirmed present in migration source and unit-tested structurally |
| 9 | Church A Host | Mark attendance and completion, finalize occurrence attendance | Code-reviewed via `updateAttendanceStatusAction`/`updateCompletionStatusAction`/`finalizeOccurrenceAttendanceAction` |
| 10 | Church B Host | Attempt to manage Church A's Experience/occurrence/registration by forged id | Code-reviewed: every host action calls `getAuthorizedExperience`/`getAuthorizedOccurrence`/`getAuthorizedRegistration`, which re-derives the owning church from the row itself and checks `church_memberships` for the *caller's* role at *that* church — a forged id belonging to a church the caller doesn't manage is rejected before any write. RLS is the backstop even if an action-layer check were ever missed. |
| 11 | Church A Member | Browse published Experiences at their own church, register for an occurrence | Code-reviewed via `getPublishedExperiencesForMember` (RLS-filtered) and `registerForExperienceOccurrenceAction` → `register_for_experience_occurrence` RPC |
| 12 | Church A Member | View a draft/archived Experience by forged URL | Code-reviewed: `app/experiences/[experienceId]/page.tsx` explicitly nulls out any non-published experience even if RLS ever returned one, then calls `notFound()` |
| 13 | Church A Member | Cancel own registration; attempt to cancel another member's registration by forged id | Code-reviewed: `cancel_experience_registration` RPC checks `v_registration.profile_id <> auth.uid() and not private.is_church_manager(...)` and raises if neither holds |
| 14 | Church A Member | View `/my-experiences` across multiple registrations | Code-reviewed via `getMyRegistrationsWithDetails`; `isFutureOccurrence` purity fix from Phase 10.3 re-confirmed present |
| 15 | Member with no church membership | `/experiences`, `/my-experiences`, `/host-dashboard/experiences/*` | Code-reviewed: each page's `try` redirects or shows an empty/error state; no crash path found |
| 16 | Any signed-in user, Supabase env unset | Every Experience route | Click-tested (curl) against the local dev server: all four previously-buggy pages (`/experiences`, `/my-experiences`, `/host-dashboard/experiences`, `/host-dashboard/experiences/new`) return `200` with the branded "Supabase is not configured" state, not a raw 500 — this was the concrete bug fixed in Phase 10.3 and is re-verified still fixed this phase |
| 17 | Journey integration | Completing a required-linked Experience registration advances a journey sitting at `experienced` to `applied` | Code-reviewed + structurally tested: trigger body inspected live via `pg_proc`, matches migration source exactly, unit test asserts the exact idempotency/relationship/stage guards |
| 18 | Journey integration | Completing a *recommended*-linked or non-required registration does not advance any journey | Code-reviewed: trigger's `join ... where cel.relationship = 'required'` excludes recommended links entirely |

Full browser click-through (rows 1–15) needs either `.env.local` populated in this sandbox or a
Vercel Preview deployment — neither is available in this session. No code change in this phase
depended on a click-test to verify; all conclusions above trace to actual source/live-DB state.

## 5. Security review

Attempted/reasoned-through attack vectors, all against the actual current code and live DB state
(not assumptions):

1. **Forged `experienceId`/`occurrenceId`/`registrationId` in a host action, targeting a church the
   caller doesn't manage.** Blocked — every `getAuthorized*` helper re-derives the owning church
   from the row itself and calls `requireChurchAccess`, which re-checks `church_memberships` for
   that specific church. RLS is the independent backstop underneath.
2. **Forged `profileId` in a member's own cancel/register call.** Not possible — both RPCs use
   `auth.uid()` internally; no action ever passes a client-supplied `profileId` for the member's
   own registration.
3. **Direct `.insert()` into `church_experience_registrations` bypassing the RPC.** No such call
   exists anywhere in `app/`/`components/`/`services/`/`lib/` (structural test, re-verified this
   phase) — and even if one existed, there is no INSERT policy on that table, so RLS would reject
   it regardless.
4. **Anonymous (`anon`-role) RPC call bypassing sign-in.** `anon` does hold an EXECUTE grant on all
   four RPCs at the live-DB level (see section 2) but every RPC's first line rejects a null
   `auth.uid()`.
5. **Cross-church walk-in** (host records a walk-in for a person who isn't actually a member of
   that church). Blocked — `record_experience_walk_in` explicitly checks `church_memberships` for
   the target `profileId` at the occurrence's church and raises `'That person is not a member of
   this church.'` if absent.
6. **Capacity bypass via the normal registration RPC** (as opposed to the walk-in path, which has
   an explicit host-only override flag). `register_for_experience_occurrence` takes no
   capacity-override parameter at all — only `record_experience_walk_in` does, and that path is
   host/admin-gated.
7. **Ownership reassignment** (changing `church_experiences.church_id`/`created_by` after
   creation, e.g. to move an Experience into a church the attacker manages). Blocked by the
   `protect_church_experience_ownership` trigger added in Phase 10.3, confirmed live via
   `pg_proc`.
8. **Publishing an incomplete Experience.** `updateExperienceStatusAction` re-runs
   `validateExperienceInput` server-side before allowing a transition to `published`; this can't be
   skipped by omitting client-side validation.

No new vulnerability found. No fix required in this section beyond the N+1 performance fix in
section 6, which is not itself a security issue.

## 6. Performance review

- Aggregate/summary queries (`getExperienceSummaries`, `getParticipationCountsForOccurrences`)
  already batch with `.in(...)` and `Promise.all` — no N+1 pattern found there.
- **Found and fixed**: `app/experiences/[experienceId]/page.tsx` called
  `getMyRegistrationForOccurrence` once per occurrence via `Promise.all(occurrences.map(...))` —
  one query (plus one redundant `auth.getUser()` call) per occurrence instead of a single batched
  query. For an Experience with many upcoming occurrences (e.g. a recurring weekly one), this
  scales linearly with occurrence count for no reason.
  - **Fix**: added `getMyRegistrationsForOccurrences(supabase, occurrenceIds)` to
    `services/supabase/churchExperiences.ts` — a single `.in("occurrence_id", occurrenceIds)`
    query returning a `Map<occurrenceId, registration | null>`. Removed the now-fully-unused
    `getMyRegistrationForOccurrence` (dead code once its one call site was migrated). Updated the
    page to call the batched function directly.
  - Regression tests added (section 3) guard against this being reintroduced.
- Indexes: confirmed present on every foreign key actually filtered/joined on (section 2) — no
  missing index found.
- Pagination: none of the Experience list views (`/experiences`, `/my-experiences`,
  `/host-dashboard/experiences`, an occurrence's registrant list) currently paginate. Given the
  realistic scale of a single church's Experience catalog and a single occurrence's registrant
  count, this matches the same no-pagination precedent already used for `/lessons`,
  `/host-dashboard/members`, etc. elsewhere in this app — not a Phase 10-specific gap, and adding
  pagination now would be scope creep beyond "finalize and stabilize." Left as-is, consistent with
  existing precedent.

## 7. Accessibility and mobile review

- Every Experience form field goes through the shared `components/ui/FormField.tsx` `Field`
  component, which wraps its input in a real `<label>` element (implicit label association) — the
  same accessible pattern used by every other form in this app (e.g.
  `app/onboarding/church/page.tsx`). No unlabeled input found in `ExperienceForm.tsx`,
  `OccurrenceForm.tsx`, or `WalkInForm.tsx`.
- No icon-only button (an interactive element whose only content is an icon, with no visible text
  and no `aria-label`) found anywhere under `components/experiences/`.
- Layout classes (`flex-wrap`, `grid sm:grid-cols-2`, `max-w-*`) are used consistently across every
  Experience page, matching the responsive conventions already established elsewhere in the app.
- No accessibility or mobile defect found that isn't already covered by the app-wide existing
  pattern. No fix made in this section — narrowly scoped review, nothing to narrowly fix.

## 8. Error, loading, and empty-state audit

Every one of the 10 Experience routes (`/experiences`, `/experiences/[experienceId]`,
`/my-experiences`, `/host-dashboard/experiences`, `.../new`, `.../[experienceId]`, `.../edit`,
`.../occurrences/new`, `.../occurrences/[occurrenceId]`, `.../occurrences/[occurrenceId]/edit`)
uses the shared `ErrorState`/`EmptyState` components from `components/ui/AsyncState.tsx`. The
`createClient()`-outside-try-catch bug that caused a raw 500 instead of a graceful error state was
found and fixed in Phase 10.3 and re-confirmed still fixed this phase (section 4, row 16). No new
route missing an error/empty state was found. All pages are server components with
`dynamic = "force-dynamic"`, matching this app's existing convention of not using a separate
`loading.tsx` anywhere else in the tree either.

## 9. Code-quality review

- **`churches[0]`**: remaining occurrences are exactly the same page-entry-point-only pattern
  already documented as accepted technical debt in Phase 10.2/10.3 —
  `app/host-dashboard/experiences/page.tsx` and `app/host-dashboard/experiences/new/page.tsx` (plus
  every other pre-existing Host Dashboard page: `church-profile`, `members`, `testimonies`,
  `lesson-requests`). No service, action, or RPC uses `churches[0]` anywhere. A multi-church
  selector remains explicitly out of scope for this phase per the brief and is not implemented.
- **`any` usage**: the `row: any` parameter in each of `churchExperiences.ts`'s row-mapper
  functions (`mapChurchExperience`, `mapChurchExperienceLessonLink`,
  `mapChurchExperienceOccurrence`, `mapChurchExperienceRegistration`) matches the exact
  pre-existing convention used by every other service file's row mappers
  (`services/supabase/churches.ts`, `lessons.ts`, `testimonies.ts` all do the same, each with the
  same `eslint-disable-next-line` comment). Not a new deviation.
- **Lint-rule suppressions**: every `eslint-disable` in the Experience Platform code is one of
  these same pre-existing `row: any` mapper suppressions, plus the one deliberate
  `@typescript-eslint/no-explicit-any` in `tests/churchExperienceForm.test.ts` for a
  deliberately-invalid test input. No suppression was added to silence a genuine lint violation.
- **Dead code**: found and removed one instance this phase — `getMyRegistrationForOccurrence`,
  made fully unused by the section 6 N+1 fix (see that section).

## 10. Bug fixes

| # | Defect | Root cause | Fix | Regression test |
|---|---|---|---|---|
| 1 | Member Experience detail page fires one DB query per upcoming occurrence instead of one batched query | `Promise.all(occurrences.map((o) => getMyRegistrationForOccurrence(supabase, o.id)))` in `app/experiences/[experienceId]/page.tsx` | Added `getMyRegistrationsForOccurrences` (single `.in()` query); removed the now-dead per-occurrence function; updated the page | Two new tests in `tests/churchExperienceAuthorization.test.ts` (batched-query shape + page call site) |

No other verified defect was found this phase. No speculative/hypothetical fixes were made.

## 11. Deferred work (explicitly out of scope, unchanged)

Per the Phase 10.3/10.4 briefs: Square payment integration, Credits, ChatGPT-assisted content,
occurrence recurrence/templates, cross-church discovery, anonymous registration, a new ministry
role, a multi-church selector, and notification infrastructure. Also per standing memory: Phase 3
real AI/content extraction and Phase 4 Experience Selection/Credits/Scheduling remain separate
future phases, not touched here.

## 12. Files modified this phase

- `services/supabase/churchExperiences.ts` — replaced `getMyRegistrationForOccurrence` with batched
  `getMyRegistrationsForOccurrences`.
- `app/experiences/[experienceId]/page.tsx` — use the batched function; `myRegistrations` reverted
  from `const` back to `let` (it's reassigned again, correctly this time as a real, not accidental,
  reassignment).
- `tests/rlsChurchIsolation.test.ts` — 3 new published-or-managed SELECT policy tests.
- `tests/churchExperienceAuthorization.test.ts` — 2 new N+1-regression-guard tests.
- `docs/PHASE10_4_AUDIT.md` — this document.
- `docs/PHASE10_FINAL_RELEASE_CHECKLIST.md` — new.
- `docs/PHASE10_IMPLEMENTATION_PLAN.md` — status note appended.

## 13. Test totals

Before this phase: 132/132 passing. After: **137/137 passing**, 0 failures, 0 skipped.

## 14. Final quality gates (re-run after all fixes)

- `npm run lint`: 0 errors, 15 pre-existing warnings (unchanged, unrelated to Experience Platform).
- `npx tsc --noEmit`: clean.
- `npm test`: 137/137 passing.
- `npm run build`: succeeds, all Experience routes present.

## 15. Live database verification results (raw, condensed)

```
migration list: 0001..0026 local == remote, no gaps, no extras
pg_proc: register_for_experience_occurrence | prosecdef=true | search_path=""
         cancel_experience_registration      | prosecdef=true | search_path=""
         promote_waitlist_registration       | prosecdef=true | search_path=""
         record_experience_walk_in           | prosecdef=true | search_path=""
         promote_next_waitlisted             | prosecdef=true | search_path=""
         sync_journey_on_experience_completion| prosecdef=true | search_path=""
         protect_church_experience_ownership  | prosecdef=true | search_path=""
pg_policies: church_experience_registrations -> select_own, select_managed, update_managed (no insert/delete policy)
             church_experiences -> write_managed (ALL), select_published_or_managed (SELECT)
             church_experience_occurrences -> write_managed (ALL), select_follows_experience (SELECT)
             church_experience_lessons -> write_managed (ALL), select_follows_parents (SELECT)
role_table_grants: anon/authenticated both hold broad default privileges on church_experience_registrations (project-wide default, harmless given RLS)
routine_privileges: anon/authenticated/postgres/service_role all hold EXECUTE on the 4 public RPCs (project-wide default, harmless given internal auth.uid() checks)
pg_indexes: all FK/lookup columns indexed on all 4 church_experience_* tables
```

## 16. Known limitations (carried forward, unchanged)

- `churches[0]` remains at page-entry points only (documented technical debt, multi-church
  selector out of scope).
- No true integration test suite exists in this repo (`node:test` structural/static tests only);
  a real click-through requires `.env.local` or a Vercel Preview, neither available in this
  sandbox this phase.
- No pagination on Experience list/registrant views (matches existing app-wide precedent, not a
  regression).

## 17. Deviations from the Phase 10.4 brief

None. Every reviewed area (baseline, migrations/DB, tests, manual QA, security, performance,
accessibility, error states, code quality) was actually checked against live code/DB state, not
assumed. The one verified defect found was fixed with the smallest possible change and a
regression test, per the brief's bug-fix protocol.

## 18. Sign-off

Working tree is clean and committed at the end of this phase (see the Phase 10.4 commit). No
push, no merge to `main`, no Vercel/deployment change was made. Phase 11 ("Kingdom Economy") was
not started.

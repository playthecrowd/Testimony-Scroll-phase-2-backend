# Phase 10.2 — Experience Service/Data Layer

Date: 2026-07-18. Data-layer-only, per `docs/PHASE10_IMPLEMENTATION_PLAN.md`'s Phase 10.2 scope:
no UI, page, route, or navigation was added — nothing yet calls this module.

## What was built

`services/supabase/churchExperiences.ts` — query/mutation functions over the schema landed in
Phase 10.1, following this repo's established `services/supabase/*.ts` conventions exactly
(accepts a `SupabaseClient` instance rather than constructing one, a `mapX(row: any)` mapper per
shape, `if (error) throw error;`, no dedicated unit tests for this layer — same as every other
services module):

- `mapChurchExperience`, `mapChurchExperienceLessonLink` — row mappers.
- `getManagedExperiences(supabase, churchId)` — a church's own Experiences, host/admin view.
- `getExperienceById(supabase, id)` — RLS-gated exactly like `getLessonBySlug`/`getEventById`: a
  published Experience is visible to any member of its church, a draft only to that church's
  host/admin.
- `getPublishedExperiencesForMember(supabase, churchIds: string[])` — member-facing discovery,
  takes every church the caller belongs to (never a single implicit church).
- `createExperience` / `updateExperience` / `updateExperienceStatus` — CRUD and the
  draft→published→archived lifecycle. `updateExperience`'s input type deliberately excludes
  `churchId` (ownership is never reassignable through this function — see "Known limitations"
  below).
- `getExperienceLessons` / `replaceExperienceLessons` — the lesson-link join table, delete-then-
  insert, mirroring `replaceLessonExperiences` (`services/supabase/experiences.ts`) exactly.

Every function takes an explicit `churchId`/`experienceId` parameter — none assumes "the caller's
only church" (owner decision 3 of 10, 2026-07-18). No registration/attendance mutation lives here:
those only ever go through the four `SECURITY DEFINER` RPCs added in Phase 10.1, called directly
via `supabase.rpc(...)` wherever a later stage needs them.

## Deviations

None from `docs/PHASE10_IMPLEMENTATION_PLAN.md`'s Phase 10.2 section — implemented exactly as
scoped (file, function list, "no UI/tests at this stage").

## Known limitations

- **`updateExperience` cannot reassign `churchId`, but this is enforced only at this service-layer
  boundary, not by a database trigger.** A host who manages two churches could still, via a raw
  `PATCH` bypassing this service function, reassign an Experience between the two churches they
  both manage (RLS's `is_church_manager(church_id)` check alone permits it, since it would pass for
  either church). No `protect_*_ownership`-style trigger exists yet for this table (unlike
  `lessons`/`testimonies`). Flagged as a minor, narrow edge case (requires a host who manages
  multiple churches specifically choosing to do this) rather than fixed now, consistent with "do
  not overcomplicate v1" — a two-line trigger, exactly like `protect_lesson_ownership`
  (`0003_functions.sql`), would close this if it's ever wanted.
- No live Supabase project exists in this environment, so none of these functions have been
  exercised against a real database — code-reviewed and typechecked only, same limitation every
  prior phase has documented.

## Verification results

| Command | Result |
|---|---|
| `npm run lint` | 0 errors, 15 warnings (unchanged) |
| `npx tsc --noEmit` | Clean |
| `npm test` | 94/94 passing (unchanged — no new tests, per this stage's own scope) |
| `npm run build` | Successful — identical route manifest (no routes added) |

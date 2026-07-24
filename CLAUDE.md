# Testimony Scroll / Quest for the Kingdom — Notes for Claude

## Before touching journey, lesson, authentication, profile, or navigation code

Read `docs/REQUIRED_FEATURES.md` and `docs/REGRESSION_CHECKLIST.md` first. They record behaviors
that must not regress, including:

> Every lesson created through Build Experience must automatically work with the shared member
> journey and Studied-stage system. Journey routes, checklist generation, progress persistence,
> and My Journey integration must be dynamic and must never require lesson-specific code, routes,
> migrations, or manual developer setup.

Concretely, this means:

- Never hard-code a lesson id, slug, or church into journey/route logic. The shared route
  `/journey/[lessonId]/studied` (`lessons.id`, a UUID) must keep working for every lesson,
  including ones that don't exist yet.
- Checklist items come from `lib/journeyChecklist.ts`'s fixed, content-driven key vocabulary --
  never from a `lesson_media` row id or a displayed title. Don't add lesson-specific branching.
- Member journey progress (`public.lesson_journeys`, `public.lesson_journey_items`) is the
  persistent source of truth, not `localStorage` or React state. RLS restricts every row to its
  own `auth.uid()`; don't weaken that, and don't grant Hosts automatic read access to it.
- Host-only UI (e.g. "Build Experience") is gated from one shared source,
  `lib/navigation.ts` -- update it there, not by re-adding a separate role check in `Sidebar.tsx`
  or `TopBar.tsx`.
- A `/journey/` link must never point at a route that doesn't exist. A stage without a real page
  yet shows `components/journey/StageComingSoon.tsx`, not a 404.

## After pushing to Production

Read `docs/DEPLOYMENT_VERIFICATION_STRATEGY.md` before verifying any deploy. In short: don't
conclude a deploy hasn't landed from one JS-chunk fingerprint alone (a change can land as a
CSS-only or partial-chunk rehash); verify the actual DOM/behavior the commit introduced via
cache-busted requests to the affected routes, retry once after ~5 minutes, and only then ask the
owner to check AWS directly.

## General

- Branch conventions, migration numbering (`supabase/migrations/000N_*.sql`), and RLS patterns are
  established in existing migrations -- follow the existing shape (e.g. `private.is_church_manager`
  for church-scoped access) rather than inventing a new authorization pattern.
- No large test framework is installed; regression tests use Node's built-in `node:test` runner
  via `tsx` (`npm test`, `tests/*.test.ts`). Don't add Jest/Vitest/Playwright without first
  reporting why it's needed.

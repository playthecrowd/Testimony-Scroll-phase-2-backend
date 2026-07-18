# Phase 9.5 — Stabilization and Production Hardening

Date: 2026-07-18.

## 1. Purpose and scope

Phase 9.5 is a non-feature stabilization pass following the completed 9-phase roadmap (Phases
1–9). Its only goals were to: resolve every existing ESLint error, remove straightforward dead
code, confirm the app still typechecks/builds/tests cleanly, reduce and document the remaining
`@next/next/no-img-element` warnings, and produce this readiness report. No product features,
schema changes, or visual redesigns were made. No behavior was changed except where a lint fix
required a small, deliberate correction (documented per-item below), and one genuine correctness
improvement found while fixing a flagged line (`LessonDetailClient.tsx`, item 4 below).

## 2. Branch used

All work was done on `Production`. `main` was not touched, read, or referenced in any git
command. Per project convention (see memory), `Production` is the active development branch and
`main` is the approved live release branch that Vercel's Production environment tracks — that
mapping was left exactly as-is.

## 3. Baseline command results (before any edit)

| Command | Result |
|---|---|
| `git branch --show-current` | `Production` |
| `git status` | Clean, up to date with `origin/Production` |
| `npm run lint` | **44 problems: 14 errors, 30 warnings** — matches the prior audit exactly, no drift |
| `npx tsc --noEmit` (no `type-check` script exists in `package.json`) | Clean, exit 0 |
| `npm test` | 79/79 passing |
| `npm run build` | Successful, same 63-route manifest as before |

No discrepancy from the prior audit, so no baseline-mismatch stop was needed. Working tree was
already clean, so no safety commit was required before starting.

## 4. Every lint error fixed (14 → 0)

| # | File:line | Rule | Fix |
|---|---|---|---|
| 1 | `app/badges/page.tsx:20` | `react-hooks/set-state-in-effect` | Replaced `useState`+`useEffect` mock read with a plain derived `const earned = ready && session.isLoggedIn ? getUserBadges(...) : []`. |
| 2 | `app/contribute/page.tsx:17` | same | Same derived-value pattern for `journeys`. |
| 3 | `app/dashboard/page.tsx:39` | same | Same pattern for `journeys`; also removed the dead `tick`/`setTick` state in the same edit (see §5). |
| 4 | `app/lessons/[lessonId]/LessonDetailClient.tsx:113` | same | See below — this one got a more careful fix than a literal "delete the line," because the literal fix would have introduced a latent bug. |
| 5 | `app/my-journey/page.tsx:27` | same | The anonymous-visitor branch now just `return`s from the effect; `loading`'s `true` default is never rendered for anonymous visitors anyway (a separate `!session.isLoggedIn` guard returns the sign-in prompt first), so no state transition was needed there at all. |
| 6 | `app/notifications/page.tsx:24` | same | `notifs` is now a plain derived value; a `refreshKey` state (bumped by the "Mark all read" button) forces recomputation after the mutation, replacing the old `setNotifs(...)` call. |
| 7 | `app/journey/[lessonId]/added-to-story/page.tsx:27` | same | Same `refreshKey`-forces-rerender pattern; `publish()` no longer calls `setJourney` directly. |
| 8 | `components/layout/Sidebar.tsx:20` | same | `unread` is now a plain derived value (`session.isLoggedIn ? getUnreadCount(...) : 0`), recomputed naturally on every render (including on `pathname` change, since the component already re-renders then). |
| 9 | `components/layout/TopBar.tsx:23` | same | Same as Sidebar. |
| 10 | `app/journey/[lessonId]/applied/page.tsx:62` | same | See §6 (mock journey pages) — ref-guard + `queueMicrotask`, not a derived-value refactor. |
| 11 | `app/journey/[lessonId]/experienced/page.tsx:35` | same | Same as #10. |
| 12 | `app/host-dashboard/page.tsx:111` | `react-hooks/purity` (`Date.now()`) | Extracted a new `isWithin(dateStr, windowMs)` helper into `lib/utils.ts` that calls `Date.now()` internally — the component body no longer calls an impure function directly. `force-dynamic` and the 7-day "New" badge behavior are unchanged. |
| 13 | `app/leaderboard/page.tsx:21` | `react-hooks/preserve-manual-memoization` | Removed the manual `useMemo` entirely (the underlying filter/slice over a small mock array is cheap) and replaced it with plain sequential `let`/`const` derivation. React Compiler is now free to memoize the component itself instead of fighting the existing manual memoization. |
| 14 | `app/profile/page.tsx:19` | `react-hooks/set-state-in-effect` | Same derived-value pattern as #1/#2 for `counts`. |

**Item 4 in more detail**, since the literal instruction ("remove the same-value `setHasJourney(false)` call") turned out to be based on an incomplete premise worth flagging: the call is a no-op *on mount* (the `useState(false)` default already matches), but it is **not** a no-op if a user logs out while this page stays mounted (no full navigation) after previously having `hasJourney = true` — deleting the line outright would have left a stale "Continue Your Journey" state visible to a now-signed-out visitor. The actual fix: renamed the raw fetched flag to `journeyExists`, and compute `const hasJourney = ready && session.isLoggedIn && journeyExists` at render time. The effect now only ever calls `setJourneyExists` from inside its async branch (never synchronously), and the session-gating happens at the derived-value layer instead of by resetting state from the effect. This removes the lint violation *and* is more correct than a literal delete would have been. No user-visible behavior changed from what a signed-in visitor with a journey already sees today; it only closes a latent edge case.

One check-then-fix worth recording: the `refreshKey` pattern (items 6–7) initially used `useMemo` with `refreshKey` listed as a dependency but never read inside the memoized function. That's a legitimate technique for cache-busting, but it triggered a *new* `react-hooks/exhaustive-deps` warning ("unnecessary dependency") that didn't exist before. Caught this via a scoped `npx eslint` re-check before moving on, and switched both to plain derived consts (no `useMemo` at all) — `refreshKey`'s sole job is to trigger a re-render via `setRefreshKey`, which a plain derived expression picks up automatically with no dependency array to warn about.

## 5. Dead code / unused-import warnings fixed (4 of the 30 original warnings)

- `app/dashboard/page.tsx` — removed `tick`/`setTick` (confirmed `setTick` had zero call sites anywhere; the state was intended as a manual refresh trigger that was never wired up, so it was pure dead weight).
- `app/journey/[lessonId]/applied/page.tsx` — removed unused `formatDate` import.
- `app/journey/[lessonId]/experienced/page.tsx` — removed unused `getHostById` import.
- `app/page.tsx` — removed unused `LessonCard` import (see §10 for a related observation).

## 6. Mock journey pages (`journey/applied`, `journey/experienced`) — smallest safe correction

Per the explicit instruction not to redesign these routes (they're getting a real Supabase-backed
rebuild in a later phase), the fix here is deliberately different from the derived-value pattern
used elsewhere:

- Added a `useRef<string | null>` (`startedForLessonRef`) that records which `lesson.id` the
  mutating `startJourney()` call has already run for.
- Wrapped the actual read/create/set logic in `queueMicrotask(...)`, which moves the `setJourney`/
  `setSubmitted`/`setResult` calls out of the effect's synchronous commit phase (confirmed via a
  scoped `npx eslint` run that this alone resolves the `set-state-in-effect` violation — the rule
  is a static, lexical-scope check, not a data-flow one).
- The ref check happens **before** scheduling the microtask, so React Strict Mode's dev-only
  double-invoke (setup → cleanup → setup again, all synchronous) sees the ref already set on its
  second invocation and skips scheduling a second microtask — `startJourney()` runs at most once
  per lesson per mount.
- The ref is keyed by `lesson.id` (not a single boolean), so navigating between two different
  lessons' `applied`/`experienced` pages without a full remount still creates a journey for the
  new lesson correctly.

No schema change, no redesign, no new dependency. Both files carry a comment stating plainly that
they're mock/demo routes awaiting the real-data rebuild.

## 7. Warnings fixed — image conversions (11 of 26 `no-img-element` instances)

Classified every occurrence before touching anything (see the full table in §8 for what was
deferred and why). Converted to `next/image` only where the source domain is either a local
`/public` asset or one of the two already-whitelisted mock/seed hosts (`picsum.photos`,
`ui-avatars.com` — see `next.config.ts`), confirmed per-file by tracing the actual data source,
not by assumption:

| File | What changed |
|---|---|
| `components/auth/AuthScreen.tsx` | Full-bleed hero photo → `fill` + `sizes="50vw"` |
| `app/page.tsx` (×3) | Featured lesson thumbnail, quest preview, testimony avatar → `fill`/fixed `width`/`height` as appropriate |
| `components/lessons/LessonCard.tsx` | Speaker avatar (mock data, `ui-avatars.com`) → fixed 20×20 |
| `app/dashboard/page.tsx` (×2) | Lesson thumbnails (mock, `picsum.photos`) → fixed 40×40 and `fill` |
| `components/layout/FeaturedEventBanner.tsx` | Banner image (local `/public/images/backgrounds/...`) → `fill` + `sizes="100vw"` |
| `components/layout/AccountMenu.tsx` | Current (mock) session avatar → fixed 32×32 |
| `components/layout/PageBackground.tsx` | Shared full-bleed page background (local asset, used on ~15 pages) → `fill` + `sizes="100vw"` + `priority` (preserves the original `<img>`'s eager-load behavior; `next/image` defaults to lazy otherwise) |
| `app/profile/page.tsx` | Mock session avatar (same source as AccountMenu) → fixed 80×80 |

Every conversion preserves the original dimensions/aspect ratio, keeps `object-cover` where it was
already there, and keeps existing `alt` text (empty `alt=""` for purely decorative images, as it
already was). Verified with a scoped `npx eslint` per file plus a full `npx tsc --noEmit` and
`npm run build` at the end — no new errors, no new warnings, build unaffected.

## 8. Warnings intentionally deferred, with reasons (15 remaining)

| File:line | Category | Reason |
|---|---|---|
| `app/backstories/[characterId]/page.tsx` (×2) | 4 — mock page | Explicitly named as deferrable ("Mock Journey and backstory pages may remain deferred"). |
| `app/contribute/page.tsx:55` | 4 — mock page | Reads `services/lessonService` (mock), not in the priority list; not worth touching before its own eventual real-data pass. |
| `app/journey/[lessonId]/added-to-story/page.tsx:76` | 4 — mock page | Same mock-journey family as applied/experienced; deferred for the same reason even though not explicitly named in Step D's file list. |
| `app/journey/[lessonId]/applied/page.tsx` (×2) | 4 — mock page, explicit | Step D explicitly restricted this file to "the smallest safe correction needed to remove the lint error" — image conversion is out of scope here by direct instruction. |
| `app/journey/[lessonId]/experienced/page.tsx` (×2) | 4 — mock page, explicit | Same as above. |
| `app/leaderboard/page.tsx:89` | 4 — mock page | Reads `services/questService`/`data/users` (mock); not in the priority list. |
| `app/profile/page.tsx` | *(fixed — see §7, not deferred)* | — |
| `app/churches/[churchId]/page.tsx:62` | 3 — dynamic/user-supplied | `church.logoUrl` is a **free-text URL field** a Host types into `ChurchProfileForm.tsx` (confirmed by reading that form) — not a Storage-upload pipeline. A real church's logo could point to any domain. Converting this would require either an unsafe wildcard `remotePattern` (explicitly disallowed) or per-image `unoptimized`, defeating the point. |
| `app/churches/page.tsx:54` | 3 — dynamic/user-supplied | Same field, church list view. |
| `app/lessons/[lessonId]/LessonDetailClient.tsx` (×3) | 3 — dynamic/user-supplied | One is `lesson.speaker.avatarUrl` (a real `speakers.avatar_url` DB column with no confirmed upload UI anywhere in the app — effectively an unconstrained value if ever set directly in the database); the other two are the same free-text `church.logoUrl` as above, shown per hosting-church in the host-switcher list. |
| `components/lessons/PublishedLessonCard.tsx:61` | 3 — dynamic/user-supplied | Same `speaker.avatarUrl` concern as above — this is the real (Supabase-backed) card component used on `/lessons`. |

None of the 15 deferred warnings are new; all 15 were present in the original 30-warning baseline.

## 9. Files changed (21)

```
app/badges/page.tsx
app/contribute/page.tsx
app/dashboard/page.tsx
app/host-dashboard/page.tsx
app/journey/[lessonId]/added-to-story/page.tsx
app/journey/[lessonId]/applied/page.tsx
app/journey/[lessonId]/experienced/page.tsx
app/leaderboard/page.tsx
app/lessons/[lessonId]/LessonDetailClient.tsx
app/my-journey/page.tsx
app/notifications/page.tsx
app/page.tsx
app/profile/page.tsx
components/auth/AuthScreen.tsx
components/layout/AccountMenu.tsx
components/layout/FeaturedEventBanner.tsx
components/layout/PageBackground.tsx
components/layout/Sidebar.tsx
components/layout/TopBar.tsx
components/lessons/LessonCard.tsx
lib/utils.ts
```

No migrations, no `.env`/secret files, no build artifacts, no unrelated files.

## 10. Manual QA completed — and its real limits in this environment

No browser-automation tool is available in this session (no Playwright/Puppeteer-equivalent), and
this environment has no `.env.local` — confirmed absent, only `.env.example` exists — so there is
no live Supabase project to sign into. Given those two hard constraints, QA here means:

- **Code verified locally**: every change above was reasoned through against the actual
  surrounding code (not just the flagged line) before editing — confirmed via `Read` of full
  file context, and in three cases (`LessonDetailClient`, `notifications`, `added-to-story`)
  the first-draft fix was caught and corrected after a targeted `npx eslint <file>` re-check
  surfaced a new warning that a broader `npm run lint` would have caught anyway.
- **Build verified**: `npx tsc --noEmit`, `npm run lint`, `npm test` (79/79), and `npm run build`
  all run clean after every change, not just at the end.
- **Route-render verified**: started `npm run dev` and requested every changed route
  (`/`, `/badges`, `/contribute`, `/dashboard`, `/notifications`, `/profile`, `/my-journey`,
  `/leaderboard`, `/journey/demo-lesson-1/{applied,experienced,added-to-story}`, `/lessons`,
  `/lessons/some-slug`, `/churches`, `/host-dashboard`). All returned `200` except
  `/host-dashboard`, which returned `500` with a `SupabaseConfigError` — confirmed via
  `git diff` that my only change to that file is the `Date.now()` extraction, and the 500 is the
  same pre-existing "no Supabase credentials in this environment" condition every prior phase
  documented (the `createClient()` call that throws sits outside that page's own try/catch,
  unrelated to anything touched here).
- **Mock flow manually verified**: only at the HTTP level (route renders, no crash). The mock
  `SessionContext` used by `badges`/`contribute`/`dashboard`/`notifications`/`profile`/
  `Sidebar`/`TopBar`/`AccountMenu`/journey pages resolves client-side after hydration
  (`if (!ready) return null` gates every one of them), so a `curl` response only ever shows the
  pre-hydration shell — it cannot demonstrate the logged-in/logged-out toggle, the "Mark all
  read" button, the "Publish to the Kingdom Scroll" button, or the notification badge updating
  during navigation. Those specific interactive behaviors are **reasoned-through-code-verified,
  not click-tested**, in this pass.
- **Real Supabase flow not verified**: `my-journey`'s real fetch, `LessonDetailClient`'s real
  `getJourneyForLesson` lookup, and `host-dashboard`'s real per-church stats were not exercised
  against a live database, for the same credential-absence reason documented in every prior
  phase's audit.

If browser automation or live Supabase credentials become available, the click-level checks
called out in the task (login/logout, notification badge live-updates while navigating, mark-all-
read, publish-to-scroll, no duplicate journey created) should be run for real before this is
called fully verified end-to-end.

## 11. Automated verification completed

| Check | Result |
|---|---|
| `npm run lint` | **0 errors, 15 warnings** (down from 14/30) |
| `npx tsc --noEmit` | Clean |
| `npm run build` | Successful — identical 63-route manifest to the pre-Phase-9.5 build |
| `npm test` | 79/79 passing (no test touches the files changed here directly; this confirms no regression in the RLS/business-logic suite) |

## 12. Known limitations

- The 15 deferred `no-img-element` warnings remain (documented above, all pre-existing).
- `components/lessons/LessonCard.tsx` is now provably unimported anywhere in the app (its only
  call site, `app/page.tsx`, already had the import unused before this phase — that's *why* the
  original lint warning existed). Its sibling file, `components/lessons/PublishedLessonCard.tsx`,
  has a comment claiming `LessonCard.tsx` "stays untouched and keeps serving the still-mocked
  homepage" — that comment is now stale (the homepage doesn't render it). Left both files alone
  since deleting a component and fixing a cross-file comment is a step beyond "remove unused
  imports" and wasn't asked for; flagging it here as a candidate for a future, explicitly-scoped
  cleanup pass.
- Interactive/browser-level QA gaps listed in §10 above.
- Two parallel auth/session systems continue to coexist in this codebase (the mock
  `SessionContext` powering Dashboard/Profile/Badges/Notifications/Contribute/Leaderboard/the
  mock Journey pages, versus real Supabase auth powering `/login`, `/host-dashboard`,
  `/lessons`, `/admin/*`, etc.). This predates Phase 9.5 and wasn't introduced or expanded here;
  noting it because it's directly why some of this phase's fixes (e.g., items 1–3, 6–9, 14 in
  §4) could be resolved with simple derived values while others (my-journey, LessonDetailClient,
  host-dashboard) needed to preserve real async Supabase fetch logic.

## 13. Mock/demo routes still awaiting real implementation

Unchanged from prior phases' findings — no new mock surfaces were discovered or created:
- `app/journey/[lessonId]/applied/page.tsx`, `app/journey/[lessonId]/experienced/page.tsx`,
  `app/journey/[lessonId]/added-to-story/page.tsx` — mock `services/journeyService` /
  `services/testimonyService` / `services/storyService`, awaiting the real member-journey rebuild.
- `app/backstories/[characterId]/page.tsx` — mock, not connected to real character/testimony data.
- `app/dashboard/page.tsx`, `app/badges/page.tsx`, `app/notifications/page.tsx`,
  `app/profile/page.tsx`, `app/contribute/page.tsx`, `app/leaderboard/page.tsx` — all still read
  through the mock `SessionContext`/`services/*Service.ts` layer, not real Supabase auth/data.

## 14. Supabase checks still requiring live credentials

- `app/host-dashboard/page.tsx` — real per-church stats (lessons, member count, requests,
  testimonies) and the "New" lesson badge fix specifically.
- `app/my-journey/page.tsx` — real `getUserJourneysWithLessons` fetch.
- `app/lessons/[lessonId]/LessonDetailClient.tsx` — real `getJourneyForLesson` lookup behind the
  `hasJourney`/`journeyExists` fix, and the logout-while-mounted edge case it now correctly
  guards against.
- All `/admin/*` pages, `/churches`, `/lessons`, `/kingdom-scroll`, `/events`, `/episodes`,
  `/characters` (unchanged this phase, listed for completeness of what's still credential-gated).

## 15. Schema confirmation

**No schema migrations were added, modified, or considered necessary in Phase 9.5.** Every fix in
this phase was application-code-only (React components/hooks and one new utility function in
`lib/utils.ts`). No table, column, RLS policy, or trigger was touched.

## 16. Branch/deployment confirmation

- All work was committed to `Production` only.
- `main` was never checked out, diffed, merged into, or pushed to.
- Vercel's configured Production Branch (`main`) was not changed, inspected via the dashboard, or
  otherwise touched — this phase made no Vercel API/dashboard calls at all.
- Nothing in this phase was deployed; the commit is local-then-pushed-to-`Production` only, per
  the explicit instruction not to deploy or merge to `main`.

## 17. Recommended next phase

Two independent tracks, either of which the user can pick up next:

1. **The already-planned real member-journey rebuild** (replacing `services/journeyService` /
   `services/testimonyService` / `services/storyService` and the mock `SessionContext` pages
   listed in §13 with real Supabase-backed equivalents, matching the pattern already established
   for lessons/churches/testimonies/events). This is the natural next large phase and was already
   anticipated by name in this phase's comments.
2. **A small, explicitly-scoped follow-up** to close the two items flagged in §12: delete the
   now-fully-orphaned `LessonCard.tsx` and fix the stale comment in `PublishedLessonCard.tsx`
   that references it — a two-file, low-risk cleanup that didn't fit this phase's "remove unused
   imports, don't restructure components" boundary.

Either way, the AI-extraction phase you're writing up separately remains parked exactly as before
— nothing in Phase 9.5 touches or depends on it.

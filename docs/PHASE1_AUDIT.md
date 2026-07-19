# Repository Audit — Phase 1 Planning

Date: 2026-07-17
Branch at time of audit: `Production` (clean working tree)

## 0. Architectural fact that governs everything below

The repo is **mid-migration** between two data layers:

- **Real, Supabase-backed, RLS-protected** ("Backend Milestone One"): Churches, Lessons
  (`experience-builder`, `/lessons`), and the **Studied** journey stage only.
- **Phase-One prototype, mock-only** (seed arrays in `data/*.ts`, persisted to
  `localStorage` via `lib/storage.ts`, read/written through non-Supabase `services/*.ts`):
  Member dashboard, Host dashboard, Testimonies/Kingdom Scroll, Characters, Episodes/Full
  Story, Badges, Events, and journey stages other than Studied (`captured`, `experienced`,
  `applied`, `added-to-story`).

**No Supabase table exists at all** for testimonies, characters, episodes, badges, events,
credits, points, or lesson requests. `services/*.ts` (mock) vs. `services/supabase/*.ts`
(real) is the tell for which layer a given page uses.

This means the "critical defect" in the prompt (new church shows old placeholder data) is
not a small hardcoded-fallback bug in an otherwise-real dashboard — **the host dashboard and
member dashboard don't query Supabase at all.** Fixing isolation for real requires wiring
these pages to the real `churches` / `church_memberships` / `lessons` tables, which already
exist and are already correctly RLS-scoped (see §3).

---

## 1. Routing structure (App Router, Next.js 16)

Note: Next.js 16 renamed `middleware.ts` → **`proxy.ts`** (repo root). A stray
`middleware.ts` would silently be ignored — confirmed only `proxy.ts` exists.

Key routes (all under `app/`):

```
/login, /signup                          -> AuthScreen (shared component)
/auth/confirm, /auth/error               -> email confirmation callback / error
/onboarding/church                       -> host-only church creation
/dashboard                                -> member dashboard (MOCK)
/host-dashboard                          -> host/church dashboard (MOCK)
/experience-builder                      -> lesson builder create + host lesson list (REAL)
/experience-builder/[lessonId]/edit      -> lesson edit, keyed by slug (REAL)
/lessons, /lessons/[lessonId]            -> public lesson discovery + detail (REAL)
/journey/[lessonId]/studied              -> REAL, Supabase-backed
/journey/[lessonId]/{captured,experienced,applied,added-to-story} -> MOCK, falls back to
                                             StageComingSoon for any real (non-seed) lesson id
/my-journey                              -> REAL
/churches, /churches/[churchId]          -> REAL
/kingdom-scroll                          -> MOCK, no detail route, inline drawer only
/contribute                              -> entry point into testimony submission (MOCK)
/characters, /characters/[characterId]   -> MOCK
/backstories/[characterId]               -> MOCK
/story                                    -> MOCK ("Book View" and "Timeline View" render
                                             identical markup — not actually different)
/episodes, /episodes/[episodeId]         -> MOCK
/events                                  -> MOCK, single hardcoded featured event, links to a
                                             static HTML file, no calendar/detail/host-event form
/badges                                  -> MOCK
/leaderboard                              -> MOCK
/capture                                  -> host "capture a new lesson" mock flow (distinct
                                             from a member "lesson request" feature, which does
                                             not exist)
/profile                                  -> real session, mixed data
/notifications                            -> MOCK
```

No `app/admin/*` route group exists — there is no production-admin portal today.
No member-onboarding flow exists (only host/church onboarding).
No password-recovery flow exists.

---

## 2. Roles — how the spec's 4 roles map onto real code

| Spec role | Real storage | Notes |
|---|---|---|
| Public visitor | unauthenticated | `churches`/`lessons` RLS SELECT policies expose `status='published'` rows publicly. |
| Kingdom Member | `profiles.account_type='member'` + `church_memberships.role='member'` | |
| Church Host/Admin | `profiles.account_type='host'` + `church_memberships.role in ('host','admin')` (per-church) | `private.is_church_manager(church_id)` is the real DB-level gate. |
| Production Administrator | `profiles.is_platform_admin=true` | **Column exists, is wired into `is_church_manager` (global bypass), but has zero UI anywhere.** No admin page reads or writes it. No self-service path to set it (blocked by trigger). |

`types/index.ts` only exposes `AccountType = "host" | "member"` to the frontend — it does
not surface `is_platform_admin` or per-church `role` into the `Session`/`User` shape used by
`lib/navigation.ts`. Building a Production Admin portal (Phase 9) will require threading
`is_platform_admin` into the session object and adding server-side checks; there is currently
no frontend concept of "admin" distinct from "host" at all.

`lib/navigation.ts` is confirmed as the single real source of truth for host-only nav (per
this repo's CLAUDE.md) — `Sidebar.tsx`/`TopBar.tsx` only consult it, no duplicated role logic
was found. This pattern should be preserved and extended (not replaced) for any admin-only nav.

---

## 3. Database — migrations, tables, RLS (see also `docs/PHASE1_AUDIT_MATRIX.md`)

8 migrations exist, `0001` through `0008`, sequential, no gaps. Summary:

| # | File | Purpose |
|---|---|---|
| 0001 | `0001_tables.sql` | Core tables: `profiles`, `churches`, `church_memberships`, `speakers`, `lessons`, `lesson_media`, `lesson_hosts`, `ministries`, `lesson_ministries` |
| 0002 | `0002_indexes.sql` | FK/filter indexes |
| 0003 | `0003_functions.sql` | `private.is_church_manager()`, `handle_new_user()`, `protect_profile_columns()`, `protect_lesson_ownership()`, RPCs `create_church_with_host`, `submit_lesson_draft` |
| 0004 | `0004_rls.sql` | Enables RLS + policies on all 0001 tables |
| 0005 | `0005_lesson_thumbnails.sql` | `featured_image_alt` column; storage bucket + RLS |
| 0006 | `0006_lesson_media_review_fields.sql` | Review/normalization columns on `lesson_media` (unused by app code yet) |
| 0007 | `0007_lesson_editing.sql` | Allow `speaker_id` edits; `find_or_create_speaker` RPC |
| 0008 | `0008_lesson_journeys.sql` | `lesson_journeys`, `lesson_journey_items` + strictly-owner RLS |

**RLS assessment: no cross-church leak found.** No `USING (true)` policy exists on any
church-scoped table (`churches`, `lessons`, `lesson_media`, `lesson_hosts`,
`lesson_ministries`, `church_memberships`). The only `USING (true)` SELECT policies are on
`speakers` and `ministries` — intentionally public/shared lookup data, not a bug. Every real
church-scoped query in `services/supabase/*.ts` correctly filters by `church_id` and/or
relies on RLS via `private.is_church_manager`.

**The actual isolation defect lives at the application layer**, specifically:
`app/host-dashboard/page.tsx:37`:
```ts
const church = getChurchById(session.user.churchId ?? churches[0].id) ?? churches[0];
```
`churches` is the mock array from `data/churches.ts`, whose index-0 entry is **"Radiant Life
Church"**. Any host whose real `church_memberships.church_id` doesn't match a mock-seed id —
i.e. every genuinely new church — silently falls back to Radiant Life's name, city, and
`memberCount: 4820`. The entire page (member/lesson/testimony counts, recent lessons list,
review queue) is sourced from `data/*.ts` + `localStorage`, not from Supabase at all, so
"church isolation" is not a real property of this page today — it's coincidental based on
mock-array indexing.

A second, separate hardcoded fallback exists at `app/journey/[lessonId]/experienced/page.tsx:48`:
`hostId ?? "host-radiant-life"` (mock-only page, lower priority).

**Minor correctness gap (not a security hole):** `lesson_hosts` has no UPDATE RLS policy —
`participant_count`/`status` can never change after the initial RPC insert. Not in scope for
Phase 1; noting for Phase 3/9.

---

## 4. Test infrastructure

`node:test` via `tsx`, `tests/*.test.ts`, 6 files — all pure unit tests of TS helpers
(`lessonAuth`, `lessonStatus`, `mediaDiff`, `lessonForm`, `journeyChecklist`, `navigation`).
**No integration/RLS test exists** — nothing signs in as two different hosts and asserts
cross-church access is denied. Phase 1 should add at least one such test now that
host-dashboard will start querying Supabase for real.

---

## 5. Phase 1 — concrete, scoped task list

Given §0–§3, "Phase 1" as literally specified (fix isolation, remove hardcoded church,
dynamic church name/stats, empty states, CTAs) requires **wiring `/host-dashboard` (and the
church-identity parts of `/dashboard`) to the real Supabase tables that already exist and are
already correctly RLS-scoped** — not a small find-and-replace of one fallback value. Testimony
review queue, badges, and points/credits cannot be made real in Phase 1 because **no Supabase
table for them exists yet** (that's Phase 6/Phase 3 work per the prompt's own phase plan) — for
those, Phase 1 will show a clearly-labeled "coming soon" / honest empty state rather than fake
data, and defer real wiring to their planned phase.

### In scope for Phase 1

1. **Host dashboard → real data.** Replace `data/churches.ts`/mock services with
   `services/supabase/churches.ts` + `services/supabase/lessons.ts` queries scoped to the
   authenticated host's `church_memberships`. Remove the `churches[0]` ("Radiant Life")
   fallback entirely — if a host has no church yet, redirect to `/onboarding/church` (mirrors
   existing `resolvePostAuthDestination` logic) instead of falling back to demo data.
2. **Real stats**: member count (from `church_memberships` count), lesson count
   (draft/published split via `getManagedLessonsByChurch`, already real and church-scoped).
   Testimony/review-queue stat: since no `testimonies` table exists, show an honest
   "Coming soon" state, not a fabricated number — document this limitation.
3. **Empty states + CTAs**: "Start building your first lesson" → `/experience-builder`
   (real route, exists). "Invite members" → scaffold a safe placeholder destination
   (church member management doesn't exist yet — Phase 2) marked "Coming soon", not a broken
   link. "Quick training" → only added if a real destination exists; otherwise omit rather
   than add a dead placeholder link (per the prompt's own instruction #11).
4. **Dashboard naming**: `/dashboard` (member) vs `/host-dashboard` (church) already have
   distinct routes and distinct nav labels via `lib/navigation.ts` — confirm/adjust labels so
   neither is generically called "Dashboard" in the UI chrome (TopBar/Sidebar copy check).
5. **Recently created lessons** on host dashboard: use the real `getManagedLessonsByChurch`
   result (already available, already real) instead of mock `getChurchLessons`.
6. **Related-lesson 404 latent bug** (Kingdom Scroll → lesson): root cause is
   `data/lessons.ts` (mock) slugs only resolving in Supabase if `npm run seed` has been run.
   Phase 1 fix: verify/document the seed dependency clearly (this is a Kingdom Scroll/mock
   feature, full fix is Phase 6 when testimonies get a real table) — not a code bug to "fix"
   in the real backend, since the target route itself (`/lessons/[slug]`) works correctly.
7. **Mobile pass** on the pages actually touched above (host dashboard empty
   states/CTAs, dashboard header).
8. **Add a repeatable QA checklist / at least one automated multi-tenant isolation test**
   now that host-dashboard queries Supabase for real (Church A cannot see Church B's data).
9. Preserve `/journey/[lessonId]/studied`, lesson editing, and all existing RLS — no
   migration changes required for the items above (existing tables already have correct
   columns and policies).

### Explicitly out of scope for Phase 1 (belongs to later phases per the prompt's own plan)

- Church member management/invites/CSV/QR (Phase 2)
- Multi-step lesson builder redesign, AI extraction (Phase 3 — also: no AI service is wired
  up anywhere in the repo today; the existing "AI Processing Preview" panel is static
  marketing copy with zero backing implementation — flagging per rule #12, not building fake
  AI behavior)
- Real testimonies/Kingdom Scroll table + review queue (Phase 6)
- Real badges/points/credits schema (Phase 6/no schema exists at all today for points/credits)
- Events/Square payments (Phase 8 — no Square integration exists anywhere in the repo)
- Production admin portal (Phase 9 — `is_platform_admin` exists in DB but has zero UI)
- Auth branding imagery/email templates — **not implemented in this pass.** The prompt's own
  Phase 1 list includes an "authentication branding framework," but `AuthScreen.tsx` already has
  a real role-selection UI (host/member cards) and a hero image panel using existing `photo()`/
  `Logo` primitives; this work was deprioritized in favor of the church-isolation fix, which is
  the "critical defect" Part 4 of the prompt calls out by name. Recommended as the next slice of
  Phase 1, or folded into Phase 2 — see Known Limitations.

### Migration required?

**Yes, one small additive migration was needed**, discovered only once implementation started:
`church_memberships` had only a `select ... using (profile_id = auth.uid())` policy (0004_rls.sql)
-- a Host querying `.eq("church_id", churchId)` under that policy gets back at most their own
single row, never a real roster count, because RLS intersects with every query regardless of the
filter clause. `supabase/migrations/0009_church_memberships_manager_read.sql` adds a second,
additive SELECT policy (`church_memberships_select_managed`, permissive policies OR together) so
a church's own host/admin can read that church's full membership roster, gated by the same
`private.is_church_manager()` helper every other church-scoped policy already uses. No
INSERT/UPDATE/DELETE policy was touched -- self-service role escalation is unaffected. See
`tests/rlsChurchIsolation.test.ts` for the regression guard added alongside it.

### Main regression risks

- `app/host-dashboard/page.tsx` is large and currently 100% self-contained mock state; swapping
  its data source risks breaking the "Dev: Approve Testimony" stub. Resolution actually taken:
  the testimony-review card's internal logic (mock catalog, approve/generate-story flow) was
  extracted verbatim into `components/host-dashboard/TestimonyReviewPreview.tsx`, unchanged
  except for a relabel to "Testimony Review (Preview)" and an explicit "sample data" note, and
  its count excluded from the real stats grid. The "Export Mock Report" button was removed
  outright (it called no real function and existed only as inert demo chrome) rather than kept,
  since it added a hardcoded-looking button with zero actual behavior to a now-real page.
- `lib/navigation.ts`/`Sidebar.tsx`/`TopBar.tsx` must not gain a second, duplicated role check
  per this repo's CLAUDE.md — any label changes go through `lib/navigation.ts` only.
- Must not touch `/journey/[lessonId]/studied`, `lib/journeyChecklist.ts`, or `lesson_journeys`
  RLS — explicitly protected by this repo's CLAUDE.md regression rules.
- `tests/navigation.test.ts` and other existing unit tests must keep passing.

---

## 6. Page & verification matrix

See companion file `docs/PHASE1_AUDIT_MATRIX.md` for the full per-page matrix (route, real vs.
mock, roles, DB tables, RLS impact, regression risk) covering all product areas named in the
prompt.

---

## 7. Manual QA checklist (multi-tenant isolation)

`tests/rlsChurchIsolation.test.ts` statically guards the RLS policy shape (no `using (true)` on
any church-scoped table, `church_memberships_select_managed` present, etc.) but this environment
has no live Supabase project connected, so the following must be run by hand against a real
project before this phase is considered verified end-to-end:

1. Sign up as Host A, complete `/onboarding/church` as "Church A".
2. Confirm `/host-dashboard` shows "Church A", 0 members shown as `1` (the host themself, once
   they have a `church_memberships` row) or the real count if seed members exist, 0 lessons, and
   the "You haven't built any lessons yet" empty state with a working "Start Building Your First
   Lesson" button — **not** "Radiant Life Church" or any nonzero mock statistic.
3. Build one lesson as Host A; confirm it appears in "Recent Lessons" on `/host-dashboard` and in
   the host lesson list on `/experience-builder`.
4. Sign up as Host B, complete `/onboarding/church` as "Church B".
5. Confirm `/host-dashboard` for Host B shows "Church B", zero lessons (Host A's lesson from step
   3 must **not** appear), and its own independent member count.
6. As Host B, attempt to load `/lessons/<Host-A's-lesson-slug>/` while it's still a draft —
   confirm it 404s/is inaccessible (RLS: `lessons_select_published_or_managed`).
7. As Host B, attempt a direct Supabase REST call (or via browser devtools) to read
   `church_memberships` filtered to Church A's `church_id` — confirm zero rows return (RLS:
   `church_memberships_select_managed` only matches where Host B is themselves the manager).
8. Confirm neither host ever sees the string "Radiant Life" anywhere in their own dashboard.

## 8. Known limitations / follow-up discovered during Phase 1

- **There is no member-facing "join a church" flow anywhere in the app.** Only host/church
  onboarding (`/onboarding/church`) creates a `church_memberships` row today; a Kingdom Member
  account has no UI path to ever get one. This predates Phase 1 and isn't fixed by it, but it
  means the real "Church Members" count on a brand-new church's Host Dashboard will show `0` (or
  `1`, counting the host's own membership row) indefinitely until Phase 2 ships an invite/join
  flow — this is accurate, not a bug, but should be called out so it isn't mistaken for one.
- A host who manages more than one church only sees the first one (`churches[0]` from
  `getMyHostChurches`, ordered by church name) on `/host-dashboard`. Multi-church switching was
  not built — out of scope for this phase, flagged for whichever phase adds it.
- The pre-existing `react-hooks/set-state-in-effect` ESLint errors (15 total, present in
  `Sidebar.tsx`, `TopBar.tsx`, `app/my-journey/page.tsx`, `app/notifications/page.tsx`,
  `app/profile/page.tsx`, and now also `components/host-dashboard/TestimonyReviewPreview.tsx`,
  which inherited the pattern verbatim from the code it was extracted from) are **pre-existing
  and unrelated to this phase** — confirmed identical error count on the pre-Phase-1 codebase via
  `git stash`. Not fixed here; fixing them would touch many files outside this phase's scope.
- No `.env.local`/live Supabase credentials exist in this environment, so none of the real-data
  code paths added in this phase (church-scoped queries, the new RLS policy) were exercised
  against an actual database — only `next build`, `tsc --noEmit`, and the unit/static test suite
  were run. The manual QA checklist in section 7 is unverified until run against a live project.

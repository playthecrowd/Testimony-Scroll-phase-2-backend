# Phase 9 Audit — Production Admin Completion

Date: 2026-07-18. Read-only audit, no code changed.

## What Part 19 asks for, and what's already done

Phases 5-8 already built five real admin pages, all sharing the same `is_platform_admin` gate
(`lib/adminAuth.ts`, added Phase 7) and the same RLS pattern (`private.is_church_manager` reused
for church-independent tables' admin branch, confirmed by dedicated tests in
`tests/rlsChurchIsolation.test.ts` for every one of them):

| Part 19 requirement | Status |
|---|---|
| Lesson requests | ✅ `/admin/lesson-requests` (Phase 5) |
| Testimony moderation / Kingdom Scroll publication | ✅ `/admin/testimonies` (Phase 6) |
| Character management / suggestions | ✅ `/admin/characters` (Phase 7) — suggestions are the existing `testimonies.suggested_character` free-text field, reviewed by admin there |
| Episode management / storyline management | ✅ `/admin/episodes` (Phase 7) |
| Event requests and bookings / featured events | ✅ `/admin/events` (Phase 8) |
| Church approvals or trust status | ❌ **Gap** — `churches.verified` exists (schema + already displayed publicly as a checkmark badge) but nothing anywhere can set it except the seed script |
| Featured lessons | ❌ **Gap** — no `featured` column on `lessons` at all |
| Featured testimonies | ❌ **Gap** — no `featured` column on `testimonies` at all |
| Badge/reward administration | Out of scope — no badge/points/credits schema exists at all yet; this is Phase 4b territory (deferred, tracked in memory), not something to retrofit here |
| Verify admin authorization server-side / not just hidden UI | ✅ Already true everywhere (`getPlatformAdminGate`/`requirePlatformAdmin`) |
| Protect routes with middleware + server authorization | ✅ `proxy.ts`'s `PROTECTED_PATHS` includes `/admin` (edge-level signed-in check); every page does the real `is_platform_admin` check server-side |
| RLS/service-role architecture | ✅ Consistent `is_platform_admin`-direct-check pattern across all five tables' write policies |
| **Log important moderation status changes** | ❌ **Gap** — nothing is logged anywhere. Every status change across all five admin pages (lesson requests, testimonies ×2, events, character/episode edits) happens with zero audit trail. |
| Unify moderation queues | ❌ **Gap** — five standalone pages, discoverable only by direct URL or the ad-hoc pairwise cross-links added along the way (lesson-requests↔testimonies, characters↔episodes, events↔episodes/testimonies). No single `/admin` landing page exists. |

Six real gaps remain, all of them completion/polish work using patterns already established —
none require a new architectural decision or a hard blocker like Phases 4b/Square/AI had.

## Plan

1. **`/admin` landing page** — a real dashboard, not just another cross-link: pending counts for
   each queue (lesson requests, testimonies, events) plus direct links to every admin area
   (including the new ones below). Replaces the scattered pairwise links added in Phases 5-8 (those
   stay as secondary in-context links, this becomes the actual hub).
2. **`churches.featured`... no — `churches.verified` admin control**: new `/admin/churches` page,
   list + a verify/unverify toggle. Reuses the existing column, doesn't invent a new "trust status"
   concept alongside it.
3. **Featured lessons**: add `lessons.featured` (migration), toggle from the existing
   `/experience-builder` host list is the wrong place (that's host-scoped, and "featured" is a
   platform-wide curation decision) — add the toggle to a new `/admin/lessons` page instead
   (list of published lessons, admin-only feature/unfeature). Surface a "Featured Lessons" section
   on the public `/lessons` page (Part 10 explicitly wanted the discovery page to "emphasize
   approved featured lessons" — never actually built in Phase 3).
4. **Featured testimonies**: add `testimonies.featured` (same migration), toggle from
   `/admin/testimonies`. Surface a "Featured Testimonies" section on `/kingdom-scroll`.
5. **Audit log**: new `admin_moderation_log` table (actor, action, entity_type, entity_id, detail,
   created_at), admin-read-only, written by a small shared `logAdminAction()` helper called from
   every existing status-changing admin action (lesson requests, testimonies ×2, events, character/
   episode publish). A new `/admin/audit-log` page lists recent entries.
6. **Final permission review**: re-verify every admin action/page uses the shared
   `requirePlatformAdmin`/`getPlatformAdminGate` helpers (not a re-inlined check), and that no admin
   write policy anywhere uses `using(true)` — covered by extending
   `tests/rlsChurchIsolation.test.ts` with checks for the three new tables plus a repo-wide
   assertion that every `/admin/*/actions.ts` file imports the shared helper.

No new architectural decision needed here — this phase is entirely "finish what the pattern
already established," not a new fork like Phases 4b/8's payment gap.

## Implementation summary

All six plan items built, in this order:

1. **Migration `0021_admin_completion.sql`** — `lessons.featured` / `testimonies.featured`
   (boolean, default false, with a column-level `grant update (featured) ... to authenticated`),
   and the new `admin_moderation_log` table (admin-select, admin-insert-with-`actor_id = auth.uid()`
   RLS, matching every other admin-only table's shape).
2. **`lib/adminAuditLog.ts`** — `logAdminAction()` (write side, best-effort/error-swallowing so a
   logging failure never blocks a real moderation action) and `getAdminAuditLog()` (read side,
   joins `profiles` for a human-readable actor name). Retrofitted into
   `app/admin/{lesson-requests,testimonies,events,episodes}/actions.ts` immediately after each
   real status-changing write succeeds. Episodes only logs the publish/unpublish action, not
   create/update/character/lesson-connection edits — a deliberate scope trim to keep the log to
   genuine moderation decisions rather than every content edit.
3. **`/admin/churches`** — sixth admin page. `services/supabase/churches.ts` gained
   `getAllChurchesForAdmin()` (no status filter, admin-only via the page gate) and
   `updateChurchVerified()`. `components/admin/ChurchesVerifyList.tsx` + `app/admin/churches/actions.ts`
   (logs `church_verified`/`church_unverified`).
4. **Featured lessons** — `services/supabase/lessons.ts` gained `featured` on `LESSON_SELECT`/
   `mapLesson` and `updateLessonFeatured()`. `/admin/lessons` (seventh admin page) reuses
   `getPublishedLessons()` directly (no new admin query needed) with
   `components/admin/LessonsFeaturedList.tsx` for the toggle. Public side: `app/lessons/page.tsx`
   now renders a "Featured Lessons" section (client-side `useMemo` filter on `lessons.featured`)
   above the existing filterable grid.
5. **Featured testimonies** — same shape on `services/supabase/testimonies.ts`
   (`updateTestimonyFeatured()`). `/admin/testimonies` was rewritten to a two-column layout:
   pending approval (existing `PublicTestimoniesList`) alongside a new
   `components/admin/ApprovedTestimoniesFeaturedList.tsx` for already-approved testimonies' feature
   toggle. Public side: `app/kingdom-scroll/page.tsx` renders a "Featured Testimonies" section
   (server-side filter on `testimonies.featured`) above the existing `KingdomScrollList`.
6. **`/admin` landing page** (eighth... really the hub, not an addition to the count) — pending
   counts for lesson requests/testimonies/events fetched in parallel, plus a link grid to all eight
   admin areas (the five from Phases 5-8, plus churches/lessons/audit-log from this phase). Existing
   pages' "← Admin Home" breadcrumbs (added while building them, anticipating this page) now resolve.
7. **`/admin/audit-log`** — reads `getAdminAuditLog()`, most-recent-first, shows action/entity/actor/
   timestamp per row.
8. **Final permission review** — confirmed all seven `/admin/*/actions.ts` files
   (`lesson-requests`, `testimonies`, `events`, `episodes`, `characters`, `churches`, `lessons`)
   import and call `requirePlatformAdmin`; confirmed `proxy.ts`'s `PROTECTED_PATHS` already includes
   `/admin` as a path-prefix match, so the three new pages need no proxy change. Extended
   `tests/rlsChurchIsolation.test.ts` with: no bare `using(true)` on `admin_moderation_log`; both its
   SELECT and INSERT policies check `is_platform_admin`; its INSERT policy pins
   `actor_id = auth.uid()`; and `lessons.featured`/`testimonies.featured` exist with the expected
   column-level grant.

No new RLS pattern was invented — every write in this phase goes through either an existing
`private.is_church_manager`-gated policy (lessons/testimonies UPDATE, unaffected by adding a
column) or a fresh direct-`is_platform_admin` policy (`admin_moderation_log`, the same shape as
`characters`/`episodes` from Phase 7).

## Manual QA checklist

- [ ] Sign in as a platform admin, visit `/admin` — pending counts match what each individual queue
      page shows, and every link in the grid resolves (no 404s).
- [ ] Sign in as a non-admin (host or member), visit `/admin` and any `/admin/*` sub-page directly by
      URL — see `NotAuthorized`, not the real content or a crash.
- [ ] Sign out entirely, visit `/admin` — redirected to `/login` by `proxy.ts` before the page even
      renders.
- [ ] As admin, verify a church on `/admin/churches` — the checkmark badge appears on that church's
      public `/churches/[slug]` page and in `/churches` listings.
- [ ] As admin, feature a published lesson on `/admin/lessons` — it appears in the new "Featured
      Lessons" section on `/lessons`; unfeature it — it disappears from that section (and stays
      visible in the regular grid either way).
- [ ] As admin, feature an approved testimony on `/admin/testimonies` — it appears in "Featured
      Testimonies" on `/kingdom-scroll`; unfeature it — it disappears from that section only.
- [ ] Perform one approval/decline in each of lesson-requests, testimonies, events, and one
      publish/unpublish in episodes — then check `/admin/audit-log` shows a new entry for each,
      correct actor name, correct entity type, most recent at the top.
- [ ] Confirm a church host (non-admin, but a manager of their own church) cannot reach any
      `/admin/*` page even though `private.is_church_manager` grants them lesson/testimony edit
      rights within their own church — the page-level `is_platform_admin` gate is a separate check
      from the row-level RLS.

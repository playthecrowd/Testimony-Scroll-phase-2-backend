# Phase 11.4 Audit — Real Progression UI, Dashboard, Badges & Leaderboards

Scope: replace the remaining mock/localStorage progression interfaces with real data from the
Phase 11.3 backend. No new database migration was needed or written this phase (a pure UI/service
layer phase). No Square integration, no change to approved Points/XP/Levels/Badge/Trophy/
Leaderboard rules (none was found broken).

## 1. Baseline

`Production` branch, clean working tree, commits `f13ec98` (Phase 11.3 implementation), `2ad7228`
(Phase 11.3 live verification), and `de71257` (Phase 11.2) all confirmed present. Migrations
`0001`–`0033` confirmed matching local and remote. `npm run lint`: 0 errors, 15 known warnings.
`npx tsc --noEmit`: clean. `npm test`: 224/224 passing. `npm run build`: successful.

## 2. Mock surface inventory

Audited every item on the brief's list. Findings:

| Surface | Status found | Action taken |
|---|---|---|
| Member dashboard (`/dashboard`) | Fully mock: `context/SessionContext` + `services/{journeyService,badgeService,questService,notificationService}.ts`, localStorage-backed via `lib/storage.ts` | **Replaced** with a real server component |
| Badges page (`/badges`) | Fully mock: `data/badges.ts` (6 retired journey-stage badge names), `services/badgeService.ts` | **Replaced** with a real server component |
| Leaderboard (`/leaderboard`) | Fully mock: `services/questService.ts`'s `Math.random()`-seeded quest scores, `data/users.ts`/`data/quests.ts` | **Replaced** with a real server component |
| Global/church leaderboard scoping | Mock scope filter (`data/users.ts`'s `churchId` field) | **Replaced** — real scope derived from `getMyChurches`/`auth.uid()` |
| XP/Level display | No real display existed anywhere (the mock dashboard never showed XP/Level at all, only badge/quest counts) | **Built new** — `XpProgressBar`, backend-driven thresholds |
| Points display | Did not exist as a concept anywhere pre-Phase-11 | **Built new**, clearly separate from Credits/XP (§5) |
| Trophy display | Did not exist (the old mock badge model had no trophy concept) | **Built new** via the badge `category` field |
| Recent activity / progression history | Did not exist | **Built new**, as a bounded "Recent Activity" dashboard section |
| Lesson completion reward feedback | Did not exist — `markStudiedComplete()`'s only feedback was `router.refresh()` | **Added**, reading the real award from `progression_award_log` |
| Experience completion reward feedback | No feedback message of any kind exists on the host-side completion-marking action | **Reviewed, left as-is** (see §10) — showing nothing is not misleading; adding feedback here would be a larger, separate host-UI change not requested |
| Sample users, rankings, fake progress bars | Confirmed only in the three mock pages above and the homepage's badge preview (below) | Removed alongside the pages that carried them |
| localStorage progression state | `lib/storage.ts`'s `qftk:` keys, read by the three mock pages | No longer read by any of the three replaced pages (the underlying mock service files still exist and are still used by the two out-of-scope pages below, so `lib/storage.ts` itself was not deleted) |
| Duplicated frontend level/rank formulas | None existed in a NEW file — the old mock leaderboard used server-computed mock scores, not a duplicated formula | N/A |
| Homepage badge teaser (`app/page.tsx`) | Anonymous-visitor marketing section using `getAllBadges()` (mock, showing retired badge names) | **Fixed** — replaced with a small static list of 3 real v1 badge names (not a live query — see §11 for why) |

**Found but deliberately left out of this phase's scope**, documented rather than silently
ignored:

- **`/profile`** also shows a mock "Badges Earned" count (`getUserBadges(session.user.id)`), but
  its *entire* identity display (name, email, avatar, church, "member since" date) comes from the
  same mock `SessionContext`/`data/churches.ts` layer — not just the badge count. Fixing only the
  badge count would require plumbing a real query through a page whose entire identity model is
  still mock, producing a confusing half-real page. The rest of `/profile`'s migration off
  `SessionContext` is pre-existing, already-flagged technical debt (the page's own comment: "Profile
  editing, avatar upload, and account settings connect to production auth in Phase Two") that
  predates and is unrelated to the Kingdom Economy phase. Not touched.
- **`app/journey/[lessonId]/experienced/page.tsx`** (the "3D Quest Experience" stage) is a
  self-documented, already-deferred mock route (its own comment cites
  `docs/PHASE9_5_STABILIZATION.md`) — a different, larger, already-acknowledged initiative (an
  actual 3D quest mini-game), not part of Kingdom Economy/Progression. Not touched.
- These two pages are the reason `services/badgeService.ts`, `services/questService.ts`,
  `services/journeyService.ts`, and `data/badges.ts`/`data/quests.ts`/`data/users.ts` were not
  deleted outright this phase — they remain used by those two out-of-scope pages.

**Interpreted scope note**: this phase's own roadmap entry (`docs/PHASE11_IMPLEMENTATION_PLAN.md`)
originally grouped wallet/credit-request UI into the same "Phase 11.4" stage alongside progression
UI. This specific, detailed brief narrowed the actual work to progression UI only (dashboard,
badges, leaderboard, XP/Points presentation, history, completion feedback) — `/wallet` and
`/credit-requests` were not mentioned anywhere in its 21 steps. No wallet/credit-request UI was
built this phase; it remains for a future stage (§19).

## 3. Dashboard replacement

`app/dashboard/page.tsx` — a real server component (`createClient()`, `supabase.auth.getUser()`,
redirect to `/login` if signed out). Displays: current level + XP progress (via `XpProgressBar`),
lifetime Points (explicitly labeled, never "balance"), Global rank, Church rank (or "No Church Yet"
if the member has none), recent badge awards (up to 4, most recent first), a "next milestone"
hint (the next not-yet-earned, non-hidden badge by display order), and recent progression activity
(up to 8 entries, human-readable event labels only). `ErrorState` for a Supabase config error or
unexpected load failure; `EmptyState` for zero badges/zero activity. No `localStorage` read
anywhere in this file.

## 4. XP and level presentation

`components/progression/XpProgressBar.tsx` — accepts `thresholds` as a required prop (always
sourced from `getAllLevelThresholds`, the real `progression_level_thresholds` table); no literal
threshold array exists anywhere in this component or in `app/dashboard/page.tsx` (confirmed by a
structural test). Uses `lib/progressionLevels.ts`'s `calculateLevelFromXp` (Phase 11.3, unchanged)
for the level lookup — the same pure function the audit already unit-tested. Handles: zero XP
(Level 1, 0%), an exact threshold boundary (`calculateLevelFromXp`'s existing `<=` semantics already
covered this), the maximum configured level (renders a distinct "Level N (Max)" state instead of a
100%-but-still-climbing bar), missing/incomplete level configuration (an empty `thresholds` array
renders the raw XP total with a plain message instead of a nonsensical progress bar), and
unusually large XP totals (`toLocaleString()` formatting, no overflow risk since the bar's width is
always clamped to `[0, 100]`).

## 5. Points terminology

Audited every new label. **Points** is always labeled "Lifetime Points" or "Points" with an
explicit "your leaderboard score -- never spent" caption on the dashboard, never "balance."
**Credits**/wallet balance are not displayed anywhere in this phase's new UI (no wallet page exists
yet, §2's scope note) — so there was no existing "Credits" label to conflict with in practice, but
the new UI was written to never use "balance," "credits," or "points" interchangeably: `XpProgressBar`
labels its number "XP," the dashboard's Points stat pill labels its number "Lifetime Points," and
the leaderboard's ranking column header is literally "Points." No file in this phase's new code
uses the word "balance" to refer to Points or XP.

## 6. Badges and trophies

`app/badges/page.tsx` (real server component) + `components/progression/BadgesGrid.tsx` (client,
category-filter only, no data fetching of its own) + `lib/badgePresentation.ts` (pure, tested
selection/ordering logic). Earned state is derived entirely from `member_badge_awards` (via
`getMyBadgeAwards`); a badge with `is_hidden_until_earned = true` is excluded from the list
entirely until actually earned (never shown as a locked mystery badge); `is_active = false` badges
are excluded by `getAllBadgeDefinitions` itself (Phase 11.3), so disabled badges never reach this
page. Trophy-category badges get a distinct icon (`Trophy` vs `Award`), a "Trophy" tag, and a gold
glow when earned (vs. blue for achievements). Category filter tabs (All/Achievements/Trophies) are
client-side only, over already-fetched data. Ordering is always `display_order` ascending
(`selectVisibleBadges`, unit-tested). Empty/loading/error states present; no fake badge award is
ever rendered, and no direct client insertion exists anywhere in this page or component.

## 7. Global leaderboard

`app/leaderboard/page.tsx` + `components/progression/LeaderboardTabs.tsx`. Reads
`leaderboard_global` (top 25) plus the signed-in member's own rank via `getMyGlobalRank` (works
even when the member's row isn't in the visible top 25 — a distinct "Your rank: #N" banner appears
above the table in that case). Displays: rank, display name (`full_name`, falling back to "A
Kingdom Member" if null — never email), Level, and Points. Ties are however the view's own
`row_number() ... order by points_total desc, created_at asc` already resolves them — never a
second, independently-computed tiebreak. `leaderboard_opt_out` is respected entirely inside the
view itself (Phase 11.3); this page never re-implements or bypasses that filter. No email, wallet
balance, or Credits appear anywhere in this component (confirmed by a structural test).

## 8. Church leaderboard

Same page, a second tab. Scope is derived **entirely** from the signed-in member's own
`church_memberships` (via `getMyChurches` to detect membership, and `leaderboard_my_church`'s own
`auth.uid()`-scoped `WHERE` clause for the actual ranked rows) — no client-supplied church id is
ever accepted or forwarded anywhere in this page or component (confirmed by a structural test
asserting the string `churchId` never appears in either file). A member with no church sees the
"My Church" tab disabled with an explanatory title attribute and, if somehow selected, an
`EmptyState` explaining why. A church with zero ranked members shows the standard empty state. The
member's own church rank is shown the same "outside the visible page" way as the global scope.

## 9. Progression history

Implemented as the dashboard's "Recent Activity" section (§3) rather than a new standalone route —
`getMyRecentProgressionAwards(supabase, 8)` reads `progression_award_log`, already bounded (no
pagination needed at this volume), and renders only `PROGRESSION_EVENT_LABELS`-mapped human-
readable text (e.g. "Completed a lesson") plus the Points/XP delta — never a raw `event_type`
string, `source_row_id`, or any other internal identifier. A dedicated new route was deliberately
not added, per the brief's own "where appropriate" phrasing and the instruction (Step 12) to avoid
fragmenting routes unnecessarily; this keeps the information architecture coherent with how
`/my-journey` already serves as the one existing "your activity" surface.

## 10. Completion feedback

**Lesson Studied** (`app/journey/[lessonId]/studied/StudiedClient.tsx`, the real, already-working
completion flow): after `markStudiedComplete()` succeeds, the component calls
`getMyProgressionAwardForSourceRow(supabase, journey.id)` — an authoritative read of exactly what
`progression_award_log` recorded for *this specific* completion (never a client-side guess or
calculation) — and, if an award exists, `getMyBadgeAwards` to check whether the "First Lesson
Completed" badge was also just earned. A small banner then shows the real Points/XP earned and, if
applicable, the badge. If the award lookup itself fails (a secondary read, not the completion
itself), the error is logged, not surfaced — the stage completion has already genuinely succeeded
regardless. A structural test confirms `markStudiedComplete` always resolves *before* the award
lookup runs (no feedback is ever shown ahead of a confirmed success), and that no local
points/XP constant is ever declared (every number comes from the awaited service call).

**Experience completion** (host-marked `completion_status` update,
`app/host-dashboard/experiences/actions.ts`): reviewed, not modified. This action currently shows
no reward-related message of any kind to the host performing the completion-marking — silence is
safe here (it never implies a reward was granted), satisfying "failures must not imply rewards
were granted" trivially. Adding member-facing reward feedback for Experience completion would
require a materially different, larger change (the member isn't the one calling this action; they'd
need their own, separate notification path) — out of scope for this UI-replacement phase, named
here as a candidate for Phase 11.5 (§19).

**Duplicate completion / non-qualifying states**: `markStudiedComplete` cannot be called twice
for the same journey (the button becomes "Studied stage complete" and disables once
`isStudiedComplete` is true); `getMyProgressionAwardForSourceRow` would return the same, single,
already-recorded award on a hypothetical repeat call rather than a duplicate (Phase 11.3's own
`progression_award_log` unique constraint guarantees this at the database level, unchanged this
phase). Waitlisted/cancelled Experience registrations were not touched by this phase and never
displayed a reward message to begin with.

## 11. Service-layer changes

`services/supabase/progression.ts` — added `getMyGlobalRank`, `getMyChurchRank`,
`getAllLevelThresholds`, `getMyRecentProgressionAwards`, `getMyProgressionAwardForSourceRow`. All
read-only, all RLS-gated by the caller's own `auth.uid()`, none can write a point/XP/level/badge.
New pure helpers: `lib/progressionLevels.ts` (Phase 11.3, unchanged), `lib/badgePresentation.ts`
(new — `selectVisibleBadges`, `isBadgeEarned`), `lib/progressionLabels.ts` (new — the fixed
event-type-to-label map). New components: `components/progression/XpProgressBar.tsx`,
`BadgesGrid.tsx`, `LeaderboardTabs.tsx`. No direct Supabase progression query was added to any
*new* page/client component (the three real pages are server components); the one exception is
`StudiedClient.tsx`'s two additional calls, which extend that file's own pre-existing, already-
established pattern of calling the browser Supabase client directly (it already did so for every
other journey mutation before this phase touched it) — not a new violation, a consistent
continuation of that file's own convention.

## 12. Security review

- **Forged profile id**: every new page/service function derives the acting member from
  `supabase.auth.getUser()` server-side; none accepts a profile id from a route param, query
  string, or form field. `getMyProgressionSummary`/`getMyBadgeAwards`/`getMyRecentProgressionAwards`/
  `getMyGlobalRank`/`getMyChurchRank` all filter by `auth.uid()` internally, so even a hypothetical
  attempt to pass a different id would have no route to do so from the UI layer, and the underlying
  RLS (Phase 11.3) would block a mismatched query regardless.
- **Forged church id**: confirmed the leaderboard page and its component never accept, store, or
  forward a `churchId` string anywhere (structural test) — church scope comes only from
  `getMyChurches` (itself `auth.uid()`-scoped) and `leaderboard_my_church`'s own view-level
  `auth.uid()` filter.
- **Email/private field exposure**: confirmed via structural test that `LeaderboardTabs.tsx` never
  references `email`, `credit`, or `balance` — only `fullName`, `pointsTotal`, `currentLevel`,
  `rank` are ever destructured from a leaderboard entry and rendered.
- **Client-side award override**: no new code path can insert into `member_progression_summaries`,
  `progression_award_log`, or `member_badge_awards` — these remain SELECT-only from the client
  (Phase 11.3's RLS, unchanged), and every read function in `progression.ts` is a plain
  `.select()`, never an `.insert()`/`.update()`.
- **Disabled badges**: `getAllBadgeDefinitions` already filters `is_active = true` (Phase 11.3);
  this phase's UI adds no separate path that could surface a disabled badge.
- **Leaderboard opt-out bypass**: the opt-out filter lives entirely inside the
  `leaderboard_global`/`leaderboard_my_church` views themselves (Phase 11.3); this phase's UI reads
  those views as-is and has no code path that could circumvent the filter (e.g., no direct query
  against `member_progression_summaries` for leaderboard purposes exists anywhere in the new code).
- **Credits/Points confusion**: no new code conflates the two; see §5.

## 13. Accessibility review

- `XpProgressBar`: uses `role="progressbar"` with `aria-valuenow`/`aria-valuemin`/`aria-valuemax`
  and a descriptive `aria-label` (including the max-level state's own distinct label).
- `LeaderboardTabs`/`BadgesGrid` category filters: real `<button>` elements with `role="tab"`/
  `aria-selected`, keyboard-operable by default (no custom key handling needed since they're plain
  buttons, not a custom widget).
- Leaderboard table: real `<table>` with `<caption className="sr-only">`, `scope="col"` on every
  header cell — proper table semantics for assistive technology, not a div-based fake table.
  The current-member row is marked both by a background tint *and* a visible "(You)" text suffix —
  never color alone.
  Icons (`Crown`, `Trophy`, `Award`, `Lock`) that are purely decorative are marked
  `aria-hidden="true"`; the surrounding text already conveys the same meaning (e.g. "Earned"/"Not
  yet earned" text, not just an icon swap).
- Empty/error states reuse the existing, already-accessible `EmptyState`/`ErrorState` components
  (plain readable text, no icon-only communication).
- Mobile reading order: all three pages use a single-column-first responsive layout (`grid
  sm:grid-cols-2 xl:grid-cols-4`, etc.), matching every other real page in this app; no
  reading-order-breaking absolute positioning was introduced.

## 14. Responsive QA

Reviewed each new page's layout classes for narrow-mobile-through-wide-desktop behavior, matching
this app's existing responsive conventions exactly (the same `grid`/`sm:`/`lg:`/`xl:` breakpoint
vocabulary used throughout the real Phase 10/11 pages):

- Long member names: the leaderboard table's member cell has no fixed width and wraps naturally
  within its table cell; the table itself sits inside `overflow-x-auto` so a very long name on a
  narrow screen scrolls the table horizontally rather than breaking the page layout.
- Large Point/XP totals: every numeric display uses `toLocaleString()` and sits in a flexible
  container, not a fixed-width box that could clip.
- Long badge descriptions: `BadgesGrid` badge cards have no fixed height and no text truncation —
  a long description simply makes that card taller, matching the existing `qk-card` grid pattern
  used elsewhere (e.g. Phase 10's Experience cards) rather than introducing a new overflow risk.
- Current member outside top rankings: the "Your rank: #N" banner (§7) is full-width and stacks
  above the table on narrow screens via normal block flow, no horizontal overflow.
- Maximum level / no church / no badges / no progression history: each has its own explicit empty/
  max-state branch (§4, §6, §8, §9) rather than an unstyled fallback.
- No horizontal overflow was introduced anywhere: the only genuinely wide element (the leaderboard
  table) is wrapped in its own `overflow-x-auto` container, never the page body.

Full interactive verification (actually resizing a browser) was not performed — this sandbox has no
running dev server with a real signed-in session (the standing `.env.local` limitation documented
since Phase 1). This review is a code/class-level audit against this app's own established
responsive patterns, not a click-through.

## 15. Automated tests

- `tests/badgePresentation.test.ts` (new) — 7 pure-function tests for `selectVisibleBadges`/
  `isBadgeEarned`: hidden-until-earned exclusion/inclusion, revoked-award handling, deterministic
  ordering, trophy-category inclusion.
- `tests/progressionUI.test.ts` (new) — 12 structural tests: mock-import absence on the three real
  pages, server-component shape (no `"use client"`, no browser Supabase client import), homepage
  badge-preview fix, no hard-coded threshold literals, `auth.getUser()`-derived identity (never a
  route param), no client-supplied `churchId` on the leaderboard, no email/credit/balance fields in
  the leaderboard component, Points (not XP) as the rendered ranking number, non-predictive
  completion-feedback ordering (`markStudiedComplete` before the award lookup, never a locally-
  declared points/XP constant), and badge earned/locked/trophy visual distinction with no raw id
  ever rendered.
- All Phase 1–11.3 tests (224) re-verified unaffected. **243/243 total passing.**
- **Not covered by an automated test** (documented honestly, not silently skipped): full React
  rendering/interaction (this repo has no Jest/Vitest/React Testing Library, per its own standing
  testing convention — `node:test` against pure functions and structural source checks only, the
  same limitation every prior phase has worked within). The "Dashboard/Badges/Leaderboard" test
  categories requested in the brief (zero-state, populated-state, max-level rendering, tie
  presentation, etc.) are covered at the level this repo's test infrastructure actually supports:
  the pure logic each of those states depends on (`selectVisibleBadges`, `calculateLevelFromXp`,
  the view's own SQL ordering, structural guarantees about what each component receives and
  renders) — not by mounting the component itself.

## 16. Live database read verification

Performed against the linked Supabase project (`ytnftubajizhuylhmsib`) using safe, read-only
queries mirroring the service layer's exact query shapes:

- `getAllBadgeDefinitions`'s exact `select` shape, run live: returned 3 (of 5) real, non-fabricated
  seeded badges with the exact designed column set.
- `progression_award_rules` (active): 5 real rows confirmed.
- `getGlobalLeaderboard`'s exact `select` shape (`leaderboard_global`, ordered by rank): ran
  successfully, returned **zero rows** — honestly documented as reflecting reality: no real member
  has triggered a progression event since these migrations went live, not a query failure and not
  fabricated data.
- `member_progression_summaries`, `member_badge_awards`, `progression_award_log`: all confirmed at
  0 rows currently, for the same reason.
- **This verification used real, currently-existing records for the catalog tables and confirmed,
  genuine empty states for the member-specific tables/views** — no live data was fabricated to make
  a state appear populated.
- This was a direct-connection SQL verification, not an end-to-end authenticated-browser-session
  test (no `.env.local`/dev server in this sandbox, the same limitation documented since Phase 1) —
  it confirms the query shapes and live schema are correct and compatible, not the full RLS-enforced
  request path a real signed-in user's browser would take.

## 17. Migration status

No new migration was written or needed this phase (pure UI/service-layer work). `npx supabase
migration list` and `npx supabase db push --dry-run` (run as part of Step 20's final verification)
both confirm local and remote match exactly across `0001`–`0033`, with **no pending migration**.

## 18. Known limitations

- `/profile`'s mock badge count and `/journey/[lessonId]/experienced`'s entire mock route remain
  unmigrated — pre-existing, already-flagged, explicitly out-of-scope technical debt (§2).
- No wallet/Credits UI exists yet (`/wallet`, `/credit-requests`) — not requested by this specific
  brief; remains for a future stage.
- No admin UI exists for manually awarding/revoking a badge or adjusting points/XP (Phase 11.3's
  own known limitation, unchanged).
- Full interactive/responsive verification was a code-level review, not a live browser click-through
  (§14) — same sandbox limitation as every real page in this app since Phase 1.
- Experience completion has no member-facing reward feedback yet (§10) — reviewed and confirmed
  safe (shows nothing, never misleading), not built out this phase.
- `services/badgeService.ts`, `services/questService.ts`, `services/journeyService.ts`,
  `data/badges.ts`, `data/quests.ts`, `data/users.ts`, and `lib/storage.ts` were not deleted — still
  used by the two explicitly out-of-scope pages (§2).

## 19. Phase 11.5 handoff

Recommended candidates for the next stage, based on what this phase's own scoping surfaced:

- Migrate `/profile` off the mock `SessionContext`/localStorage identity model entirely (a
  standalone project, not Kingdom-Economy-specific, but blocking a fully accurate progression
  count on that page).
- Retire or rebuild `app/journey/[lessonId]/experienced/page.tsx` (the "3D Quest Experience" mock
  route) — a separate, already-acknowledged initiative per its own code comment.
- Build `/wallet` and `/credit-requests` member UI, and `/host-dashboard/credits` host UI (Phase
  11.1/11.2's service/RPC layer is complete and unused by any page today).
- Admin UI for manual badge award/revocation and point/XP/rule adjustment (Phase 11.3's own named
  gap).
- Member-facing reward feedback for Experience completion, if this becomes a real product priority.
- The stored-balance-vs-ledger reconciliation job (named since Phase 11.1, still not built).
- A live, authenticated-browser QA pass once `.env.local`/a real session is available in some
  environment, to validate the responsive/accessibility review in §13/§14 against an actual
  rendered page rather than a code-level audit.

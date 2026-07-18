# Phase 11 Implementation Plan — Kingdom Economy & Progression System

Companion to `docs/PHASE11_ECONOMY_PROGRESSION_SPEC.md`. This plan sequences implementation into a
controlled number of milestones, each committed and reported separately on `Production`, matching
this project's standing one-phase-one-commit, audit-then-implement discipline (Phases 1–10.4).

**All seven Phase 11 owner decisions (spec §34) are now approved — see spec §35 entries 11–17 for
the resolved decision log.** Phase 11.1 (wallet/ledger/RLS/RPC foundation) and Phase 11.2 (wallet
workflows, credit requests, Experience credit charging/refunds) are both implemented — see
`docs/PHASE11_1_AUDIT.md` and `docs/PHASE11_2_AUDIT.md`. Migrations `0027`–`0031` are written and
dry-run-verified but **not yet pushed to the linked Supabase project** (this repo has exactly one
linked project, with no separate development database — pushing is being treated as its own,
separately-confirmed action rather than assumed). Phase 11.3 has not begun.

## Phase 11.1 — Database, ledger, RLS, and RPC foundation

- Migrations starting at `0027`: `member_wallets`, `church_wallets`, `credit_ledger_entries`
  (append-only, no UPDATE/DELETE policy), core RLS per spec §23.
- Foundational RPCs: `grant_credits`, `reverse_ledger_entry` — the minimum pair needed to prove the
  ledger/balance/locking design end-to-end before building requests or Experience spend on top of
  it.
- Structural tests extending `tests/rlsChurchIsolation.test.ts` (new table policies) and a new
  `tests/creditLedger*.test.ts` (RPC shape assertions), matching Phase 10's testing precedent.
- Owner decisions §34.1 (Points/XP kept independent) and §34.4 (ledger owner-reference shape: two
  explicit nullable FK columns, `member_wallet_id`/`church_wallet_id`, with a CHECK enforcing
  exactly one populated) are both approved and drive this migration's exact DDL from the start.
- Acceptance: 0 lint errors, clean typecheck, all tests passing, successful build, live-DB
  verification of RLS/RPC shape (mirroring `docs/PHASE10_4_AUDIT.md` §2's verification method).

## Phase 11.2 — Wallets, grants, requests, and Experience credit access

- `credit_requests` table + `request_credits`/`review_credit_request` RPCs (spec §8).
- `church_experiences`/`church_experience_occurrences` gain nullable `credit_cost` columns; extend
  `register_for_experience_occurrence` and `promote_waitlist_registration` with the balance-check-
  and-deduct step (spec §9); cancellation-path refund logic (member and church cancellation).
- Owner decisions §34.3 (refund cutoff: full refund before `registration_closes_at`, falling back
  to `starts_at` when null, no refund at/after; church cancellation always fully refunds
  regardless) and §34.6 (church grant/approval capacity strictly bounded by the church wallet's
  real balance, zero exceptions) are both approved and implemented exactly as specified, with every
  cutoff/balance check performed server-side inside the relevant RPC.
- Dependency: 11.1 must be complete (needs the ledger/wallet tables and locking pattern).
- Tests: structural RPC tests, plus regression tests confirming the Experience RPCs still pass
  every existing Phase 10 assertion (no regression to registration/waitlist/walk-in behavior).

## Phase 11.3 — Points, XP, levels, badges, trophies, and leaderboards

- `progression_award_rules`, `progression_level_thresholds`, `member_progression_summaries`,
  `badge_definitions`, `member_badge_awards`.
- `award_progression_event` RPC (spec §24) wired to the real trigger points already identified in
  spec §2a: `markStudiedComplete`, `sync_journey_on_experience_completion` (or its Experience-
  completion equivalent), testimony `church_status`/`platform_status` transitions, Kingdom Scroll
  publication.
- Owner decision §34.2 is approved: the Lesson-completed award reads its base amount from that
  lesson's own `xp_reward` column, clamped to a platform-configured ceiling
  (`max_lesson_xp_award`) inside `award_progression_event` before crediting the member. Before
  setting the exact ceiling value, spot-check real production `lessons.xp_reward` values (spec
  §33) so the ceiling sits above legitimate existing values but still bounds them.
- Leaderboard read model (views or summary-table queries) for Global/My Church/Lesson/Experience/
  All-time scopes (spec §17); Seasonal explicitly deferred.
- Dependency: 11.1 complete; independent of 11.2 (progression doesn't require the credit-spend path
  to exist) — these two could run in parallel if the team prefers, but are sequenced serially here
  to keep review load manageable, per the brief's instruction not to create one uncontrolled phase.
- Tests: unique-constraint duplicate-award tests, level-threshold calculation unit tests, structural
  RLS tests for the four new tables.

## Phase 11.4 — Host/admin/member UI and complete workflows

- Member routes: `/wallet`, `/rewards`, `/credit-requests`, and the real `/badges` and
  `/leaderboard` replacements (spec §29, §16, §17) — this is the point at which `/dashboard`'s and
  the old `/leaderboard`'s mock data sources (`services/{badgeService,questService,journeyService,
  notificationService}.ts`, `data/{badges,quests,users}.ts`) are finally superseded for real,
  signed-in users.
- Host routes: `/host-dashboard/credits`, `/host-dashboard/credit-requests`,
  `/host-dashboard/member-progress`.
- Admin routes: `/admin/economy` (credit packages/grants/adjustments/reversals/audit as tabs),
  `/admin/rewards` (badge/trophy/reward-rule definitions, with badges as a tab per spec §29).
- Owner decision §34.5 is approved: `/dashboard` is retired outright in this phase (not kept as a
  slimmed-down summary page), since this is the first phase where the real replacement screens
  actually exist. `/badges` and `/leaderboard` are replaced in place at their existing routes, not
  duplicated at new paths alongside the old mock pages.
- Dependency: 11.1–11.3 complete (UI needs real data to render against).
- Every screen follows the error/loading/empty-state and authorization-guard pattern audited in
  `docs/PHASE10_4_AUDIT.md` §7–9, applied to the new routes.

## Phase 11.5 — Stabilization, security, QA, and production readiness

- Full regression pass mirroring Phase 10.4's structure exactly: baseline verification, migration/
  live-DB verification, expanded automated tests, manual QA checklist (honest tested/reviewed/
  blocked classification), security review against the abuse vectors in spec §26, performance
  review (leaderboard pagination/indexes specifically, since that's the one area of Phase 11 with a
  real scale concern per spec §17), accessibility/mobile review, error/empty/loading-state audit,
  code-quality review, bug fixes with regression tests, `docs/PHASE11_AUDIT.md` +
  `docs/PHASE11_FINAL_RELEASE_CHECKLIST.md`.
- Builds the reconciliation job named as required follow-up in spec §33 (stored-balance-vs-ledger-
  sum drift check) if not already built during 11.1.
- Dependency: 11.1–11.4 complete.

## Future Phase — Square commerce integration

- Not scheduled as part of Phase 11.1–11.5. Requires its own approval, its own credentials (never
  configured during Phase 11A/11.1–11.5), and its own audit-then-implement pass, per spec §27 and
  per standing project memory that credentialed-integration phases (Square, in particular) are
  always their own separately-approved phase.

## Cross-phase notes

- **Branch**: all of 11.1–11.5 happen on `Production`; nothing merges to `main` at any stage,
  matching every prior phase.
- **Migration numbering**: starts at `0027` in 11.1; each subsequent stage's schema change gets its
  own next-numbered migration, never reusing or editing a prior stage's migration once applied
  remotely (the same immutability rule carried forward from Phase 10.4).
- **Commit granularity**: one commit per stage, awaiting explicit go-ahead before the next, matching
  this project's established convention.
- **No stage configures Square or OpenAI credentials** — both remain extension-points-only per spec
  §27/§28 through all of 11.1–11.5.

# Phase 11.5 Audit — Kingdom Economy Stabilization, QA & Production Readiness

Final stabilization pass over everything implemented in Phases 11.1–11.4. This is an
audit-then-correct phase, not a new-feature phase: every fix below was made because a real,
verified defect or a genuinely ambiguous behavior was found — nothing was broadly redesigned.

## 1. Baseline

`Production` branch, clean working tree. Commits `d69c928` (11.1), `de71257` (11.2), `f13ec98` and
`2ad7228` (11.3), `0a0960a` (11.4) all confirmed present in `git log`. Migrations `0001`–`0033`
confirmed matching local and remote, no pending migration, before any Phase 11.5 edit. `npm run
lint`: 0 errors, 14 known warnings. `npx tsc --noEmit`: clean. `npm test`: 243/243 passing. `npm
run build`: successful.

## 2. Complete economy inventory

### Credits

| Surface | Status |
|---|---|
| Member wallets | Complete — lazy creation, RLS-gated read, `SECURITY DEFINER`-only writes |
| Church wallets | Complete — same shape, church-manager-gated |
| Ledger | Complete — append-only, signed `amount`, exactly-one-wallet constraint, idempotency-key unique index |
| Credit requests | Complete — full state machine, delegates approval to `transfer_credits` |
| Grants | Complete — `grant_credits`, platform-admin-only, mints from platform authority |
| Transfers | Complete — `transfer_credits`, strict church-balance bound, zero exceptions |
| Registration charges | Complete — single trigger (`charge_credits_on_registration_confirmation`) covers registration, waitlist promotion, and host-approval confirmation uniformly |
| Waitlist charging | Complete — never charged until promotion (trigger only fires on transition into `'confirmed'`) |
| Member cancellation refunds | Complete — cutoff rule (`registration_closes_at`, falling back to `starts_at`) implemented exactly as approved |
| Church cancellation refunds | Complete — dedicated trigger, unconditional, no exceptions |
| Reversals | Complete — `reverse_credit_transaction`, platform-admin-only, double-action-proof |
| Wallet history | Complete — `get_wallet_history`, bounded (`limit` capped at 200) |
| Current balance reads | Complete — `get_wallet_balance`, plus direct RLS-gated reads via the service layer |

### Progression

| Surface | Status |
|---|---|
| Points | Complete — independent column, never spent, ranks the leaderboard |
| XP | Complete — independent column, feeds Level only |
| Levels | Complete — always re-derived from `progression_level_thresholds`, never stored as sole truth |
| Progression events | Complete — 5 fixed event types, no open rule engine |
| Lesson awards | Complete — `award_progression_on_lesson_studied`, XP clamped to `xp_reward_ceiling` |
| Experience awards | Complete — `award_progression_on_experience_completion` |
| Testimony awards | Complete — `award_progression_on_testimony_submitted` |
| Church approval awards | Complete — `award_progression_on_testimony_church_approval` |
| Kingdom Scroll publishing awards | Complete — `award_progression_on_testimony_kingdom_scroll_publication` (trigger name corrected this phase, see §9) |
| Badges | Complete — 5 seeded v1 badges, real earned/locked distinction |
| Trophy-category badges | Complete — one seeded (`kingdom-scroll-contributor`), modeled as a badge category, no separate backend |
| Global leaderboard | Complete — real view, Points-ranked |
| Church leaderboard | Complete — real view, `auth.uid()`-scoped |
| Progression history | Complete, as a dashboard section (not a standalone route — a deliberate scope decision from Phase 11.4) |
| Completion feedback | Complete for Lesson Studied only; Experience completion has no member-facing feedback yet (documented gap, not a defect — see §11/§19) |

### User interfaces

| Surface | Status |
|---|---|
| Dashboard | Complete — real server component |
| Badges | Complete — real server component |
| Leaderboard | Complete — real server component, Global/Church tabs |
| Lesson completion feedback | Complete |
| Homepage progression teaser | Complete — fixed in Phase 11.4 to show real badge names (static list, not a live query — see §9's anon-RLS note) |
| Navigation | Complete — no changes needed; `/badges` remains link-only (no standalone nav entry), matching pre-existing precedent |
| Empty/loading/error states | Complete on all three real pages |

**Fully complete**: everything above except the two named gaps.
**Partially complete / deferred by design, not oversight**: Experience completion member-facing
feedback (§11); admin badge/points manual-adjustment tooling (named since Phase 11.3); `/wallet`
and `/credit-requests` member/host UI (never in this brief's scope, per Phase 11.4's own scope
note).
**Remaining mocks**: `/profile`'s Journeys/Testimonies stats and its entire identity model; the
"3D Quest Experience" journey stage — both pre-existing, already-flagged, explicitly out of Kingdom
Economy scope (§11).
**Dead code**: none found beyond what's already documented as intentionally retained for the two
deferred mock pages (`services/badgeService.ts`/`questService.ts`/`journeyService.ts`, `data/
badges.ts`/`quests.ts`/`users.ts`) — still referenced by those two pages, so not deletable yet.
**Duplicated logic found**: `reverse_credit_transaction` (0028) contains its own inline copy of the
refund-mechanics logic that `private.apply_refund` (0030) already centralizes for `refund_credits`
and the two Experience-cancellation paths — the two bodies are nearly identical except for the
hardcoded `transaction_type` string (`'reversal'` vs. `'refund'`). This is a genuine DRY violation,
**not a functional defect** (both paths are independently correct and tested) — per this phase's
own instruction not to broadly redesign an approved system absent a real defect, this was left
unconsolidated and is named here as a Phase 11.6+ candidate (§19), not fixed via a migration this
phase.
**Unreferenced services**: none found that aren't already accounted for above.
**Inconsistent terminology**: none found in the real (non-mock) UI — Points/XP/Credits labels were
already audited and corrected in Phase 11.4.
**Undocumented assumptions found**: `credit_ledger_entries.amount` being a single signed integer
(rather than the Phase 11A spec's original amount+direction two-column design) was a documented
simplification from Phase 11.1 — re-confirmed here as intentional and unchanged, not an
undocumented gap.

## 3. Financial integrity audit

Reviewed every financial RPC individually (not sampled): `create_member_wallet`,
`create_church_wallet`, `grant_credits`, `transfer_credits`, `refund_credits`,
`reverse_credit_transaction`, `get_wallet_balance`, `get_wallet_history`, `submit_credit_request`,
`cancel_credit_request`, `approve_credit_request`, `decline_credit_request`, `private.apply_refund`,
`charge_credits_on_registration_confirmation`, `refund_registrations_on_occurrence_cancellation`,
`cancel_experience_registration` (redefined).

- **Every credit movement creates a matching ledger entry**: confirmed by direct source read of
  every mutating function — no path updates `current_balance` without an accompanying
  `credit_ledger_entries` insert in the same statement block.
- **No direct application write to `current_balance`**: confirmed — grep across all six
  migrations touching these tables finds `current_balance` written only inside `update ... set
  current_balance = current_balance ± ...` statements inside the RPCs/trigger themselves, never
  from application TypeScript code (the service layer only ever calls `.rpc(...)` or plain
  `.select()`).
- **No client-facing policy permits direct financial mutation**: confirmed live — `member_wallets`,
  `church_wallets`, `credit_ledger_entries`, `credit_requests` all show SELECT-only policies (§9).
- **Every RPC that changes a balance uses row locking**: confirmed — `grant_credits`,
  `transfer_credits`, `refund_credits` (via `apply_refund`), `reverse_credit_transaction`, and the
  charge/refund triggers all `select ... for update` the wallet (and, where relevant, the original
  ledger entry or request) row before reading or writing it.
- **All credit movements are atomic**: each RPC's balance update and ledger insert happen inside
  the same implicit transaction (a single function invocation is one transaction unless it uses
  its own sub-transactions, which none of these do) — a failure partway through rolls back the
  whole thing.
- **Idempotency keys enforced at the database level**: confirmed —
  `credit_ledger_entries_idempotency_key_key` is a real partial unique index (`where idempotency_key
  is not null`), not just an application-level check-then-insert.
- **Duplicate requests cannot double-spend**: `approve_credit_request` locks the request row
  first, checks status is still `submitted`/`under_review`, and only then calls `transfer_credits`
  — a concurrent second approval blocks on the row lock and, once unblocked, sees the
  already-`fulfilled` status and raises.
- **Duplicate registration confirmation cannot double-charge**: `charge_credits_on_registration_
  confirmation`'s own idempotency key (`'experience_spend:' || registration.id`) plus its `WHEN`
  guard (fires only on the transition into `'confirmed'`) both independently prevent this.
- **Duplicate refund attempts cannot double-refund**: both `refund_credits`/`apply_refund` and
  `reverse_credit_transaction` check `reversed_by_entry_id is not null` before acting, returning
  the existing reversal row instead of creating a second one.
- **Reversals cannot be reversed repeatedly**: the same `reversed_by_entry_id` check applies
  uniformly to any entry, including a reversal entry itself — a given entry can only ever be
  reversed once, though a *chain* of reversals (reversing an earlier reversal) is allowed by
  design, which is correct (an admin may legitimately need to undo an erroneous reversal).
- **Insufficient balances cannot go negative**: enforced by a real `CHECK (current_balance >= 0)`
  constraint on both wallet tables — even a hypothetical bug in the arithmetic would be caught by
  the database itself, not just application logic.
- **Cross-church transfers/approvals cannot be forged**: `transfer_credits` requires
  `is_church_manager(p_from_church_id)` (the caller must manage the *specific* source church) and
  requires the recipient to actually belong to that church; `approve_credit_request`/
  `decline_credit_request` derive the church to authorize against from the request row's own
  `church_id`, never a client-supplied one.
- **All private helpers remain unexposed**: `private.promote_next_waitlisted`, `private.
  apply_refund`, `private.award_progression_event`, and this phase's new `private.
  diagnose_wallet_balance_drift` all confirmed to have zero EXECUTE grant to `authenticated`/`anon`
  (only `postgres`, the function owner).

**Reconciliation diagnostic created, pushed live, and run** (migration `0035`): `private.
diagnose_wallet_balance_drift()` — a read-only, `SECURITY DEFINER`, `stable` function comparing
every wallet's stored `current_balance` against the real `sum()` of its own `credit_ledger_
entries` rows, returning only the wallets where they disagree. Never granted to any client role —
an internal ops diagnostic, not a client-facing feature, and exposes no mutation path whatsoever
(satisfying the brief's "do not expose a reconciliation mutation path to clients" explicitly). Run
live after the push: **zero rows returned — no wallet drift found** (§18).

## 4. Credit request state machine

Verified all six statuses and every transition RPC:

- **Valid transitions**: `submitted`/`under_review` → `fulfilled` (via `approve_credit_request`,
  atomic with the underlying transfer), → `declined` (via `decline_credit_request`), → `cancelled`
  (via `cancel_credit_request`, requester-only).
- **Invalid/repeated transitions**: all three transition RPCs check `status not in ('submitted',
  'under_review')` and raise "already resolved"/"already cancelled" — approval after cancellation,
  cancellation after fulfillment, and decline after fulfillment are all correctly rejected.
- **Concurrent approval attempts**: `approve_credit_request`/`decline_credit_request` both lock
  the request row (`for update`) before checking status — a second concurrent call blocks until
  the first commits, then sees the already-resolved status and raises. No race window exists.
- **Insufficient church balance**: `approve_credit_request` delegates entirely to
  `transfer_credits`, which raises before any status change if the church wallet's real balance
  is insufficient — the request's status is never updated to `fulfilled` in that case (verified:
  the `update credit_requests set status = 'fulfilled' ...` statement runs only *after* the
  `perform transfer_credits(...)` call succeeds, in the same transaction).
- **Church membership/authorization changes during a pending request**: `is_church_manager` is
  evaluated at call time, not cached — a host demoted between submission and review correctly
  fails authorization at the moment they attempt to approve/decline.
- **No transition can partially transfer funds**: confirmed by construction — the balance
  movement and the status update are one transaction; either both happen or neither does.

No correction was needed in this area — the state machine was already sound.

## 5. Experience charge and refund audit

All registration paths reviewed: direct confirmation (`register_for_experience_occurrence`), host
approval (the pre-existing `updateRegistrationStatus` plain-`UPDATE` path), waitlist placement,
waitlist promotion (`private.promote_next_waitlisted`), member cancellation
(`cancel_experience_registration`), occurrence/Experience cancellation
(`refund_registrations_on_occurrence_cancellation`).

- **Waitlisted members are not charged**: `charge_credits_on_registration_confirmation` only fires
  on the transition *into* `'confirmed'` — a `'waitlisted'` status never triggers it.
- **Promotion charges exactly once**: the same trigger fires on the `'waitlisted'` → `'confirmed'`
  transition (the promotion itself), and its own idempotency key prevents a second charge if the
  trigger somehow fired twice for the same row.
- **Insufficient balance prevents confirmation safely**: the trigger raises an exception, which
  rolls back the entire enclosing transaction — including whichever insert/update triggered it.
  Confirmed: **no partial state is possible** — a failed charge cannot leave a confirmed
  registration (the whole transaction aborts), and a failed registration cannot leave a debit (the
  charge never runs if the registration insert itself fails first).
- **Registration and charge occur atomically**: same reasoning — one trigger, one transaction, no
  two-phase gap.
- **Member refund cutoff**: confirmed exact implementation —
  `coalesce(registration_closes_at, starts_at)`, both `timestamptz` columns. **Timezone boundary
  testing**: because both sides of the comparison (`now()` and the cutoff) are `timestamptz`
  values — absolute instants, always stored/compared in UTC internally regardless of the
  occurrence's own IANA `timezone` display column — there is no DST or local-time ambiguity
  possible in this comparison. This was verified by reading the actual column types (`0022`:
  `starts_at timestamptz not null`, `registration_closes_at timestamptz`), not assumed; no
  timezone-boundary defect exists or could exist in this specific comparison.
- **Church cancellation always refunds qualifying payments**: `refund_registrations_on_occurrence_
  cancellation` refunds *every* unreversed `experience_spend` entry tied to the occurrence, with
  zero exceptions, regardless of individual registration state.
- **Refunds are ledger-backed and idempotent**: both refund paths delegate to `private.
  apply_refund`, which itself checks `reversed_by_entry_id` before acting.
- **Free Experiences**: `credit_cost`/`default_credit_cost` both `null` → the charging trigger's
  `if v_cost is null or v_cost <= 0 then return new;` short-circuits before any wallet touch —
  confirmed no ledger noise for free Experiences.
- **Null cost resolution and occurrence-override precedence**: `coalesce(occurrence.credit_cost,
  experience.default_credit_cost)` — the occurrence's own value always wins when set; falls
  through to the Experience default otherwise; `null` at both levels means free. Confirmed exactly
  matching the `default_capacity`/`capacity` null-means-unlimited precedent this schema already
  established.

No correction was needed in this area.

## 6. Progression integrity audit

Reviewed all five triggers individually — `award_progression_on_lesson_studied`,
`award_progression_on_experience_completion`, `award_progression_on_testimony_submitted`,
`award_progression_on_testimony_church_approval`, `award_progression_on_testimony_kingdom_scroll_
publication` — plus the single shared entry point, `private.award_progression_event`.

- **Every Points/XP change has a progression event**: confirmed — the only two places
  `member_progression_summaries.points_total`/`xp_total` are ever written are inside `private.
  award_progression_event`, and every call into it originates from one of the five triggers, never
  application code.
- **Clients cannot select or override reward amounts**: `award_progression_event` takes no
  amount parameter at all — it looks up `points_amount`/`xp_amount` from `progression_award_rules`
  itself, server-side, every time.
- **Source records are verified server-side**: every trigger reads its event data from the actual,
  already-persisted `new.*` row that fired it (the real `current_stage`, `completion_status`,
  `church_status`/`platform_status`/`visibility`) — never a client-asserted claim.
- **Duplicate qualifying events cannot duplicate awards**: `progression_award_log`'s
  `unique(member_id, event_type, source_row_id)` constraint is the actual guard — `award_
  progression_event`'s insert-then-catch-`unique_violation` pattern means a repeat call for the
  exact same underlying row is a safe no-op, verified structurally (§17 of Phase 11.3's original
  audit, re-confirmed unchanged here).
- **Lesson XP is clamped to the approved platform maximum**: `least(lessons.xp_reward,
  xp_reward_ceiling)` — re-confirmed present, unchanged.
- **Level calculations use authoritative thresholds**: `select level ... from progression_level_
  thresholds where min_xp <= v_new_xp_total order by min_xp desc limit 1` — never a
  hard-coded formula.
- **Exact level boundaries / maximum level**: re-verified via `lib/progressionLevels.ts`'s own
  unit tests (unchanged, still passing) — a threshold's own `min_xp` value itself qualifies for
  that level (`<=`, not `<`), and XP above the highest defined threshold correctly caps at the
  highest level rather than erroring.
- **Reversals recalculating totals/level**: **no reversal mechanism exists for progression awards
  at all** — this was already a named Phase 11.3 limitation (no admin RPC to revoke a badge or
  claw back Points/XP) and remains one; `member_badge_awards.revoked_at`/`revocation_reason`
  are schema-only columns with no code path that ever sets them. This is honestly reported as an
  existing gap, not a defect introduced or missed this phase — building a reversal RPC now would
  be new-feature work, out of this phase's stabilization-only scope.
- **Points do not affect Level; XP does not affect leaderboard rank; Credits affect neither**:
  verified directly by grep across every migration file (§2's inventory, and permanently captured
  as regression tests in `tests/phase11_5Stabilization.test.ts`) — zero cross-references found in
  either direction between the credit/wallet migrations (`0027`–`0031`) and the progression
  migrations (`0032`–`0033`), and both leaderboard views order strictly by `points_total`.
- **Progression totals cannot go negative**: `points_total`/`xp_total` both have a real
  `CHECK (... >= 0)` constraint — "unless expressly supported" does not apply here; negative
  progression totals are not supported at all, by design.
- **Concurrent awards are safe**: `award_progression_event` locks the member's summary row
  (`for update`) before updating cumulative totals — two simultaneous different events for the
  same member (e.g. a lesson completion and a testimony submission landing at the same instant)
  serialize correctly rather than losing an update.
- **Badge evaluation is deterministic and idempotent**: the badge-award loop matches only
  `is_active` + `requirement_type = 'single_event'` + `related_event_type = p_event_type` rows,
  and `on conflict (member_id, badge_id) do nothing` makes a repeat match a safe no-op.

No correction was needed in this area (the "no reversal mechanism" item is a known, pre-existing,
honestly-documented gap, not something this phase introduced or is expected to close).

## 7. Badge and trophy audit

The five seeded v1 badges, confirmed live and unchanged this phase:

| Slug | Name | Category | Event |
|---|---|---|---|
| `first-lesson-completed` | First Lesson Completed | achievement | `lesson_studied` |
| `first-experience-completed` | First Experience Completed | achievement | `experience_completed` |
| `first-testimony-submitted` | First Testimony Submitted | achievement | `testimony_submitted` |
| `church-approved-testimony` | Church-Approved Testimony | achievement | `testimony_church_approved` |
| `kingdom-scroll-contributor` | Kingdom Scroll Contributor | **trophy** | `testimony_kingdom_scroll_published` |

- **Trophy badges use the badge category model, no separate backend**: confirmed —
  `badge_definitions.category` is the only trophy-related schema, unchanged.
- **Hidden-until-earned behavior**: `selectVisibleBadges` (Phase 11.4, unit-tested) excludes a
  hidden badge entirely until earned; none of the five v1 badges currently use this flag
  (`is_hidden_until_earned = false` for all five), so it's exercised only by the unit tests today,
  not live data — noted honestly, not a defect.
- **Disabled badges are not awarded**: the award loop filters `is_active` directly.
- **Disabled badges are not improperly displayed**: `getAllBadgeDefinitions` filters
  `is_active = true` at the query level — a disabled badge never reaches the page at all.
- **Criteria evaluation is centralized**: exactly one place, `private.award_progression_event`'s
  badge loop.
- **Repeated evaluation does not duplicate awards**: `member_badge_awards`' `unique(member_id,
  badge_id)` constraint plus `on conflict do nothing`.
- **Source/award metadata remains auditable**: `award_source`, `related_lesson_id`/
  `related_experience_id`/`related_testimony_id`, `awarded_at`, `awarded_by` (null for automatic
  awards) — all populated, never deleted.
- **Direct client badge awards are blocked**: no INSERT/UPDATE/DELETE policy on
  `member_badge_awards` for any role.
- **Badge ordering is deterministic**: `display_order` ascending, unit-tested
  (`selectVisibleBadges`).
- **Icon fallback**: `BadgesGrid` renders a generic `Award`/`Trophy`/`Lock` icon based on
  earned/category state — no `image_url` is populated for any of the five seeded badges yet, and
  the component never assumes one exists (it doesn't render an `<img>` at all currently, avoiding
  a broken-image risk entirely rather than needing a fallback image).
- **Names/descriptions are production-appropriate**: reviewed all five — plain, clear,
  non-technical language, no placeholder text.

The catalog was **not expanded** this phase, per the explicit instruction not to grow it
substantially — no obvious omission was found that would warrant an exception.

## 8. Leaderboard audit

- **Ranking uses lifetime Points only**: re-confirmed via direct migration-source grep (§6) and a
  new permanent regression test.
- **Deterministic tie-breaking**: `order by points_total desc, created_at asc` — the earlier
  achiever of an identical Points total ranks higher, never an unstable/arbitrary order.
- **Current member rank accuracy / outside the top result set**: `getMyGlobalRank`/
  `getMyChurchRank` read the member's own row directly from the same ranked view (the `rank`
  column is computed over the full underlying data regardless of an outer `WHERE profile_id = ...`
  filter) — the displayed rank is never independently recomputed.
- **Church leaderboard scope**: derived entirely from `auth.uid()` inside the view's own `WHERE
  EXISTS (... my_cm.profile_id = auth.uid())` clause — never a client-supplied church id anywhere
  in the call chain (service layer, server component, or view definition).
- **Cross-church access blocked**: by the same `auth.uid()`-scoped `WHERE EXISTS` — a member can
  never see a church's ranked list they don't belong to.
- **Privacy opt-out respected**: `where not mps.leaderboard_opt_out` inside both views themselves
  — no application code path bypasses this filter.
- **Deleted/disabled accounts**: `member_wallets`/`member_progression_summaries`/`profiles` all
  cascade-delete via their `references ... on delete cascade` foreign keys — a deleted `auth.users`
  row's progression summary is removed automatically, so it can never appear on a leaderboard.
  There is no separate "disabled" (vs. deleted) account concept anywhere in this schema to handle
  differently.
- **Email/private fields never exposed**: both views select only `profile_id`, `full_name`,
  `points_total`, `xp_total`, `current_level`, `rank` (+ `church_id` on the church view) —
  confirmed by direct column-list inspection, live and in source.
- **Pagination/result limits**: `getGlobalLeaderboard`/`getMyChurchLeaderboard` both use `.range()`
  with a default `limit = 25` — bounded, not an unbounded full-table fetch.
- **Query indexes**: `member_progression_summaries_points_total_idx` (`points_total desc,
  created_at asc`) exists and matches the exact `ORDER BY` both views use — confirmed via
  `pg_indexes` (unchanged since Phase 11.3).
- **Zero-Point members**: included and ranked normally (no product rule excludes them); a
  brand-new member with no `member_progression_summaries` row yet simply doesn't appear on any
  leaderboard at all until their first real event creates one — this is the correct, intended
  behavior (not an error state), and the dashboard/leaderboard UI both handle a `null`/absent
  summary gracefully (Phase 11.4).

**Query plan review**: with `member_progression_summaries_points_total_idx` in place and both
views' `ORDER BY` matching it exactly, the planner has what it needs for an index-backed sort at
realistic data volumes; no additional index was found necessary. No inefficient full-table scan
pattern was found in either view or in the church-scoped `EXISTS` subquery (which itself is backed
by `church_memberships`' existing indexes from Phase 2).

## 9. Database security audit (migrations `0027`–`0035`)

Every new table/view/function/trigger reviewed:

- **RLS status**: enabled on all 10 tables (`member_wallets`, `church_wallets`,
  `credit_ledger_entries`, `credit_requests`, `progression_award_rules`,
  `progression_level_thresholds`, `member_progression_summaries`, `progression_award_log`,
  `badge_definitions`, `member_badge_awards`) — confirmed live.
- **SELECT policies**: present on all 10 — own-row/church-manager/admin scoping as designed per
  table (full detail in the Phase 11.1/11.2/11.3 audits, re-confirmed unchanged here).
- **Mutation policies**: `member_wallets`, `church_wallets`, `credit_ledger_entries`,
  `credit_requests`, `member_progression_summaries`, `progression_award_log`,
  `member_badge_awards` — **zero** INSERT/UPDATE/DELETE policies on any of the seven (RPC/
  trigger-only writes). `progression_award_rules`/`progression_level_thresholds`/
  `badge_definitions` — an admin-only `ALL` policy exists on all three (intentional: a platform
  admin manages these catalogs directly).
- **Authenticated/anonymous grants**: table-level grants are broad by the same project-wide
  Supabase default-privilege convention documented since Phase 10.1 (`anon`/`authenticated` both
  show INSERT/UPDATE/DELETE at the `information_schema.role_table_grants` level on several of
  these tables) — confirmed, again, that this is harmless because **no RLS policy exists to permit
  the write**, so Postgres denies it regardless of the grant. Function EXECUTE grants: all 16
  public RPCs show `authenticated` (and, via the same default-privilege convention, `anon`) —
  every one of them rejects a null `auth.uid()` as its first statement, confirmed by source read.
- **`SECURITY DEFINER` usage / locked `search_path`**: confirmed on all 16 public functions and all
  4 `private`-schema helpers (`is_church_manager` [pre-existing], `promote_next_waitlisted`
  [pre-existing], `apply_refund`, `award_progression_event`) plus the new `diagnose_wallet_balance_
  drift`.
- **Private schema exposure**: none of the 4 `private`-schema functions have any EXECUTE grant to
  `authenticated`/`anon` — confirmed live via `information_schema.routine_privileges` (only
  `postgres` appears as grantee for each).
- **View security behavior**: `leaderboard_global`/`leaderboard_my_church` intentionally bypass
  `member_progression_summaries`' own restrictive RLS (views run with their owner's privileges,
  not the invoking role's, unless `security_invoker` is set) — this is the *correct*, intended
  behavior for a Global leaderboard (which must show every non-opted-out member to any caller);
  the church-scoped view's own `auth.uid()`-filtered `WHERE EXISTS` clause is what actually
  enforces its isolation, confirmed by direct source inspection, not RLS.
- **Forged member/church IDs, cross-church/cross-member access**: covered exhaustively in §3–§6
  above and in Phase 11.2/11.4's own dedicated security sections; no new forgery vector found this
  phase.
- **Reward/balance/request-status tampering**: no RPC accepts a caller-supplied amount/status for
  anything it computes itself; every amount/status transition is either looked up server-side
  (award rules, level thresholds) or explicitly re-validated (request status whitelist checks).
- **Leaderboard privacy leakage**: none found (§8).

**Trigger-name truncation — resolved and live.** Migration `0034` renamed the one trigger whose
original name exceeded Postgres's 63-byte identifier limit
(`award_progression_on_testimony_kingdom_scroll_publication_trigg`, silently truncated at creation
in `0033`) to a short, exact name that fits without truncation
(`testimony_kingdom_scroll_publication_trigger`, 44 characters). This was a purely cosmetic defect
(the trigger itself was always fully functional, confirmed live in Phase 11.3's verification) — the
rename carried no behavioral risk since renaming a trigger changes only what `pg_trigger` reports,
never what it does. **Pushed live on explicit authorization and re-verified: exactly one trigger
now exists under the new name, enabled, invoking the same unchanged function** (§18/§20).

**Reverse-transaction duplication — left undisturbed, documented (§2).** Consolidating `reverse_
credit_transaction`'s inline logic into `private.apply_refund` (which would require
parameterizing `apply_refund`'s hardcoded `'refund'` transaction type) was considered and
deliberately not done this phase — it is a maintainability observation, not a defect, and this
phase's own instruction is not to broadly redesign an approved system absent a real defect.

## 10. Application security audit

Reviewed every server action/service-layer entry point touching economy or progression data
(`app/actions/wallet.ts`, `app/actions/hostCredits.ts`, `app/experiences/actions.ts`,
`app/host-dashboard/experiences/actions.ts`, `services/supabase/wallets.ts`,
`services/supabase/progression.ts`).

- **Authenticated identity from the server session**: every action calls `supabase.auth.getUser()`
  server-side (via `lib/supabase/server.ts`'s `createClient()`); none trusts a client-supplied
  profile id for "who is acting."
- **Profile/church IDs not trusted from client input**: every action that operates on a specific
  church (e.g. `getChurchWalletAction`, `getCreditRequestsForChurchAction`) re-derives
  authorization via `requireChurchAccess`/`is_church_manager` against the *specific* church
  argument, never assuming "the caller's only church"; every action that reads the caller's own
  data (wallet, badges, progression summary) derives the profile id from `auth.getUser()`
  internally, never a parameter.
- **Role checks are centralized**: `hasChurchEditAccess` (shared, `lib/lessonAuth.ts`) and `private.
  is_church_manager` (shared, database-side) are the only two authorization primitives used
  anywhere in this system — no action re-implements its own ad hoc role check.
- **No privileged Supabase client leaks to browser code**: `lib/supabase/server.ts`'s
  `createClient()` (used by every server action and server component in this system) is a
  server-only module; the browser client (`lib/supabase/client.ts`) never uses a service-role key,
  only the public anon key, and RLS is what actually protects data reached through it.
- **No service-role key referenced in client bundles**: confirmed — grep across
  `app/`/`components/`/`services/supabase/wallets.ts`/`progression.ts` finds no
  `SUPABASE_SERVICE_ROLE_KEY` reference anywhere; the only place that env var could plausibly
  appear is server-only configuration, untouched by this phase.
- **No direct financial/progression mutation in React components**: every mutation in this system
  is a named service-layer function wrapping an RPC call; no component contains a raw
  `.from(...).insert()`/`.update()` against any of the ten tables (re-confirmed by the same
  grep-based structural tests from Phase 11.2/11.3/11.4, still passing).
- **Error messages don't disclose sensitive details**: every action's `safeErrorMessage` helper
  (same shape across `app/actions/wallet.ts`, `hostCredits.ts`, `app/experiences/actions.ts`)
  passes through only RPC-raised, human-readable `RAISE EXCEPTION` text or a generic fallback —
  never a raw Postgres error, constraint name, or stack trace.
- **Server results validated before display**: components render only typed fields returned by a
  service function; nothing renders an unchecked raw Supabase response.
- **Stale client state cannot manufacture reward feedback**: `StudiedClient`'s award banner is
  only ever set from the return value of `getMyProgressionAwardForSourceRow`/`getMyBadgeAwards`,
  called *after* `markStudiedComplete` resolves — never from a locally-held or predicted value
  (re-confirmed by the Phase 11.4 structural test, still passing).

Every approved mutation path in this system, documented in one place for this audit:
`create_member_wallet`, `create_church_wallet`, `grant_credits`, `transfer_credits`,
`refund_credits`, `reverse_credit_transaction`, `submit_credit_request`, `cancel_credit_request`,
`approve_credit_request`, `decline_credit_request` (all via `services/supabase/wallets.ts`), plus
the five progression triggers (no client-callable mutation path at all — automatic only).

No application-layer defect was found.

## 11. Remaining mock/technical-debt review

- **`/profile`**: its "Badges Earned" stat pill was replaced this phase with a link to the real
  `/badges` page (removing the `getUserBadges` mock import entirely), because that specific number
  could contradict the real count shown on `/dashboard`/`/badges` — exactly the "contradictory
  real and mock progression values" scenario this phase's brief calls out. The rest of the page
  (name/email/avatar/church, "Active Journeys"/"Testimonies" counts) remains on the mock
  `SessionContext`/`data/churches.ts` layer, **deferred** — it depends on a full identity/session
  replacement well beyond Kingdom Economy's scope, per this phase's own instruction not to
  casually migrate that system. Future migration path: replace `useSession()`/`data/churches.ts`
  with real `supabase.auth.getUser()` + a `services/supabase/profiles.ts`-style real query, at
  which point the "Active Journeys"/"Testimonies" counts can also be safely made real.
- **The "3D Quest Experience" journey stage** (`app/journey/[lessonId]/experienced/page.tsx`):
  unchanged, still self-documented as deferred to a different, already-acknowledged initiative
  (its own comment cites `docs/PHASE9_5_STABILIZATION.md`). No progression contradiction risk was
  found here specifically for Points/XP/Badges (this page shows quest *scores*, a different,
  unrelated mock concept the real Points/XP system never touches) — left untouched.
  Future migration path: build the real "Experience" mini-game/interaction this stage was always
  meant to host, as its own dedicated phase.
- **Remaining mock services/data files** (`services/{badgeService,questService,journeyService}.ts`,
  `data/{badges,quests,users}.ts`, `lib/storage.ts`): confirmed still referenced only by the two
  deferred pages above — not deletable without also retiring those pages, which is out of scope.
  No additional unused mock code was found to remove this phase (Phase 11.4 already removed every
  reference from the real pages).

No authenticated user can currently see a contradictory real/mock Points, XP, Level, or Badge
number anywhere in the app — the one place that risk existed (`/profile`'s badge count) was fixed.

## 12. End-to-end user workflow QA

Performed as the strongest available code-level, database-level, and service-level verification —
**no live browser session exists in this sandbox** (no `.env.local`, the same limitation documented
since Phase 1), so no click-through was possible. Honest status per workflow:

**New member** — first login (redirects to `/login` correctly when unauthenticated, code-verified);
missing wallet recovery (`create_member_wallet` is idempotent and lazily called by the relevant
actions, code-verified); missing progression summary recovery (`getMyProgressionSummary` returns
`null`, handled gracefully by the dashboard's zero-default rendering, code-verified); zero
Credits/Points/XP, no badges, no rank, empty history — all confirmed via the empty-state branches
already built and unit/structurally tested in Phase 11.4, and confirmed against genuinely empty
live data in Phase 11.3/11.4's own live-read verification (§18).

**Existing member** — wallet balance/history, credit request submit/cancel, paid registration,
lesson completion → reward → possible level-up/badge: every individual RPC/trigger in this chain
was re-verified in §3–§6 above; the full chain was not exercised end-to-end in a live browser.

**Church host** — church wallet, request review/approve/decline, insufficient balance, Experience
pricing/override, cancellation/refund: every individual RPC re-verified in §3–§5; same
browser-session limitation.

**Cross-church security** — unauthorized request approval, unauthorized wallet viewing,
unauthorized leaderboard scope, forged registration/progression read/credit movement: all
re-verified structurally and via direct authorization-check source review in §9/§10; no live
cross-account browser test was possible.

This is the same class of limitation honestly documented in every real-data QA section since
Phase 1 — not new to this phase, and not glossed over.

## 13. Concurrency and replay testing

Database-enforced invariants (not just application code) verified for every scenario named in the
brief, by direct source inspection of the actual locking/idempotency mechanism each relies on:

| Scenario | Enforced by |
|---|---|
| Two simultaneous credit-request approvals | `for update` lock on the `credit_requests` row |
| Simultaneous wallet transfers | `for update` lock on both the church and member wallet rows, acquired in a fixed order (church first, then member) in every code path |
| Duplicate idempotency keys | `credit_ledger_entries_idempotency_key_key` unique index |
| Simultaneous paid registration attempts | `for update` lock on the occurrence row (capacity) plus the wallet row (balance), both already established in Phase 10/11.2 |
| Waitlist promotion replay | `private.promote_next_waitlisted`'s own occurrence-row lock, unchanged since Phase 10.1 |
| Cancellation/confirmation race | Both paths lock the registration row before mutating it |
| Cancellation/refund replay | `reversed_by_entry_id` check inside `private.apply_refund` |
| Simultaneous lesson completion | `lesson_journeys`' own `unique(user_id, lesson_id)` plus the trigger's `WHEN` guard |
| Repeated Experience completion update | `sync_journey_on_experience_completion`/`award_progression_on_experience_completion` both guard on the `not_started`→`completed` transition specifically |
| Concurrent badge evaluation | `member_badge_awards`' `unique(member_id, badge_id)` + `on conflict do nothing` |
| Concurrent rank-affecting awards | `for update` lock on `member_progression_summaries` inside `award_progression_event` |
| Progression reversal replay | N/A — no reversal mechanism exists yet (§6) |

Live concurrent-transaction testing (two real simultaneous connections) was not performed — this
sandbox has no harness for orchestrating genuinely concurrent database sessions. The verification
above confirms the *locking primitives* that would prevent a race are present and correctly
ordered, which is the same standard of evidence every prior phase's concurrency claims have relied
on (a live Postgres row lock is a database-enforced guarantee, not something that needs a
successful race simulation to prove — the lock either exists in the code path or it doesn't, and
it does, in every path reviewed).

## 14. Performance review

- Wallet history: paginated (`limit`/`offset`, capped at 200 server-side inside the RPC itself).
- Progression history: bounded (`limit = 8` on the dashboard, `limit = 20` default in the service
  function) — no unbounded fetch.
- Badge joins: `getAllBadgeDefinitions`/`getMyBadgeAwards` are two independent, indexed queries
  (`member_badge_awards_member_id_idx`/`badge_id_idx`) merged in memory, not a slow client-side
  join — appropriate at this data volume (a handful of badges per member).
- Global/church leaderboard queries: index-backed (`member_progression_summaries_points_total_
  idx`), bounded (`.range()`, default 25).
- Current-member rank queries: a single indexed row lookup (`eq("profile_id", ...)` against the
  same view), not a full leaderboard scan.
- Dashboard data loading: `Promise.all` across 7 independent reads — no N+1 pattern, no
  sequential-when-parallelizable fetch.
- No unnecessary client hydration: all three real pages are server components; the only client
  components (`BadgesGrid`, `LeaderboardTabs`) do pure in-memory filtering over already-fetched
  data, never their own fetch.
- No duplicate server reads found across the reviewed pages.
- No missing index was found for any query pattern actually used by this system.

No performance defect was found; no change was made in this area.

## 15. Accessibility and responsive QA

Re-reviewed every item from Phase 11.4's own accessibility section (§13 of that audit) plus the
newly-touched `/profile` page:

- Keyboard navigation: all interactive controls (category/scope tabs, links) are real `<button>`/
  `<a>` elements — no custom widget requiring bespoke key handling.
- Focus visibility: relies on this app's existing global focus-ring styling (unchanged, not
  overridden anywhere in the progression components).
- Headings/labels/table semantics: unchanged from Phase 11.4's review — `<table>`/`<caption
  className="sr-only">`/`scope="col"` on the leaderboard, `role="progressbar"` with full
  `aria-value*` attributes on the XP bar, `role="tab"`/`aria-selected` on both filter/scope
  switchers.
- Current-member highlight: background tint *and* a text "(You)" suffix — never color alone
  (unchanged, re-confirmed).
- `/profile`'s edited stat-pill row: the new "View" badges link uses `StatPill`'s existing,
  already-accessible `href` variant (a real `<Link>`), no new accessibility concern introduced.
- Mobile layout: unchanged responsive class usage from Phase 11.4, re-confirmed no horizontal
  overflow risk was introduced by this phase's edits.

No meaningful accessibility defect was found this phase; the one code change (`/profile`) reused
an already-accessible existing component pattern rather than introducing a new one.

## 16. Error and recovery audit

Reviewed behavior for every scenario named in the brief, all handled by the same, already-
established pattern across the three real pages and every server action (`SupabaseConfigError` →
`ErrorState`; unexpected error → logged + generic `ErrorState` message; RLS/RPC rejection → the
RPC's own clear `RAISE EXCEPTION` text surfaced via `safeErrorMessage`):

- Supabase read/mutation failure, RPC not found (would surface as a generic Postgres error,
  caught by the same generic-error branch, never a raw stack trace), missing wallet/progression
  summary/level-threshold (all handled as an explicit `null`/empty-array branch, not an error),
  empty badge catalog (`EmptyState`), malformed service response (would fail the mapper's implicit
  shape assumptions and surface as a generic caught error, same as any other unexpected exception
  — no defensive validation gap was found that would instead silently show wrong data), unauthenticated
  request (`redirect("/login?next=...")` on every real page), removed church membership (`hasChurch`
  becomes `false` on next load, the "My Church" tab correctly disables), stale request status
  (the request RPCs' own status-whitelist checks catch this), insufficient balance (a clear
  `RAISE EXCEPTION` message, never a silent failure), duplicate operation (idempotent no-op,
  §3/§13), database timeout (would surface as a generic Postgres/network error, caught the same
  as any other unexpected exception).
- **No scenario reviewed produces a false "success"/"reward granted" message** — every success
  path only shows a reward/charge/confirmation after the underlying RPC call has actually
  returned successfully; every catch branch shows an error, never a fabricated success.

No correction was needed — this pattern was already consistently applied across every real page
since Phase 10.

## 17. Tests added

- `tests/phase11_5Stabilization.test.ts` (new) — 6 tests: `private.diagnose_wallet_balance_drift`'s
  read-only/security shape and its exact balance-vs-ledger-sum comparison logic; a permanent
  regression guard confirming zero cross-references between the credit/wallet migrations and the
  progression migrations in either direction; both leaderboard views' Points-only ranking;
  `current_level`'s re-derivation (never direct incrementing).
- `tests/progressionAwards.test.ts` — 1 new test (the 0034 trigger-rename verification) plus an
  updated comment on the existing trigger-attachment test clarifying it checks historical creation
  syntax, not the currently-live name.
- All Phase 1–11.4 tests (243) re-verified unaffected — **no existing test was weakened, replaced,
  or removed**. **250/250 total passing.**

## 18. Live database verification

**First pass** (before `0034`/`0035` were pushed), performed against the linked Supabase project
(`ytnftubajizhuylhmsib`), read-only:

- `npx supabase migration list`: `0001`–`0033` all showed matching local/remote entries; `0034`/
  `0035` (this phase's two corrective migrations) correctly showed an empty remote entry —
  intentionally pending, not yet pushed.
- Consolidated live counts: all 10 economy/progression tables present, both leaderboard views
  present, RLS enabled on all 10 tables, 6 of 7 progression/credit triggers enabled under their
  original name, the 7th (Kingdom Scroll publication) confirmed enabled under its still-truncated
  live name (pending the `0034` rename), 5/5 active badges, 5/5 active award rules — all real,
  currently-seeded data, nothing fabricated.
- `member_wallets`' table-level grant to `authenticated` includes INSERT/UPDATE/DELETE (3 grant
  rows) — re-confirmed as the same harmless, project-wide Supabase default-privilege convention
  documented since Phase 10.1: RLS has no matching write policy, so Postgres denies the write
  regardless of this grant.
- No real member or church data was modified for this verification — every query was a read.

**Second pass — after explicit owner authorization, migrations `0034` and `0035` were pushed to
the linked Supabase project** (the repository's only linked project, the same one every prior
phase has used) and re-verified live:

- `npx supabase migration list` post-push: all of `0001`–`0035` now show matching local/remote
  entries. `npx supabase db push --dry-run` reports "Remote database is up to date."
- **Trigger correction verified**: exactly one trigger now exists for the testimony Kingdom Scroll
  publication event (`pg_trigger` query returned a single row) — named
  `testimony_kingdom_scroll_publication_trigger` (44 characters, well under the 63-byte limit),
  attached to `public.testimonies`, enabled (`tgenabled = 'O'`), and still invoking the exact same,
  unchanged function (`award_progression_on_testimony_kingdom_scroll_publication`). The old
  truncated identifier no longer exists as a separate row — `ALTER TRIGGER ... RENAME` renames a
  trigger in place (same object, same OID, same behavior); it never creates a duplicate or leaves
  a gap where the trigger is momentarily missing.
- **Reconciliation diagnostic verified**: `private.diagnose_wallet_balance_drift` confirmed live —
  `security definer`, `provolatile = 's'` (`STABLE`, i.e. read-only), `search_path=""` locked,
  schema `private`. `information_schema.routine_privileges` shows exactly one grantee,
  `postgres` (the function owner) — **no `authenticated` or `anon` EXECUTE grant exists**.
- **Reconciliation result — run live, read-only**: `select * from
  private.diagnose_wallet_balance_drift();` returned **zero rows**. Every wallet's stored
  `current_balance` matches the real sum of its own `credit_ledger_entries` rows exactly — **no
  drift found**, for either member or church wallets. No corrective action was needed or taken.
- No real member or church financial/progression data was modified by this push or its
  verification — `0034` renamed an existing trigger in place, `0035` added a new read-only
  function, and the diagnostic itself performed only a `SELECT`.

## 19. Known limitations

- **No progression reversal mechanism exists** (§6) — a pre-existing, honestly-documented gap, not
  introduced or expected to be closed this phase.
- **`reverse_credit_transaction`'s duplicated refund-mechanics logic** (§2/§9) — a real DRY
  violation, not a functional defect; left unconsolidated per this phase's own "no broad redesign
  absent a real defect" instruction. Recommended for a future minor consolidation. **Not fixed.**
- **`/profile`'s remaining mock identity/session model and the "3D Quest Experience" journey
  stage** remain deferred (§11), with their future migration paths documented. **Not fixed.**
- **No admin UI exists yet for manual badge/points/XP adjustment** (named since Phase 11.3,
  unchanged). **Not fixed.**
- **No live browser/concurrent-connection test harness exists in this sandbox** (§12/§13) — the
  same standing limitation as every real-data QA section since Phase 1. Full browser-based owner
  acceptance testing is still required before release.
- **Experience completion has no member-facing reward feedback** (named since Phase 11.4,
  unchanged) — reviewed again this phase and confirmed still safe (shows nothing, never
  misleading). **Not built out.**

None of the above are described as fixed — they remain exactly as documented, since none of them
was actually addressed by this verification pass (which was scoped only to `0034`/`0035`).

## 20. Release recommendation

**Migrations `0034` and `0035` are now live, explicitly authorized and applied.** All Phase 11.5
audit findings (§3–§17) remain valid and unchanged, since neither migration altered any of the
systems those sections reviewed — `0034` only renamed a trigger, `0035` only added a new read-only
diagnostic. The live reconciliation run (§18) found zero wallet drift, providing direct, current
evidence (not just structural/code-level confidence) that the financial system's ledger-backed
design is holding correctly in practice.

**Recommend approval for production release, contingent on**:

1. ~~Explicit authorization to push migrations `0034`/`0035`~~ — **done**; both are live and
   verified.
2. Owner review of `docs/KINGDOM_ECONOMY_RELEASE_CHECKLIST.md`, since several of its items
   (smoke-test accounts, owner acceptance testing, environment variables, Vercel configuration)
   require information or access this sandbox does not have.
3. No further code change is recommended before release — this audit found the system financially
   sound (every invariant in §3 holds), the progression system correctly isolated from the economy
   system (§6), and no unresolved security defect (§9/§10). The two items fixed this phase
   (trigger name, `/profile`'s contradictory badge count) were the only real defects found across
   the entire stabilization pass.

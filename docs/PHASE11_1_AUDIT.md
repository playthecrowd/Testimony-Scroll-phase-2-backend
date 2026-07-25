# Phase 11.1 Audit — Wallet, Ledger, RLS & RPC Foundation

Scope: the secure database and server foundation for the Kingdom Economy only — two wallet
tables, an append-only credit ledger, RLS, and eight `SECURITY DEFINER` RPCs. No member/host UI,
no badges/leaderboards/XP/Points/rewards, no Square integration. Migrations `0027`/`0028`, written
and dry-run-verified against the linked Supabase project (`ytnftubajizhuylhmsib`); **not yet
pushed live** — see "Known limitations" below for why, and what's needed to proceed.

## 1. Schema

Two explicit wallet tables (`member_wallets`, `church_wallets`), not one polymorphic table, and one
append-only ledger (`credit_ledger_entries`) with two nullable FK columns pointing at those two
wallet tables — exactly the shape approved in spec §34.4/§35 entry 14. No existing table
(`profiles`, `churches`, `church_experiences`, `events`, etc.) is altered by this migration; every
new table is purely additive.

## 2. Migrations

- **`supabase/migrations/0027_credit_wallets_ledger.sql`** — `member_wallets`, `church_wallets`,
  `credit_ledger_entries`, all constraints/indexes, RLS enablement, and every SELECT-only policy.
  No RPCs here, matching the Phase 10.1/10.2 (`0022`) schema-only-first-migration precedent.
- **`supabase/migrations/0028_credit_wallet_rpcs.sql`** — the eight RPCs (§6 below).
- Both were verified with `npx supabase db push --dry-run` against the linked project: **"Would
  push these migrations: 0027_credit_wallets_ledger.sql, 0028_credit_wallet_rpcs.sql"** — no syntax
  or dependency error. Local migrations remain `0001`–`0028` after this phase; `0001`–`0026` are
  untouched, per the standing immutability rule.

## 3. Wallet model

- `member_wallets`: one row per profile (`profile_id uuid not null unique references
  public.profiles`), `current_balance integer not null default 0 check (current_balance >= 0)`,
  `created_at`/`updated_at` (the latter auto-stamped by the existing `public.set_updated_at()`
  trigger from `0008_lesson_journeys.sql`). Created lazily via `create_member_wallet()`.
- `church_wallets`: identical shape, keyed by `church_id uuid not null unique references
  public.churches`. Created lazily via `create_church_wallet(p_church_id)`, gated by
  `private.is_church_manager(p_church_id)`.
- Both `current_balance` columns are protected from ever going negative by a `CHECK` constraint at
  the database level — not just an application-level check that could be bypassed by a bug
  elsewhere.
- **Balance model, as designed in spec §7**: stored, transactionally synchronized. Every RPC that
  changes a balance locks the wallet row (`for update`) before reading or writing it, and updates
  `current_balance` in the same transaction as the corresponding `credit_ledger_entries` insert —
  never a bare client-writable number, never computed lazily on read alone.

## 4. Ledger model

`credit_ledger_entries` columns: `id`, `member_wallet_id`/`church_wallet_id` (nullable pair, exactly
one populated, enforced by `credit_ledger_entries_exactly_one_wallet`), `amount` (signed integer,
`check (amount <> 0)` — positive credits, negative debits, a deliberate simplification of the
original Phase 11A spec's separate `amount`+`direction` column pair into a single signed column,
per this phase's explicit schema instruction), `transaction_type` (fixed enum: `platform_grant`,
`church_grant`, `member_request_approved`, `purchase`, `experience_spend`, `event_spend`, `refund`,
`promotional_credit`, `administrator_adjustment`, `reversal` — `expiration` deliberately excluded per
the approved decision log), `status` (`pending`/`completed`/`failed`/`reversed`), `idempotency_key`
(unique where not null), `related_church_id`/`related_member_id`/`related_experience_id`/
`related_occurrence_id` (all nullable, populated only when relevant — the latter two are not yet
populated by any Phase 11.1 RPC, reserved for Phase 11.2's Experience-spend work), `description`
(required, human-readable), `metadata` (jsonb, nullable), `created_by`, `created_at`, and a
bidirectional self-referencing reversal pair: `reverses_entry_id` (on the new row, points back at
what it corrects) and `reversed_by_entry_id` (on the original row, points forward once corrected).
This pair is a deliberate small addition beyond the brief's literal column list, added because a
reversal is otherwise only traceable in one direction; it doesn't conflict with anything the brief
asked for. The table is genuinely append-only: no UPDATE policy exists for any role except through
a `SECURITY DEFINER` RPC (which bypasses RLS for its own internal write, run only after its own
authorization check), and no DELETE policy exists at all.

## 5. RLS

Every one of the three tables has RLS enabled with SELECT-only policies — no INSERT/UPDATE/DELETE
policy exists anywhere in `0027`, confirmed both by direct migration-source inspection and by a
structural test (`tests/creditWalletLedger.test.ts`) asserting exactly this.

- **`member_wallets_select_own_or_admin`**: `profile_id = auth.uid()` or a direct
  `profiles.is_platform_admin` check (mirrors `admin_moderation_log`'s own admin-check shape).
- **`church_wallets_select_managed`**: `private.is_church_manager(church_id)` — a regular member
  never sees their own church's wallet balance, only a host/admin (or a platform admin, via that
  same helper's built-in admin branch).
- **`credit_ledger_entries`** has three SELECT policies: the owning member's own wallet's entries
  (`credit_ledger_entries_select_own_member_wallet`), a church manager's own church wallet's entries
  (`credit_ledger_entries_select_managed_church_wallet`), and full visibility for a platform admin
  (`credit_ledger_entries_select_admin`, needed as its own explicit branch since
  `is_church_manager`'s admin check only covers church-wallet rows, not member-wallet-only ones).

No `using(true)` policy exists anywhere in this migration.

## 6. RPCs

All eight run `security definer` with `set search_path = ''` locked, matching every prior
money-adjacent RPC in this codebase (Phase 10's four registration RPCs). Row locking
(`select ... for update`) is present in every RPC that reads a wallet or ledger row before
deciding whether/how to mutate it.

| RPC | Authorization | Locks | Idempotent | Notes |
|---|---|---|---|---|
| `create_member_wallet()` | Any signed-in user, for their own wallet only | n/a (insert-or-return) | Yes — returns the existing wallet | |
| `create_church_wallet(p_church_id)` | `private.is_church_manager(p_church_id)` | n/a | Yes | |
| `grant_credits(...)` | Platform admin only | Target wallet row | Yes, via caller-supplied `p_idempotency_key` | Mints new credit; no source wallet debited; `transaction_type` restricted to `platform_grant`/`promotional_credit`/`administrator_adjustment` |
| `transfer_credits(...)` | `private.is_church_manager(p_from_church_id)` | Church wallet row, then member wallet row | Yes, two independent keys (`:debit`/`:credit` suffix) | Rejects if the church wallet's real balance is insufficient (no exceptions, spec §34.6); rejects if the recipient isn't actually a member of that church |
| `refund_credits(p_ledger_entry_id, ...)` | Platform admin, or church manager of the entry's `related_church_id` | Original ledger entry row | Yes — refuses to act twice on the same entry, returns the existing refund | Credits back the exact opposite of the original amount |
| `reverse_credit_transaction(p_ledger_entry_id, p_reason)` | Platform admin only | Original ledger entry row | Yes — same double-action guard as refund | Generic undo of any entry, requires a non-empty reason |
| `get_wallet_balance(...)` | Wallet owner, church manager, or platform admin | n/a (read-only) | n/a | |
| `get_wallet_history(...)` | Same as above | n/a (read-only) | n/a | `p_limit` capped at 200 |

## 7. Service layer

`services/supabase/wallets.ts` — typed wrapper functions only, no page/route/component consumes
them yet: `getMyMemberWallet`, `getChurchWallet` (plain RLS-gated selects), `createMemberWallet`,
`createChurchWallet`, `grantCredits`, `transferCredits`, `refundCredits`,
`reverseCreditTransaction`, `getWalletBalance`, `getWalletHistory` (all thin `supabase.rpc(...)`
wrappers). New types (`MemberWallet`, `ChurchWallet`, `CreditTransactionType`,
`CreditLedgerEntryStatus`, `CreditLedgerEntry`) added to `types/index.ts`, deliberately named to
avoid any collision with that file's pre-existing mock `Badge`/`Journey` interfaces (spec §2d.2).
No client-side balance math exists anywhere in this file — every number the client ever sees comes
back from an RPC that computed it server-side.

## 8. Tests

`tests/creditWalletLedger.test.ts` — 23 new structural tests (migration-SQL- and
application-source-reading, matching this repo's standing no-live-DB-in-`npm test` testing
convention): wallet-table shape and non-negative-balance constraints, ledger exactly-one-wallet
constraint, signed non-zero amount, idempotency-key uniqueness, no INSERT/UPDATE/DELETE grant or
policy on any of the three tables, no direct application-code write against any of them (grep-based,
same technique as `tests/churchExperienceAuthorization.test.ts`), row-locking present in every
mutating RPC, every RPC is `SECURITY DEFINER` with `search_path` locked, the strict
church-balance-limit check, the non-negative-balance CHECK, refund/reversal bidirectional linking
and double-action guards, authorization scoping for every RPC (platform-admin-only,
church-manager-for-a-specific-church, wallet-owner-or-admin), and the ledger's three-way SELECT
policy split. All existing Phase 1–10.4 tests re-verified unaffected.

## 9. Total passing tests

**160/160** (137 before this phase + 23 new), 0 failures.

## 10. Security review

- **Double spending**: `transfer_credits` locks the church wallet row before checking
  `current_balance`, in the same transaction as the debit — no window for a concurrent second call
  to read a stale balance.
- **Duplicate fulfillment**: `credit_ledger_entries_idempotency_key_key` is a real unique index, not
  just an application check — a retried RPC call with the same key is rejected at the database
  level if it somehow bypassed the RPC's own idempotency check.
- **Duplicate reward/refund**: `refund_credits`/`reverse_credit_transaction` both check
  `reversed_by_entry_id is not null` before acting and return the existing reversal row instead —
  verified structurally.
- **Client balance manipulation**: no RLS policy anywhere grants authenticated a direct write to any
  balance column or the ledger table; every mutation is RPC-only, confirmed by both the
  policy-shape test and the no-direct-application-write test.
- **Cross-church transfer/grant**: `transfer_credits` requires `is_church_manager` for the specific
  source church (never "the caller's only church") and requires the recipient to actually belong to
  that church — a host cannot grant their own church's credits to an arbitrary stranger, and cannot
  invoke it against a church they don't manage.
- **Unauthorized refund/reversal**: `refund_credits` requires either a platform admin or the manager
  of the *entry's own* `related_church_id` — a host of an unrelated church cannot refund another
  church's transaction. `reverse_credit_transaction` is strictly platform-admin-only.
- **Negative balances**: prevented by the `current_balance >= 0` CHECK constraint at the schema
  level (not just inside the RPCs) — even a bug in a future RPC's arithmetic cannot push a wallet
  negative; the write itself would fail.
- **Race conditions**: every RPC that reads-then-writes a wallet or ledger row does so under
  `for update` locking, mirroring Phase 10's proven pattern exactly.
- **Admin misuse**: every admin action (`grant_credits`, `reverse_credit_transaction`) still writes
  its own ledger row with `created_by` populated — no silent, untraceable balance change is
  possible even for a platform admin.
- **Deleting transaction history**: no DELETE policy exists on `credit_ledger_entries` for any
  role, and no RPC ever deletes a row — append-only, exactly as designed.

## 11. Known limitations

- **Migrations `0027`/`0028` are written and dry-run-verified, but have not been pushed to the
  linked remote Supabase project.** The Phase 11.1 brief's own step list does not include a live
  `supabase db push` (unlike Phase 10.4's brief, which explicitly required a dry-run *and* explicit
  owner approval before any live database change). Given push is a hard-to-reverse action against
  a shared, production-linked database, it is being treated the same way — completed only on an
  explicit go-ahead, not assumed. **Nothing in this phase can be exercised against a real database
  until that push happens.**
- No live-database verification (the `pg_proc`/`pg_policies`/`role_table_grants` style checks done
  in Phase 10.4) has been performed yet, for the same reason — there is nothing live to check
  against until the migrations are pushed.
- `related_experience_id`/`related_occurrence_id` on `credit_ledger_entries` are defined now but
  populated by no RPC yet — reserved for Phase 11.2's Experience-spend/refund work.
- `transfer_credits`'s and `grant_credits`' lazy wallet-creation-on-first-use has a narrow,
  accepted race: two truly simultaneous first-ever grants to the same brand-new member/church could
  both attempt to insert a wallet row and one would fail on the `unique` constraint, surfacing as an
  error to retry rather than a silent double-wallet. This mirrors the same class of rare,
  accepted-risk race already present elsewhere in this codebase (e.g. simultaneous first-time
  invite acceptance) and is not a security issue — at worst, a legitimate caller sees an error and
  retries.
- No reconciliation job (stored balance vs. `sum(ledger entries)`) exists yet — named in the Phase
  11A spec (§33) as required follow-up work for Phase 11.5, not built in this foundational phase.
- No credit-request, Experience-cost, or refund-on-cancellation logic exists yet — that is Phase
  11.2's scope entirely, per this phase's explicit instruction not to build member/host UI or wire
  wallets into Experience registration yet.

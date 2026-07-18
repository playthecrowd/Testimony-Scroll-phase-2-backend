# Phase 11.2 Audit — Wallet Workflows & Experience Credit System

Scope: the complete Credits workflow on top of Phase 11.1's wallet/ledger foundation — member and
church wallet workflows, the credit request system, and Experience credit costs (charging on
registration/promotion, refunds on member and church cancellation). No Points/XP/Levels/Badges/
Leaderboards/Rewards/Square, and no new UI/page routes — those remain later Phase 11 stages.

Migrations `0029`–`0031`, written and dry-run-verified against the linked Supabase project
(`ytnftubajizhuylhmsib`). **Per an explicit decision this phase** (this repo has exactly one linked
Supabase project — there is no separate development project distinct from the one every prior
phase has used — the owner chose to hold off on any live push until that is separately confirmed),
none of migrations `0027`–`0031` have been pushed live yet. See "Manual verification" below.

## 1. Wallet workflows

- **Automatic wallet creation**: `getMyWalletAction()`/`getChurchWalletAction(churchId)`
  (`app/actions/wallet.ts`, `app/actions/hostCredits.ts`) look up the caller's wallet first and
  lazily create one via `create_member_wallet`/`create_church_wallet` only if none exists yet —
  matching those RPCs' own idempotent design from Phase 11.1.
- **Wallet lookup / current balance**: `getMyMemberWallet`/`getChurchWallet` (plain RLS-gated
  reads) return the wallet row including `currentBalance` directly; `getWalletBalance` (RPC) is
  also available for a caller who only has a wallet id and wants the authorized-lookup shape.
- **Transaction history**: `getWalletHistory` (RPC, paginated via `limit`/`offset`, capped at 200
  per call — enforced inside the RPC itself, not just the client).
- **Empty wallet handling**: a wallet with no ledger entries returns an empty array from
  `getWalletHistory`, not an error; a brand-new (just-created) wallet has `currentBalance: 0`.
- **Missing wallet recovery**: any read attempted before a wallet exists (e.g. `getMyMemberWallet`
  returning `null`) is recovered by the same lazy-creation path described above — there is no
  "wallet not found" dead end for a legitimate signed-in user.
- No client-side balance calculation exists anywhere in this phase's new code — every number
  displayed traces back to a `current_balance` column read via RLS or an RPC.

## 2. Credit request workflow

- **Table**: `credit_requests` (migration `0029`) — `requested_by`, `church_id`,
  `requested_amount` (positive), `related_experience_id` (nullable), `reason`, `status`
  (`submitted`/`under_review`/`approved`/`declined`/`cancelled`/`fulfilled`), `decline_reason`,
  `resolved_by`, `resolved_at`. SELECT-only RLS (own requests, or a church manager's own church's
  requests); no INSERT/UPDATE/DELETE policy or grant — every transition is RPC-only.
- **`submit_credit_request`**: any signed-in member who actually belongs to the target church.
- **`cancel_credit_request`**: only the original requester, only while `submitted`/`under_review`.
- **`approve_credit_request`**: church-manager-gated (via the request's own `church_id`, never an
  assumed church), locks the request row, and **delegates the entire balance movement to
  `transfer_credits`** rather than re-implementing the lock/balance-check/debit/credit sequence —
  the request is only marked `fulfilled` after `transfer_credits` succeeds, inside the same
  transaction, so approval is genuinely all-or-nothing: if the church wallet's balance is
  insufficient, `transfer_credits` raises, and the request's status update never happens either.
- **`decline_credit_request`**: church-manager-gated, records an optional `decline_reason`.
- **`'under_review'`** is a real status value with no RPC transitioning into it yet — reserved for
  a future two-step review workflow, per this phase's brief not requiring one now (mirrors how
  `church_experience_registrations.attendance_status` reserved `'disputed'`/`'revoked'` unused in
  Phase 10.1).
- Server actions: `app/actions/wallet.ts` (member: `submitCreditRequestAction`,
  `cancelCreditRequestAction`, `getMyCreditRequestsAction`) and `app/actions/hostCredits.ts` (host:
  `getCreditRequestsForChurchAction`, `approveCreditRequestAction`, `declineCreditRequestAction`).

## 3. Experience charging

- `church_experiences.default_credit_cost` and `church_experience_occurrences.credit_cost`
  (migration `0031`) — both nullable, both `check (... > 0)` when set. `null` means free, matching
  the existing `default_capacity`/`capacity` null-means-unlimited convention exactly, not
  zero-as-a-magic-number. An occurrence's own cost overrides its Experience's default.
- **Charging is a single trigger, not duplicated RPC logic.**
  `charge_credits_on_registration_confirmation` fires `after insert or update on
  church_experience_registrations`, only on the transition *into* `'confirmed'` status, and only
  for `registration_source = 'self'` (host-recorded walk-ins are deliberately excluded — see
  "Known limitations"). This one trigger transparently covers all three paths that can produce a
  `'confirmed'` row:
  1. `register_for_experience_occurrence`'s own insert, when capacity allows immediate
     confirmation — **charged at registration time**.
  2. `private.promote_next_waitlisted`'s update from `'waitlisted'` to `'confirmed'` — **charged at
     promotion time, never at waitlist time**, exactly as required. Neither
     `register_for_experience_occurrence` nor `promote_waitlist_registration`'s own migration
     (`0023`) needed to change at all to get this behavior.
  3. The existing plain-`UPDATE`-based host-approval path (`updateRegistrationStatus`, for
     `approval_required` Experiences) — also charged transparently.
- **Insufficient balance → reject registration**: the trigger raises an exception when the
  member's wallet balance is below the cost, which rolls back the entire enclosing transaction —
  including whichever insert/update triggered it. Neither RPC needed its own balance-checking code.
- **Idempotent**: the charge's ledger entry uses a deterministic `idempotency_key` derived from the
  registration's own id (`'experience_spend:' || registration.id`) — a second, coincidental fire of
  the trigger for the same row is a safe no-op.
- **Row locking**: the member's wallet row is locked (`for update`) before the balance check and
  debit, same pattern as every Phase 11.1 RPC.

## 4. Refund workflow

- **Member cancellation** (`cancel_experience_registration`, redefined in `0031`): the approved
  rule from spec §34.3 is implemented exactly — full refund when `now()` is before
  `registration_closes_at` (falling back to `starts_at` when that column is null), no refund at or
  after the cutoff. The cutoff check reads the occurrence's own stored timestamps directly,
  entirely server-side; the client never computes or authorizes the outcome. Every other part of
  this function's behavior (authorization, the "already cancelled" guard, atomic waitlist
  promotion) is unchanged from `0023` — only the refund step was appended.
- **Church-initiated occurrence cancellation** (`refund_registrations_on_occurrence_cancellation`,
  a new trigger on `church_experience_occurrences`): fires only on the transition *into*
  `'cancelled'`, and refunds **every** unreversed `experience_spend` ledger entry tied to that
  occurrence, with zero exceptions — regardless of which registration(s) they belong to. This
  covers the existing plain-`UPDATE`-based `cancelOccurrence` client call from Phase 10.3 without
  that function needing to change.
- **Shared refund mechanics, not duplicated**: both refund paths — plus `refund_credits` itself —
  now delegate to a single new unexposed helper, `private.apply_refund` (never granted to
  `authenticated`/`anon`, reachable only from another `SECURITY DEFINER` function, mirroring
  `private.promote_next_waitlisted`'s exact trust model). `refund_credits` (redefined in `0030`)
  keeps its own public-facing authorization check (platform admin or the manager of the entry's
  `related_church_id`) and then delegates; `cancel_experience_registration` and the occurrence-
  cancellation trigger call `private.apply_refund` directly, since the *cancellation itself* was
  already properly authorized before the refund step runs — a second, separate authorization check
  at refund time would have incorrectly rejected a member's own self-service cancellation (a plain
  member is never a platform admin or a church manager, which is exactly why the raw mechanics had
  to be extracted into an unexposed helper rather than reusing the public RPC's own
  caller-facing check).
- **Idempotent / duplicate-refund-proof**: both refund paths check `reversed_by_entry_id is not
  null` before acting and return the existing refund row instead of creating a second one.

## 5. RPC additions

| RPC | Migration | Authorization | Notes |
|---|---|---|---|
| `submit_credit_request` | 0030 | Any member of the target church | |
| `cancel_credit_request` | 0030 | Original requester only | |
| `approve_credit_request` | 0030 | Church manager of the request's own church | Delegates to `transfer_credits` |
| `decline_credit_request` | 0030 | Church manager of the request's own church | |
| `refund_credits` (redefined) | 0030 | Platform admin, or manager of the entry's `related_church_id` | Now delegates to `private.apply_refund` |
| `private.apply_refund` (new, unexposed) | 0030 | Trusts its caller entirely — never granted to any role | Shared refund mechanics |
| `cancel_experience_registration` (redefined) | 0031 | Unchanged from 0023 | Adds the approved refund-cutoff rule |
| `charge_credits_on_registration_confirmation` (trigger) | 0031 | n/a (trigger) | The sole charging entry point |
| `refund_registrations_on_occurrence_cancellation` (trigger) | 0031 | n/a (trigger) | The sole church-cancellation-refund entry point |

## 6. Service changes

- `services/supabase/wallets.ts` — added `getMyCreditRequests`, `getCreditRequestsForChurch`,
  `submitCreditRequest`, `cancelCreditRequest`, `approveCreditRequest`, `declineCreditRequest`,
  plus the `CreditRequest` mapper.
- `services/supabase/churchExperiences.ts` — `CHURCH_EXPERIENCE_SELECT`/
  `CHURCH_EXPERIENCE_OCCURRENCE_SELECT` and their mappers now include `default_credit_cost`/
  `credit_cost`; `CreateExperienceInput`/`CreateOccurrenceInput` and their update counterparts
  accept the new fields (all newly-added fields are read/written by the service layer; the
  existing host UI forms don't yet collect them, see "Known limitations").
- `lib/churchExperienceForm.ts` — `validateExperienceInput`/`validateOccurrenceInput` extended with
  the same "empty (free) or positive whole number" rule already used for capacity.
- `lib/experienceCredits.ts` (new) — `calculateExperienceCreditCost`,
  `hasSufficientBalanceForCost`: pure, read-only preview helpers. Explicitly documented as
  UX-preview-only — the database trigger remains the sole authority on what actually gets charged.
- `app/actions/wallet.ts`, `app/actions/hostCredits.ts` (new) — typed server actions, written ahead
  of their eventual pages (`/wallet`, `/credit-requests`, `/host-dashboard/credits` don't exist as
  routes yet) since this phase is explicitly service/RPC-layer only.
- `app/experiences/actions.ts` — added `getExperienceCreditPreviewAction`, a read-only
  cost/balance/sufficiency preview for a given occurrence; `registerForExperienceOccurrenceAction`/
  `cancelMyRegistrationAction` needed **no changes at all** to get charge/refund behavior — the
  database triggers apply transparently underneath the existing RPC calls.
- `types/index.ts` — `MemberWallet`, `ChurchWallet`, `CreditTransactionType`,
  `CreditLedgerEntryStatus`, `CreditLedgerEntry` (Phase 11.1, unchanged) plus new
  `CreditRequestStatus`/`CreditRequest`; `ChurchExperience.defaultCreditCost` and
  `ChurchExperienceOccurrence.creditCost` added.

## 7. Tests

- `tests/experienceCredits.test.ts` (new) — 7 pure-function unit tests for
  `calculateExperienceCreditCost`/`hasSufficientBalanceForCost`.
- `tests/creditRequestsAndExperienceCredits.test.ts` (new) — 25 structural tests: `credit_requests`
  schema/status-enum/RLS, all four request RPCs' authorization and atomicity, `private.apply_refund`
  exposure, `refund_credits`'s delegation, the Experience credit-cost columns, the charging
  trigger's transition-only/walk-in-exclusion/idempotency/locking/rejection behavior, the
  member-cancellation refund cutoff rule, the occurrence-cancellation refund trigger, and
  cross-church-forgery rejection for request approval/decline.
- **Bug found and fixed in this phase's own test-writing process**: the `functionBody` helper (both
  in this phase's new test file and, once identified, retroactively in Phase 11.1's
  `tests/creditWalletLedger.test.ts`) used a non-global regex match, which silently returns a
  function's *first* `create or replace` definition rather than its current, live one — invisible
  until this phase legitimately redefined `refund_credits` and `cancel_experience_registration` in
  later migrations. Fixed by matching globally and taking the last occurrence; the two
  `creditWalletLedger.test.ts` assertions that had been silently validating `refund_credits`'s
  now-superseded 0028 body were updated to check `private.apply_refund` instead, where that logic
  actually lives after the 0030 refactor.
- All Phase 1–11.1 tests re-verified unaffected.

## 8. Security review

- **Cross-church approval**: `approve_credit_request`/`decline_credit_request` both derive the
  church to authorize against from the request row's own `church_id` (`select ... from
  credit_requests where id = p_request_id`, then `is_church_manager(v_request.church_id)`) — never
  from a client-supplied `churchId` parameter. A forged `p_request_id` belonging to another
  church is rejected by this check regardless of what the caller claims.
- **Forged IDs generally**: every new RPC that accepts an id (`p_request_id`, `p_ledger_entry_id`)
  re-derives its authorization from the row the id actually points to, not from any client-supplied
  side channel — consistent with every RPC since Phase 10.
- **Unauthorized grants**: `approve_credit_request` cannot move more than the church wallet's real
  balance (delegated to `transfer_credits`'s own strict, zero-exception check); a member cannot
  self-approve their own request (the RPC requires `is_church_manager`, and a plain member fails
  that check even for their own submitted request).
- **Direct table writes**: `credit_requests` has no INSERT/UPDATE/DELETE policy or grant; a
  structural test confirms no application code anywhere writes to it directly.
- **RPC authorization**: every new/redefined RPC checks `auth.uid() is null` first and its specific
  authorization condition before any read or write with side effects.
- **Duplicate approval**: `approve_credit_request`/`decline_credit_request` both check
  `status not in ('submitted', 'under_review')` and raise before acting — a request cannot be
  approved twice, or approved after being declined.
- **Walk-in charge-bypass is intentional, not a gap**: `registration_source = 'host_walk_in'` is
  explicitly excluded from automatic charging (see Known limitations) — this is a scope decision,
  not an overlooked authorization hole, since walk-ins remain host/admin-only
  (`record_experience_walk_in`'s own `is_church_manager` check, unchanged since Phase 10.1).

## 9. Manual verification

No `.env.local` exists in this sandbox (same environment limitation documented since Phase 1), and
— per an explicit decision this phase — migrations `0027`–`0031` have **not** been pushed to the
one linked Supabase project, since this repo has no separate development project distinct from the
one every prior phase has used, and pushing schema to the only real linked database is being
treated as a hard-to-reverse action requiring its own explicit go-ahead rather than assumed. All
verification this phase is therefore:

- `npx supabase db push --dry-run` — confirms all five migrations (`0027`–`0031`) are syntactically
  valid and would apply cleanly, re-run after every migration file was finalized.
- Structural tests reading the actual migration SQL and application source (32 new tests this
  phase, 192/192 total passing).

**No live-database verification (table/index/constraint/RLS/RPC/grant existence via `supabase db
query`) has been performed, because nothing has been pushed yet.** This is the direct, honest
answer to Step 2's "verify tables exist, indexes exist, ... grants correct" instruction: none of
that can be checked against a real database until a push happens, and that push is intentionally
deferred pending the owner's separate confirmation.

## 10. Known limitations

- **Migrations not yet pushed live** (see above) — the most consequential limitation this phase.
  Until pushed, none of this phase's behavior can be exercised against a real database.
- **Host UI does not yet collect `defaultCreditCost`/`creditCost`.** The service layer, action
  layer, and validation all support it; `ExperienceForm.tsx`/`OccurrenceForm.tsx` were deliberately
  left unchanged since Phase 11.2's brief explicitly excludes UI work. Both fields were made
  optional on the corresponding action-input types specifically so the existing forms keep working
  unmodified (submitting no cost, which defaults to free) rather than breaking a build that this
  phase isn't supposed to touch.
- **Host-recorded walk-ins are never automatically charged**, by deliberate design (see §3) — a
  future phase could add an explicit host-facing "charge this walk-in anyway" toggle if that
  becomes a real product need, but it was not requested here and would risk a worse UX (a live
  attendance-recording action failing due to the walked-in member's insufficient balance).
- **No credit-cost UI exists anywhere yet** — `getExperienceCreditPreviewAction` is a ready-to-use
  preview action with no page calling it yet, per this phase's explicit no-UI scope.
- **`'under_review'`** remains a schema-only status with no RPC transitioning into it (see §2) —
  intentional, not an oversight.
- **The reconciliation job** (stored balance vs. `sum(ledger entries)`, named as required follow-up
  in the Phase 11A spec) still does not exist — unchanged from Phase 11.1, still deferred to
  Phase 11.5.
- **`event_spend`** remains unimplementable — `events` still has no attendance/registration model
  (unchanged finding from the Phase 11A audit); nothing in Phase 11.2 depended on it.

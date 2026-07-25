-- Phase 11.5 (financial integrity audit): a read-only diagnostic function comparing each wallet's
-- stored current_balance against the actual sum of its own credit_ledger_entries rows -- the
-- reconciliation safety net named as required follow-up work since Phase 11.1
-- (docs/PHASE11_ECONOMY_PROGRESSION_SPEC.md SS7: "a reconciliation job... as a verification tool").
--
-- Read-only: performs no mutation whatsoever, only reports a discrepancy if one exists. Every
-- balance-affecting RPC (0028, 0030, 0031) already updates current_balance and inserts a matching
-- credit_ledger_entries row inside the same transaction, so under correct operation this function
-- should always return zero rows -- a non-empty result would indicate a real bug (a missed ledger
-- insert, a manual out-of-band UPDATE, or similar), not something this function itself corrects.
--
-- Never granted to authenticated or anon, matching private.apply_refund/
-- private.award_progression_event's exact exposure model -- this is an internal operations
-- diagnostic (run manually via a service-role/postgres connection), not a member/host-facing
-- feature, and deliberately exposes no mutation path at all, let alone one reachable by a client.
create or replace function private.diagnose_wallet_balance_drift()
returns table (
  wallet_type text,
  wallet_id uuid,
  owner_id uuid,
  stored_balance integer,
  ledger_sum integer,
  drift integer
)
language sql
security definer
stable
set search_path = ''
as $$
  select
    'member'::text as wallet_type,
    mw.id as wallet_id,
    mw.profile_id as owner_id,
    mw.current_balance as stored_balance,
    coalesce(sum(cle.amount), 0)::integer as ledger_sum,
    mw.current_balance - coalesce(sum(cle.amount), 0)::integer as drift
  from public.member_wallets mw
  left join public.credit_ledger_entries cle on cle.member_wallet_id = mw.id
  group by mw.id, mw.profile_id, mw.current_balance
  having mw.current_balance <> coalesce(sum(cle.amount), 0)::integer

  union all

  select
    'church'::text as wallet_type,
    cw.id as wallet_id,
    cw.church_id as owner_id,
    cw.current_balance as stored_balance,
    coalesce(sum(cle.amount), 0)::integer as ledger_sum,
    cw.current_balance - coalesce(sum(cle.amount), 0)::integer as drift
  from public.church_wallets cw
  left join public.credit_ledger_entries cle on cle.church_wallet_id = cw.id
  group by cw.id, cw.church_id, cw.current_balance
  having cw.current_balance <> coalesce(sum(cle.amount), 0)::integer;
$$;

revoke all on function private.diagnose_wallet_balance_drift() from public;

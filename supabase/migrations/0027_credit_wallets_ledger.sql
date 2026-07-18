-- Phase 11.1 (docs/PHASE11_ECONOMY_PROGRESSION_SPEC.md, docs/PHASE11_IMPLEMENTATION_PLAN.md):
-- Kingdom Economy database foundation -- member/church wallets and the append-only credit ledger.
-- Schema/RLS only; RPCs live in 0028 (mirrors the 0022/0023 split from Phase 10.1).
--
-- Two explicit wallet tables, not one polymorphic wallet table (owner-approved, spec SS6/SS35
-- entry 1) -- matches this repo's consistent preference for explicit, narrowly-scoped tables.
-- credit_ledger_entries carries two nullable FK columns (member_wallet_id/church_wallet_id) with a
-- CHECK enforcing exactly one populated (owner-approved, spec SS34.4/SS35 entry 14) rather than a
-- generic wallet_type/wallet_id pair, so each reference is enforced by a real foreign key against
-- its own specific table.
--
-- Balance model: a stored, transactionally-synchronized current_balance column on each wallet,
-- updated only inside a SECURITY DEFINER RPC's row-locked transaction alongside the ledger insert
-- (0028) -- never a bare client-writable number, never computed only on read (spec SS7, decision
-- log entry 2). No RLS policy anywhere grants authenticated a direct insert/update/delete on
-- either wallet table's balance or on credit_ledger_entries -- every balance mutation is RPC-only,
-- exactly like church_experience_registrations has no INSERT policy at all (0022).

-- ---------------------------------------------------------------------------
-- member_wallets -- one wallet per member, created lazily via create_member_wallet() (0028).
-- ---------------------------------------------------------------------------
create table public.member_wallets (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  current_balance integer not null default 0 check (current_balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger member_wallets_set_updated_at
  before update on public.member_wallets
  for each row execute function public.set_updated_at(); -- defined in 0008_lesson_journeys.sql

-- ---------------------------------------------------------------------------
-- church_wallets -- one wallet per church, created lazily via create_church_wallet() (0028). A
-- church can never carry a negative balance -- its grant/transfer capacity is always bounded by
-- this real, current value (owner-approved, spec SS34.6/SS35 entry 16), enforced inside the RPCs,
-- never trusted client-side.
-- ---------------------------------------------------------------------------
create table public.church_wallets (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null unique references public.churches (id) on delete cascade,
  current_balance integer not null default 0 check (current_balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger church_wallets_set_updated_at
  before update on public.church_wallets
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- credit_ledger_entries -- the single, append-only source of truth for every credit-affecting
-- event (spec SS7). amount is a single signed integer (positive = credit, negative = debit) --
-- never mutated or deleted once written; a correction is always a new row (refund/reversal),
-- never an edit to this one (spec SS26, "no destructive deletion").
--
-- reverses_entry_id/reversed_by_entry_id form a bidirectional self-referencing pair: the new
-- reversal/refund row's reverses_entry_id points back at the original entry it corrects, and the
-- original entry's own reversed_by_entry_id is updated (once, by the same RPC transaction) to
-- point forward at that new row -- so either row can be found starting from the other.
-- ---------------------------------------------------------------------------
create table public.credit_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  member_wallet_id uuid references public.member_wallets (id) on delete cascade,
  church_wallet_id uuid references public.church_wallets (id) on delete cascade,
  amount integer not null check (amount <> 0),
  transaction_type text not null check (transaction_type in (
    'platform_grant', 'church_grant', 'member_request_approved', 'purchase', 'experience_spend',
    'event_spend', 'refund', 'promotional_credit', 'administrator_adjustment', 'reversal'
  )),
  status text not null default 'completed' check (status in ('pending', 'completed', 'failed', 'reversed')),
  idempotency_key text,
  related_church_id uuid references public.churches (id) on delete set null,
  related_member_id uuid references public.profiles (id) on delete set null,
  related_experience_id uuid references public.church_experiences (id) on delete set null,
  related_occurrence_id uuid references public.church_experience_occurrences (id) on delete set null,
  description text not null,
  metadata jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  reverses_entry_id uuid references public.credit_ledger_entries (id) on delete set null,
  reversed_by_entry_id uuid references public.credit_ledger_entries (id) on delete set null,
  constraint credit_ledger_entries_exactly_one_wallet check (
    (member_wallet_id is not null and church_wallet_id is null)
    or (member_wallet_id is null and church_wallet_id is not null)
  )
);

-- Idempotency: prevents duplicate fulfillment of a retried RPC call outright, at the database
-- level, not just inside application logic (spec SS25).
create unique index credit_ledger_entries_idempotency_key_key
  on public.credit_ledger_entries (idempotency_key)
  where idempotency_key is not null;

create index credit_ledger_entries_member_wallet_id_idx
  on public.credit_ledger_entries (member_wallet_id, created_at desc);
create index credit_ledger_entries_church_wallet_id_idx
  on public.credit_ledger_entries (church_wallet_id, created_at desc);
create index credit_ledger_entries_related_church_id_idx on public.credit_ledger_entries (related_church_id);
create index credit_ledger_entries_related_member_id_idx on public.credit_ledger_entries (related_member_id);
create index credit_ledger_entries_related_experience_id_idx on public.credit_ledger_entries (related_experience_id);
create index credit_ledger_entries_related_occurrence_id_idx on public.credit_ledger_entries (related_occurrence_id);
create index credit_ledger_entries_created_at_idx on public.credit_ledger_entries (created_at desc);

-- ---------------------------------------------------------------------------
-- RLS -- append-only from the client's point of view: every table below gets a SELECT policy
-- only. No INSERT/UPDATE/DELETE policy exists on any of these three tables for any role -- with
-- RLS enabled and no matching policy, every such statement is denied outright, exactly like
-- church_experience_registrations has no INSERT policy (0022). The only way to create a wallet or
-- write a ledger entry is a SECURITY DEFINER RPC (0028), which runs as the function owner and so
-- bypasses these policies entirely for its own internal reads/writes -- the real enforcement is
-- the authorization check *inside* each RPC, not the table grant.
-- ---------------------------------------------------------------------------
alter table public.member_wallets enable row level security;
alter table public.church_wallets enable row level security;
alter table public.credit_ledger_entries enable row level security;

grant select on public.member_wallets to authenticated;
grant select on public.church_wallets to authenticated;
grant select on public.credit_ledger_entries to authenticated;

-- member_wallets: the member sees their own wallet; a platform admin sees any wallet (matches the
-- ledger's own "platform admins see all" rule below -- an admin who can see a member's transaction
-- history can also see that wallet's current balance).
create policy "member_wallets_select_own_or_admin"
  on public.member_wallets for select
  to authenticated
  using (
    profile_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_platform_admin)
  );

-- church_wallets: only that church's host/admin (or any platform admin, via is_church_manager's
-- own admin branch) -- a regular member never sees their church's wallet balance.
create policy "church_wallets_select_managed"
  on public.church_wallets for select
  to authenticated
  using (private.is_church_manager(church_id));

-- credit_ledger_entries: the owning member sees their own wallet's entries; a church manager sees
-- their own church's wallet entries; a platform admin sees every entry (including member-wallet
-- entries that don't belong to any church a given admin manages -- is_church_manager's admin
-- branch only covers church-wallet rows, so this needs its own direct is_platform_admin check,
-- same pattern as admin_moderation_log, 0021).
create policy "credit_ledger_entries_select_own_member_wallet"
  on public.credit_ledger_entries for select
  to authenticated
  using (
    exists (
      select 1 from public.member_wallets mw
      where mw.id = credit_ledger_entries.member_wallet_id and mw.profile_id = auth.uid()
    )
  );

create policy "credit_ledger_entries_select_managed_church_wallet"
  on public.credit_ledger_entries for select
  to authenticated
  using (
    exists (
      select 1 from public.church_wallets cw
      where cw.id = credit_ledger_entries.church_wallet_id and private.is_church_manager(cw.church_id)
    )
  );

create policy "credit_ledger_entries_select_admin"
  on public.credit_ledger_entries for select
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_platform_admin));

-- Phase 11.2 (docs/PHASE11_ECONOMY_PROGRESSION_SPEC.md SS8, docs/PHASE11_2_AUDIT.md): the
-- member-to-church credit request workflow. Schema/RLS only; RPCs live in 0030, mirroring the
-- 0027/0028 schema-then-RPC split from Phase 11.1.
--
-- Approved credits go directly to the member's wallet as fungible balance, not reserved for one
-- Experience only (spec SS8) -- related_experience_id records *why* the request was made (for the
-- host's review context and reporting), it does not scope how the resulting credit may be spent.
--
-- 'under_review' is a real status value but no RPC in 0030 transitions a request into it yet --
-- approve_credit_request/decline_credit_request both accept a request in either 'submitted' or
-- 'under_review'. It exists now so a future two-step review workflow (a host explicitly flagging a
-- request as "looking into it") is a one-line additive change later, not a schema change (mirrors
-- how 'disputed'/'revoked' were deliberately reserved-but-unused on
-- church_experience_registrations.attendance_status in 0022).
create table public.credit_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references public.profiles (id) on delete cascade,
  church_id uuid not null references public.churches (id) on delete cascade,
  requested_amount integer not null check (requested_amount > 0),
  related_experience_id uuid references public.church_experiences (id) on delete set null,
  reason text,
  status text not null default 'submitted' check (status in (
    'submitted', 'under_review', 'approved', 'declined', 'cancelled', 'fulfilled'
  )),
  decline_reason text,
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index credit_requests_church_id_status_idx on public.credit_requests (church_id, status);
create index credit_requests_requested_by_idx on public.credit_requests (requested_by);
create index credit_requests_related_experience_id_idx on public.credit_requests (related_experience_id);

create trigger credit_requests_set_updated_at
  before update on public.credit_requests
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS -- SELECT-only from the client's point of view, same append-only-except-RPC shape as
-- member_wallets/church_wallets/credit_ledger_entries (0027). Every status transition
-- (submit/cancel/approve/decline/fulfill) happens inside a SECURITY DEFINER RPC (0030).
-- ---------------------------------------------------------------------------
alter table public.credit_requests enable row level security;

grant select on public.credit_requests to authenticated;

create policy "credit_requests_select_own"
  on public.credit_requests for select
  to authenticated
  using (requested_by = auth.uid());

create policy "credit_requests_select_managed"
  on public.credit_requests for select
  to authenticated
  using (private.is_church_manager(church_id));

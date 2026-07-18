-- Phase 11.2: credit request lifecycle RPCs, plus a small refactor extracting the raw refund
-- mechanics out of refund_credits (0028) into an unexposed private helper so both
-- refund_credits and this migration's own refund-on-cancellation logic (0031) share one
-- implementation, never two copies of the same balance math (spec/brief Step 9: "no duplicate
-- business logic").
--
-- private.apply_refund mirrors private.promote_next_waitlisted's trust model exactly (0023):
-- no auth.uid()/authorization check of its own, safe only because it is never granted execute to
-- authenticated/anon and every real entry point (refund_credits, cancel_experience_registration,
-- the occurrence-cancellation trigger) performs its own authorization check first -- refund_credits
-- checks the caller is a platform admin or the manager of the entry's related church;
-- cancel_experience_registration/the cancellation trigger only ever refund a spend that their own
-- already-authorized action produced, so no separate re-check is needed at the point of refund.
create or replace function private.apply_refund(p_ledger_entry_id uuid, p_description text)
returns public.credit_ledger_entries
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_original public.credit_ledger_entries;
  v_refund_amount integer;
  v_entry public.credit_ledger_entries;
begin
  select * into v_original from public.credit_ledger_entries where id = p_ledger_entry_id for update;
  if v_original.id is null then
    return null;
  end if;

  if v_original.reversed_by_entry_id is not null then
    select * into v_entry from public.credit_ledger_entries where id = v_original.reversed_by_entry_id;
    return v_entry;
  end if;

  v_refund_amount := -v_original.amount;

  if v_original.member_wallet_id is not null then
    update public.member_wallets set current_balance = current_balance + v_refund_amount
    where id = v_original.member_wallet_id;

    insert into public.credit_ledger_entries (
      member_wallet_id, amount, transaction_type, status,
      related_church_id, related_member_id, related_experience_id, related_occurrence_id,
      description, created_by, reverses_entry_id
    ) values (
      v_original.member_wallet_id, v_refund_amount, 'refund', 'completed',
      v_original.related_church_id, v_original.related_member_id, v_original.related_experience_id,
      v_original.related_occurrence_id, p_description, auth.uid(), v_original.id
    )
    returning * into v_entry;
  else
    update public.church_wallets set current_balance = current_balance + v_refund_amount
    where id = v_original.church_wallet_id;

    insert into public.credit_ledger_entries (
      church_wallet_id, amount, transaction_type, status,
      related_church_id, related_member_id, related_experience_id, related_occurrence_id,
      description, created_by, reverses_entry_id
    ) values (
      v_original.church_wallet_id, v_refund_amount, 'refund', 'completed',
      v_original.related_church_id, v_original.related_member_id, v_original.related_experience_id,
      v_original.related_occurrence_id, p_description, auth.uid(), v_original.id
    )
    returning * into v_entry;
  end if;

  update public.credit_ledger_entries set reversed_by_entry_id = v_entry.id where id = v_original.id;
  return v_entry;
end;
$$;

revoke all on function private.apply_refund(uuid, text) from public;

-- refund_credits (0028) redefined to delegate to the shared helper above, after its own
-- authorization check -- the function's external behavior (signature, authorization rule,
-- idempotent double-refund guard) is unchanged from 0028; only its internal implementation is now
-- shared rather than duplicated.
create or replace function public.refund_credits(p_ledger_entry_id uuid, p_description text default null)
returns public.credit_ledger_entries
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_original public.credit_ledger_entries;
  v_is_admin boolean;
  v_authorized boolean;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;

  select * into v_original from public.credit_ledger_entries where id = p_ledger_entry_id;
  if v_original.id is null then
    raise exception 'That transaction could not be found.';
  end if;

  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_platform_admin) into v_is_admin;
  v_authorized := v_is_admin
    or (v_original.related_church_id is not null and private.is_church_manager(v_original.related_church_id));
  if not v_authorized then
    raise exception 'You are not authorized to refund this transaction.';
  end if;

  return private.apply_refund(p_ledger_entry_id, coalesce(p_description, 'Refund of a prior transaction'));
end;
$$;

revoke all on function public.refund_credits(uuid, text) from public;
grant execute on function public.refund_credits(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- submit_credit_request -- any signed-in member of the target church submits a request. Does not
-- move any credit by itself.
-- ---------------------------------------------------------------------------
create or replace function public.submit_credit_request(
  p_church_id uuid,
  p_requested_amount integer,
  p_related_experience_id uuid default null,
  p_reason text default null
)
returns public.credit_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.credit_requests;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;
  if p_requested_amount is null or p_requested_amount <= 0 then
    raise exception 'p_requested_amount must be a positive integer.';
  end if;
  if not exists (
    select 1 from public.church_memberships cm
    where cm.church_id = p_church_id and cm.profile_id = auth.uid()
  ) then
    raise exception 'You must be a member of this church to request credits from it.';
  end if;

  insert into public.credit_requests (
    requested_by, church_id, requested_amount, related_experience_id, reason
  ) values (
    auth.uid(), p_church_id, p_requested_amount, p_related_experience_id, p_reason
  )
  returning * into v_request;

  return v_request;
end;
$$;

revoke all on function public.submit_credit_request(uuid, integer, uuid, text) from public;
grant execute on function public.submit_credit_request(uuid, integer, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- cancel_credit_request -- only the original requester, and only while the request hasn't already
-- been resolved.
-- ---------------------------------------------------------------------------
create or replace function public.cancel_credit_request(p_request_id uuid)
returns public.credit_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.credit_requests;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;

  select * into v_request from public.credit_requests where id = p_request_id for update;
  if v_request.id is null then
    raise exception 'That request could not be found.';
  end if;
  if v_request.requested_by <> auth.uid() then
    raise exception 'You can only cancel your own request.';
  end if;
  if v_request.status not in ('submitted', 'under_review') then
    raise exception 'This request has already been resolved and cannot be cancelled.';
  end if;

  update public.credit_requests
  set status = 'cancelled', resolved_by = auth.uid(), resolved_at = now()
  where id = p_request_id
  returning * into v_request;

  return v_request;
end;
$$;

revoke all on function public.cancel_credit_request(uuid) from public;
grant execute on function public.cancel_credit_request(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- approve_credit_request -- church-manager-only. Delegates the actual balance movement entirely
-- to transfer_credits (0028) rather than duplicating its lock/balance-check/debit/credit logic --
-- transfer_credits' own is_church_manager(p_from_church_id) check still runs and passes here
-- because auth.uid() is the same acting host throughout this call chain. This is what makes
-- approval atomic and all-or-nothing: if transfer_credits raises (e.g. insufficient church
-- balance), this function's own update to credit_requests.status never happens either, since both
-- run inside the same transaction.
-- ---------------------------------------------------------------------------
create or replace function public.approve_credit_request(p_request_id uuid)
returns public.credit_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.credit_requests;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;

  select * into v_request from public.credit_requests where id = p_request_id for update;
  if v_request.id is null then
    raise exception 'That request could not be found.';
  end if;
  if not private.is_church_manager(v_request.church_id) then
    raise exception 'You are not authorized to review requests for this church.';
  end if;
  if v_request.status not in ('submitted', 'under_review') then
    raise exception 'This request has already been resolved.';
  end if;

  perform public.transfer_credits(
    v_request.church_id,
    v_request.requested_by,
    v_request.requested_amount,
    'Approved credit request',
    'credit_request:' || v_request.id,
    v_request.related_experience_id,
    null
  );

  update public.credit_requests
  set status = 'fulfilled', resolved_by = auth.uid(), resolved_at = now()
  where id = p_request_id
  returning * into v_request;

  return v_request;
end;
$$;

revoke all on function public.approve_credit_request(uuid) from public;
grant execute on function public.approve_credit_request(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- decline_credit_request -- church-manager-only.
-- ---------------------------------------------------------------------------
create or replace function public.decline_credit_request(p_request_id uuid, p_reason text default null)
returns public.credit_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.credit_requests;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;

  select * into v_request from public.credit_requests where id = p_request_id for update;
  if v_request.id is null then
    raise exception 'That request could not be found.';
  end if;
  if not private.is_church_manager(v_request.church_id) then
    raise exception 'You are not authorized to review requests for this church.';
  end if;
  if v_request.status not in ('submitted', 'under_review') then
    raise exception 'This request has already been resolved.';
  end if;

  update public.credit_requests
  set status = 'declined', decline_reason = p_reason, resolved_by = auth.uid(), resolved_at = now()
  where id = p_request_id
  returning * into v_request;

  return v_request;
end;
$$;

revoke all on function public.decline_credit_request(uuid, text) from public;
grant execute on function public.decline_credit_request(uuid, text) to authenticated;

-- Phase 11.2 (docs/PHASE11_ECONOMY_PROGRESSION_SPEC.md SS9, docs/PHASE11_2_AUDIT.md): connects
-- the wallet/ledger foundation (0027-0030) to the Experience Platform (0022-0026). Adds a nullable
-- credit_cost column at both the Experience and occurrence level -- null means free, exactly like
-- default_capacity/capacity's existing null-means-unlimited convention (0022), not zero-as-a-magic-
-- number. An occurrence's own credit_cost overrides its Experience's default when set.
--
-- Charging is implemented as a trigger on church_experience_registrations, not as inline logic
-- duplicated inside register_for_experience_occurrence AND promote_waitlist_registration AND the
-- plain-UPDATE host-approval path -- one narrow, idempotent AFTER trigger (mirroring
-- sync_journey_on_experience_completion's shape from 0026 exactly) fires on the *transition into*
-- 'confirmed' status regardless of which of those three paths caused it:
--   * register_for_experience_occurrence's own INSERT, when capacity allows immediate 'confirmed'
--   * private.promote_next_waitlisted's UPDATE from 'waitlisted' to 'confirmed' (charge at
--     promotion time, never at waitlist time -- spec/brief Step 6)
--   * the existing plain-UPDATE approval_required host-approval path (updateRegistrationStatus)
-- Deliberately excludes registration_source = 'host_walk_in' -- a host recording a live walk-in is
-- a different, host-controlled workflow (capacity_override already exists for it) than a member's
-- own credit-gated self-registration; charging a walk-in automatically, possibly failing and
-- rolling back the host's live attendance recording, was not requested by this phase's brief and
-- would be a worse UX than intended. Left as a named limitation, not built here.
--
-- If the member's balance is insufficient, the trigger raises an exception, which rolls back the
-- entire enclosing transaction -- including whichever INSERT/UPDATE caused the transition. This is
-- what makes "insufficient balance -> reject registration" true without either RPC needing its own
-- credit-balance-checking code at all.

alter table public.church_experiences add column default_credit_cost integer check (default_credit_cost > 0);
alter table public.church_experience_occurrences add column credit_cost integer check (credit_cost > 0);

comment on column public.church_experiences.default_credit_cost is
  'Null means free. An occurrence''s own credit_cost overrides this when set (same null-means-unlimited-or-free convention as default_capacity/capacity).';
comment on column public.church_experience_occurrences.credit_cost is
  'Null means "use the Experience''s default_credit_cost" (itself possibly null, meaning free). Never re-derived after a registration is charged -- a later cost change never retroactively affects an already-charged registration.';

-- ---------------------------------------------------------------------------
-- charge_credits_on_registration_confirmation -- the single charging entry point described above.
-- ---------------------------------------------------------------------------
create or replace function public.charge_credits_on_registration_confirmation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_occurrence public.church_experience_occurrences;
  v_experience public.church_experiences;
  v_cost integer;
  v_member_wallet public.member_wallets;
  v_idempotency_key text;
  v_existing public.credit_ledger_entries;
begin
  if new.status <> 'confirmed' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status is not distinct from 'confirmed' then
    return new;
  end if;
  if new.registration_source <> 'self' then
    return new;
  end if;

  select * into v_occurrence from public.church_experience_occurrences where id = new.occurrence_id;
  select * into v_experience from public.church_experiences where id = v_occurrence.experience_id;
  v_cost := coalesce(v_occurrence.credit_cost, v_experience.default_credit_cost);

  if v_cost is null or v_cost <= 0 then
    return new;
  end if;

  v_idempotency_key := 'experience_spend:' || new.id;
  select * into v_existing from public.credit_ledger_entries where idempotency_key = v_idempotency_key;
  if v_existing.id is not null then
    return new;
  end if;

  select * into v_member_wallet from public.member_wallets where profile_id = new.profile_id for update;
  if v_member_wallet.id is null then
    insert into public.member_wallets (profile_id) values (new.profile_id)
    returning * into v_member_wallet;
  end if;

  if v_member_wallet.current_balance < v_cost then
    raise exception 'You do not have enough credits for this registration. Request credits from this church to continue.';
  end if;

  update public.member_wallets set current_balance = current_balance - v_cost where id = v_member_wallet.id;

  insert into public.credit_ledger_entries (
    member_wallet_id, amount, transaction_type, status, idempotency_key,
    related_church_id, related_member_id, related_experience_id, related_occurrence_id,
    description, created_by
  ) values (
    v_member_wallet.id, -v_cost, 'experience_spend', 'completed', v_idempotency_key,
    v_occurrence.church_id, new.profile_id, v_experience.id, v_occurrence.id,
    'Registration charge for ' || v_experience.title, new.profile_id
  );

  return new;
end;
$$;

revoke all on function public.charge_credits_on_registration_confirmation() from public;

create trigger charge_credits_on_registration_confirmation_trigger
  after insert or update on public.church_experience_registrations
  for each row execute function public.charge_credits_on_registration_confirmation();

-- ---------------------------------------------------------------------------
-- refund_registrations_on_occurrence_cancellation -- church-initiated occurrence cancellation
-- always fully refunds every unrefunded experience_spend tied to that occurrence (owner-approved
-- rule, spec SS34.3) -- regardless of which registration(s) it belongs to, and regardless of
-- whether the cancelling host would otherwise have been "the registrant" for
-- cancel_experience_registration's own authorization check. Reuses private.apply_refund (this
-- migration's own refactor) rather than duplicating refund math a third time.
-- ---------------------------------------------------------------------------
create or replace function public.refund_registrations_on_occurrence_cancellation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry record;
begin
  if new.status <> 'cancelled' or old.status is not distinct from 'cancelled' then
    return new;
  end if;

  for v_entry in
    select id from public.credit_ledger_entries
    where related_occurrence_id = new.id
      and transaction_type = 'experience_spend'
      and reversed_by_entry_id is null
  loop
    perform private.apply_refund(v_entry.id, 'Church cancelled this occurrence -- automatic full refund.');
  end loop;

  return new;
end;
$$;

revoke all on function public.refund_registrations_on_occurrence_cancellation() from public;

create trigger refund_registrations_on_occurrence_cancellation_trigger
  after update on public.church_experience_occurrences
  for each row execute function public.refund_registrations_on_occurrence_cancellation();

-- ---------------------------------------------------------------------------
-- cancel_experience_registration (0023) redefined to add the approved member-cancellation refund
-- rule (spec SS34.3): full refund only if now() is before registration_closes_at, falling back to
-- starts_at when that column is null; no refund at or after the cutoff. Every other behavior
-- (authorization, waitlist promotion, the "already cancelled" guard) is unchanged from 0023 -- only
-- the refund step is new, appended after the existing logic. The cutoff check happens entirely
-- server-side, reading the occurrence's own stored timestamps directly; the client never computes
-- or authorizes the refund outcome.
-- ---------------------------------------------------------------------------
create or replace function public.cancel_experience_registration(p_registration_id uuid)
returns public.church_experience_registrations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_registration public.church_experience_registrations;
  v_occurrence public.church_experience_occurrences;
  v_was_confirmed boolean;
  v_cutoff timestamptz;
  v_spend_entry_id uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;

  select * into v_registration from public.church_experience_registrations where id = p_registration_id for update;
  if v_registration.id is null then
    raise exception 'That registration could not be found.';
  end if;

  select * into v_occurrence from public.church_experience_occurrences where id = v_registration.occurrence_id;

  if v_registration.profile_id <> auth.uid() and not private.is_church_manager(v_occurrence.church_id) then
    raise exception 'You are not authorized to cancel this registration.';
  end if;

  if v_registration.status = 'cancelled' then
    raise exception 'This registration is already cancelled.';
  end if;

  v_was_confirmed := v_registration.status = 'confirmed';

  update public.church_experience_registrations
  set status = 'cancelled', cancelled_at = now()
  where id = p_registration_id
  returning * into v_registration;

  if v_was_confirmed then
    perform private.promote_next_waitlisted(v_registration.occurrence_id);
  end if;

  v_cutoff := coalesce(v_occurrence.registration_closes_at, v_occurrence.starts_at);
  if v_cutoff is not null and now() < v_cutoff then
    select id into v_spend_entry_id
    from public.credit_ledger_entries
    where related_occurrence_id = v_registration.occurrence_id
      and related_member_id = v_registration.profile_id
      and transaction_type = 'experience_spend'
      and reversed_by_entry_id is null
    order by created_at desc
    limit 1;

    if v_spend_entry_id is not null then
      perform private.apply_refund(v_spend_entry_id, 'Member cancelled before the registration cutoff -- automatic refund.');
    end if;
  end if;

  return v_registration;
end;
$$;

revoke all on function public.cancel_experience_registration(uuid) from public;
grant execute on function public.cancel_experience_registration(uuid) to authenticated;

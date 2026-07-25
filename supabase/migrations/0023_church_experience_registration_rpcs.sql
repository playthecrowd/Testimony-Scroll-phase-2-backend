-- Phase 10.1: registration lifecycle RPCs -- register, cancel, and promote-from-waitlist.
--
-- Capacity/waitlist enforcement must happen server-side inside a transaction, never client-side
-- and never as a naive check-then-insert (spec SS19, Decision Log entry 4). Every function here
-- follows the exact SECURITY DEFINER + row-locking shape already established by
-- public.accept_church_invite (0011_church_invites.sql) for "a mutation with a race condition a
-- plain RLS-gated INSERT/UPDATE can't safely express."
--
-- private.promote_next_waitlisted is a shared, unexposed helper (not granted to authenticated,
-- mirroring private.is_church_manager's schema placement) so the exact same atomic
-- promote-the-earliest-waitlisted-row logic is used both by a host's explicit
-- promote_waitlist_registration() call and automatically inside cancel_experience_registration() --
-- without cancel_experience_registration needing to re-check is_church_manager against the
-- cancelling member, who is typically not a host at all.

-- ---------------------------------------------------------------------------
-- private.promote_next_waitlisted -- locks the occurrence, checks remaining capacity, and
-- promotes the earliest-waitlisted registration (lowest waitlist_position) if there is room.
-- Returns the promoted row, or null if there was no room or nobody waitlisted. Trusts its caller
-- entirely (no auth.uid()/is_church_manager check of its own) -- safe only because it is never
-- granted execute to authenticated/anon and both real entry points below perform their own
-- authorization check before calling it.
-- ---------------------------------------------------------------------------
create or replace function private.promote_next_waitlisted(p_occurrence_id uuid)
returns public.church_experience_registrations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_occurrence public.church_experience_occurrences;
  v_experience public.church_experiences;
  v_capacity integer;
  v_confirmed_count integer;
  v_next public.church_experience_registrations;
begin
  select * into v_occurrence from public.church_experience_occurrences where id = p_occurrence_id for update;
  if v_occurrence.id is null or v_occurrence.status <> 'scheduled' then
    return null;
  end if;

  select * into v_experience from public.church_experiences where id = v_occurrence.experience_id;
  v_capacity := coalesce(v_occurrence.capacity, v_experience.default_capacity);

  if v_capacity is not null then
    select count(*) into v_confirmed_count
    from public.church_experience_registrations
    where occurrence_id = p_occurrence_id and status = 'confirmed';

    if v_confirmed_count >= v_capacity then
      return null;
    end if;
  end if;

  select * into v_next
  from public.church_experience_registrations
  where occurrence_id = p_occurrence_id and status = 'waitlisted'
  order by waitlist_position asc
  limit 1
  for update;

  if v_next.id is null then
    return null;
  end if;

  update public.church_experience_registrations
  set status = 'confirmed', waitlist_position = null, confirmed_at = now()
  where id = v_next.id
  returning * into v_next;

  return v_next;
end;
$$;

revoke all on function private.promote_next_waitlisted(uuid) from public;

-- ---------------------------------------------------------------------------
-- register_for_experience_occurrence -- a signed-in church member registers for an occurrence.
-- Membership, occurrence status, and the registration window are all re-checked here rather than
-- trusted from the client, since this function's SECURITY DEFINER context bypasses the normal
-- church_experience_occurrences RLS policy entirely for its own internal queries.
-- ---------------------------------------------------------------------------
create or replace function public.register_for_experience_occurrence(p_occurrence_id uuid)
returns public.church_experience_registrations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_occurrence public.church_experience_occurrences;
  v_experience public.church_experiences;
  v_capacity integer;
  v_confirmed_count integer;
  v_status text;
  v_next_waitlist_position integer;
  v_registration public.church_experience_registrations;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to register.';
  end if;

  select * into v_occurrence from public.church_experience_occurrences where id = p_occurrence_id for update;
  if v_occurrence.id is null then
    raise exception 'That occurrence could not be found.';
  end if;
  if v_occurrence.status <> 'scheduled' then
    raise exception 'Registration is not open for this occurrence.';
  end if;
  if v_occurrence.registration_opens_at is not null and now() < v_occurrence.registration_opens_at then
    raise exception 'Registration has not opened yet.';
  end if;
  if v_occurrence.registration_closes_at is not null and now() > v_occurrence.registration_closes_at then
    raise exception 'Registration has closed.';
  end if;

  select * into v_experience from public.church_experiences where id = v_occurrence.experience_id;
  if v_experience.id is null or v_experience.status <> 'published' then
    raise exception 'This Experience is not open for registration.';
  end if;

  if not exists (
    select 1 from public.church_memberships cm
    where cm.church_id = v_occurrence.church_id and cm.profile_id = auth.uid()
  ) then
    raise exception 'You must be a member of this church to register.';
  end if;

  if exists (
    select 1 from public.church_experience_registrations r
    where r.occurrence_id = p_occurrence_id and r.profile_id = auth.uid() and r.status <> 'cancelled'
  ) then
    raise exception 'You are already registered for this occurrence.';
  end if;

  if v_experience.approval_required then
    v_status := 'pending';
  else
    v_capacity := coalesce(v_occurrence.capacity, v_experience.default_capacity);

    if v_capacity is not null then
      select count(*) into v_confirmed_count
      from public.church_experience_registrations
      where occurrence_id = p_occurrence_id and status = 'confirmed';
    end if;

    if v_capacity is null or v_confirmed_count < v_capacity then
      v_status := 'confirmed';
    else
      v_status := 'waitlisted';
    end if;
  end if;

  if v_status = 'waitlisted' then
    select coalesce(max(waitlist_position), 0) + 1 into v_next_waitlist_position
    from public.church_experience_registrations
    where occurrence_id = p_occurrence_id and status = 'waitlisted';
  end if;

  insert into public.church_experience_registrations (
    occurrence_id, profile_id, status, registration_source, waitlist_position, confirmed_at
  ) values (
    p_occurrence_id, auth.uid(), v_status, 'self', v_next_waitlist_position,
    case when v_status = 'confirmed' then now() else null end
  )
  returning * into v_registration;

  return v_registration;
end;
$$;

revoke all on function public.register_for_experience_occurrence(uuid) from public;
grant execute on function public.register_for_experience_occurrence(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- promote_waitlist_registration -- a host/admin explicitly promotes the earliest waitlisted
-- registration for an occurrence, if there is room. Standalone entry point around the shared
-- private helper above.
-- ---------------------------------------------------------------------------
create or replace function public.promote_waitlist_registration(p_occurrence_id uuid)
returns public.church_experience_registrations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_church_id uuid;
begin
  select church_id into v_church_id from public.church_experience_occurrences where id = p_occurrence_id;
  if v_church_id is null then
    raise exception 'That occurrence could not be found.';
  end if;

  if not private.is_church_manager(v_church_id) then
    raise exception 'You are not authorized to manage this occurrence.';
  end if;

  return private.promote_next_waitlisted(p_occurrence_id);
end;
$$;

revoke all on function public.promote_waitlist_registration(uuid) from public;
grant execute on function public.promote_waitlist_registration(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- cancel_experience_registration -- the registrant themselves, or a host/admin of that occurrence's
-- church, cancels a registration. If the cancelled row was 'confirmed', atomically promotes the
-- next waitlisted registration in the same transaction (Decision Log entry 5) -- never a separate,
-- client-triggered follow-up step.
-- ---------------------------------------------------------------------------
create or replace function public.cancel_experience_registration(p_registration_id uuid)
returns public.church_experience_registrations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_registration public.church_experience_registrations;
  v_occurrence_church_id uuid;
  v_was_confirmed boolean;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;

  select * into v_registration from public.church_experience_registrations where id = p_registration_id for update;
  if v_registration.id is null then
    raise exception 'That registration could not be found.';
  end if;

  select church_id into v_occurrence_church_id
  from public.church_experience_occurrences
  where id = v_registration.occurrence_id;

  if v_registration.profile_id <> auth.uid() and not private.is_church_manager(v_occurrence_church_id) then
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

  return v_registration;
end;
$$;

revoke all on function public.cancel_experience_registration(uuid) from public;
grant execute on function public.cancel_experience_registration(uuid) to authenticated;

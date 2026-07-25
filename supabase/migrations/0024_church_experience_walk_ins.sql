-- Phase 10.1: host-recorded walk-in attendance (owner decision 5 of 10, 2026-07-18).
--
-- A walk-in is an existing church member the host records as attending without a prior
-- registration -- never an anonymous/guest attendee (no "guest" workflow was approved in
-- docs/PHASE10_EXPERIENCE_PLATFORM_SPEC.md, so none is added here). Capacity is enforced by
-- default; a host/admin may explicitly override it, and the override is recorded on the row via
-- registrations.capacity_override (added in 0022) so it is auditable/reportable, never silent.

create or replace function public.record_experience_walk_in(
  p_occurrence_id uuid,
  p_profile_id uuid,
  p_attendance_status text default 'attended',
  p_override_capacity boolean default false
)
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
  v_is_over_capacity boolean := false;
  v_registration public.church_experience_registrations;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;

  if p_attendance_status not in ('not_recorded', 'attended', 'absent', 'excused') then
    raise exception 'Invalid attendance status.';
  end if;

  select * into v_occurrence from public.church_experience_occurrences where id = p_occurrence_id for update;
  if v_occurrence.id is null then
    raise exception 'That occurrence could not be found.';
  end if;

  -- Church-scoped, server-authorized -- host/admin only (owner decision 5: "host/admin only").
  if not private.is_church_manager(v_occurrence.church_id) then
    raise exception 'You are not authorized to record attendance for this occurrence.';
  end if;

  -- A walk-in can never bypass church membership -- there is no anonymous-attendee path.
  if not exists (
    select 1 from public.church_memberships cm
    where cm.church_id = v_occurrence.church_id and cm.profile_id = p_profile_id
  ) then
    raise exception 'That person is not a member of this church.';
  end if;

  if exists (
    select 1 from public.church_experience_registrations r
    where r.occurrence_id = p_occurrence_id and r.profile_id = p_profile_id and r.status <> 'cancelled'
  ) then
    raise exception 'That person already has a registration for this occurrence -- update it directly instead of recording a new walk-in.';
  end if;

  select * into v_experience from public.church_experiences where id = v_occurrence.experience_id;
  v_capacity := coalesce(v_occurrence.capacity, v_experience.default_capacity);

  if v_capacity is not null then
    select count(*) into v_confirmed_count
    from public.church_experience_registrations
    where occurrence_id = p_occurrence_id and status = 'confirmed';

    if v_confirmed_count >= v_capacity then
      -- Capacity enforced by default -- an explicit override is required to proceed anyway, and
      -- that intent is what gets recorded below, never silently assumed.
      if not p_override_capacity then
        raise exception 'This occurrence is at capacity. Pass an explicit override to record this walk-in anyway.';
      end if;
      v_is_over_capacity := true;
    end if;
  end if;

  insert into public.church_experience_registrations (
    occurrence_id, profile_id, status, registration_source, capacity_override,
    attendance_status, registered_at, confirmed_at
  ) values (
    p_occurrence_id, p_profile_id, 'confirmed', 'host_walk_in', v_is_over_capacity,
    p_attendance_status, now(), now()
  )
  returning * into v_registration;

  return v_registration;
end;
$$;

revoke all on function public.record_experience_walk_in(uuid, uuid, text, boolean) from public;
grant execute on function public.record_experience_walk_in(uuid, uuid, text, boolean) to authenticated;

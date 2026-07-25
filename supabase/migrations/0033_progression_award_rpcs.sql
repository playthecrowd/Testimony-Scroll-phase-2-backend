-- Phase 11.3: the single award-processing entry point, plus the five real triggers that call it.
-- No open, admin-configurable rule engine (explicit brief instruction, spec SS11/SS12) -- every
-- event type is fixed, and every trigger below fires only on a genuine, already-verified platform
-- event (a real stage transition, a real completion, a real church/platform approval), never on a
-- client-asserted claim.
--
-- private.award_progression_event mirrors private.promote_next_waitlisted/private.apply_refund's
-- trust model exactly: never granted to authenticated/anon, safe only because its five real
-- callers are triggers that fire on a verified column transition, never reachable directly.

create or replace function private.award_progression_event(
  p_member_id uuid,
  p_event_type text,
  p_source_row_id uuid,
  p_related_lesson_id uuid default null,
  p_related_experience_id uuid default null,
  p_related_testimony_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rule public.progression_award_rules;
  v_points integer;
  v_xp integer;
  v_lesson_xp_reward integer;
  v_summary public.member_progression_summaries;
  v_new_xp_total integer;
  v_new_level integer;
  v_badge record;
begin
  select * into v_rule from public.progression_award_rules where event_type = p_event_type and is_active;
  if v_rule.id is null then
    return;
  end if;

  v_points := v_rule.points_amount;
  v_xp := v_rule.xp_amount;

  -- lesson_studied reads its XP amount from the triggering lesson's own xp_reward column,
  -- clamped to xp_reward_ceiling -- owner-approved, spec SS34.2. An unrestricted host-entered
  -- xp_reward can never translate into unlimited XP because of this clamp.
  if v_rule.xp_reward_ceiling is not null and p_related_lesson_id is not null then
    select xp_reward into v_lesson_xp_reward from public.lessons where id = p_related_lesson_id;
    v_xp := least(coalesce(v_lesson_xp_reward, 0), v_rule.xp_reward_ceiling);
  end if;

  -- The real, database-level duplicate-award guard: this insert can only ever succeed once per
  -- (member, event type, source row) thanks to progression_award_log's own unique constraint. A
  -- second attempt for the exact same event is a safe no-op, never a double award.
  begin
    insert into public.progression_award_log (member_id, event_type, source_row_id, points_awarded, xp_awarded)
    values (p_member_id, p_event_type, p_source_row_id, v_points, v_xp);
  exception when unique_violation then
    return;
  end;

  select * into v_summary from public.member_progression_summaries where profile_id = p_member_id for update;
  if v_summary.id is null then
    insert into public.member_progression_summaries (profile_id) values (p_member_id)
    returning * into v_summary;
  end if;

  v_new_xp_total := v_summary.xp_total + v_xp;

  select level into v_new_level
  from public.progression_level_thresholds
  where min_xp <= v_new_xp_total
  order by min_xp desc
  limit 1;

  update public.member_progression_summaries
  set points_total = points_total + v_points,
      xp_total = v_new_xp_total,
      current_level = coalesce(v_new_level, current_level)
  where id = v_summary.id;

  -- Badge award: any active, single_event badge tied to this exact event type that the member
  -- doesn't already hold. member_badge_awards' own unique(member_id, badge_id) constraint is the
  -- real duplicate-award guard here too -- "on conflict do nothing" makes a repeat attempt (e.g. a
  -- second lesson reaching 'studied' after the first badge was already earned) a safe no-op.
  for v_badge in
    select * from public.badge_definitions
    where is_active and requirement_type = 'single_event' and related_event_type = p_event_type
  loop
    insert into public.member_badge_awards (
      member_id, badge_id, award_source, related_lesson_id, related_experience_id, related_testimony_id
    ) values (
      p_member_id, v_badge.id, p_event_type, p_related_lesson_id, p_related_experience_id, p_related_testimony_id
    )
    on conflict (member_id, badge_id) do nothing;
  end loop;
end;
$$;

revoke all on function private.award_progression_event(uuid, text, uuid, uuid, uuid, uuid) from public;

-- ---------------------------------------------------------------------------
-- Trigger 1: lesson_studied -- fires on lesson_journeys.current_stage transitioning into
-- 'studied'. No change to services/supabase/journeys.ts's existing markStudiedComplete() at all --
-- it already performs exactly this UPDATE; this trigger observes it.
-- ---------------------------------------------------------------------------
create or replace function public.award_progression_on_lesson_studied()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.current_stage <> 'studied' or old.current_stage is not distinct from 'studied' then
    return new;
  end if;
  perform private.award_progression_event(new.user_id, 'lesson_studied', new.id, new.lesson_id, null, null);
  return new;
end;
$$;

revoke all on function public.award_progression_on_lesson_studied() from public;

create trigger award_progression_on_lesson_studied_trigger
  after update on public.lesson_journeys
  for each row execute function public.award_progression_on_lesson_studied();

-- ---------------------------------------------------------------------------
-- Trigger 2: experience_completed -- fires on church_experience_registrations.completion_status
-- transitioning into 'completed', the same transition sync_journey_on_experience_completion (0026)
-- already observes for Journey purposes. A separate, independent trigger -- not folded into 0026's
-- function -- since progression and Journey-stage advancement are two different concerns that
-- happen to share one trigger condition.
-- ---------------------------------------------------------------------------
create or replace function public.award_progression_on_experience_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_experience_id uuid;
begin
  if new.completion_status <> 'completed' or old.completion_status is not distinct from 'completed' then
    return new;
  end if;

  select o.experience_id into v_experience_id
  from public.church_experience_occurrences o
  where o.id = new.occurrence_id;

  perform private.award_progression_event(new.profile_id, 'experience_completed', new.id, null, v_experience_id, null);
  return new;
end;
$$;

revoke all on function public.award_progression_on_experience_completion() from public;

create trigger award_progression_on_experience_completion_trigger
  after update on public.church_experience_registrations
  for each row execute function public.award_progression_on_experience_completion();

-- ---------------------------------------------------------------------------
-- Trigger 3: testimony_submitted -- fires on every new testimony insert.
-- ---------------------------------------------------------------------------
create or replace function public.award_progression_on_testimony_submitted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.award_progression_event(new.submitted_by, 'testimony_submitted', new.id, null, null, new.id);
  return new;
end;
$$;

revoke all on function public.award_progression_on_testimony_submitted() from public;

create trigger award_progression_on_testimony_submitted_trigger
  after insert on public.testimonies
  for each row execute function public.award_progression_on_testimony_submitted();

-- ---------------------------------------------------------------------------
-- Trigger 4: testimony_church_approved -- fires on testimonies.church_status transitioning into
-- 'approved'. Independent of platform_status -- a church can approve its own testimony without
-- platform review ever happening (church_only visibility never needs platform review at all).
-- ---------------------------------------------------------------------------
create or replace function public.award_progression_on_testimony_church_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.church_status <> 'approved' or old.church_status is not distinct from 'approved' then
    return new;
  end if;
  perform private.award_progression_event(new.submitted_by, 'testimony_church_approved', new.id, null, null, new.id);
  return new;
end;
$$;

revoke all on function public.award_progression_on_testimony_church_approval() from public;

create trigger award_progression_on_testimony_church_approval_trigger
  after update on public.testimonies
  for each row execute function public.award_progression_on_testimony_church_approval();

-- ---------------------------------------------------------------------------
-- Trigger 5: testimony_kingdom_scroll_published -- fires only when the combined condition this
-- app treats as "Kingdom Scroll publication" (spec SS2a: church_status='approved' AND
-- platform_status='approved' AND visibility='public') becomes newly true -- was not already true
-- on the row before this update. Deliberately a separate trigger from #4 above (church approval and
-- full publication are two distinct badges/events per the brief's own list), even though both
-- react to the same table.
-- ---------------------------------------------------------------------------
create or replace function public.award_progression_on_testimony_kingdom_scroll_publication()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_was_published boolean;
  v_is_published boolean;
begin
  v_was_published := old.church_status = 'approved' and old.platform_status = 'approved' and old.visibility = 'public';
  v_is_published := new.church_status = 'approved' and new.platform_status = 'approved' and new.visibility = 'public';

  if v_is_published and not v_was_published then
    perform private.award_progression_event(new.submitted_by, 'testimony_kingdom_scroll_published', new.id, null, null, new.id);
  end if;

  return new;
end;
$$;

revoke all on function public.award_progression_on_testimony_kingdom_scroll_publication() from public;

create trigger award_progression_on_testimony_kingdom_scroll_publication_trigger
  after update on public.testimonies
  for each row execute function public.award_progression_on_testimony_kingdom_scroll_publication();

-- ---------------------------------------------------------------------------
-- Leaderboard read model (spec SS17). Global and My Church only -- Lesson/Experience/Seasonal
-- scopes are explicitly deferred (spec SS17/SS33): this schema tracks one cumulative points/XP
-- total per member, not a per-lesson or per-experience score, so a "top scorers for lesson X"
-- leaderboard has no real data to rank by yet.
--
-- Both views select only profile_id/full_name/points_total/xp_total/current_level -- never email
-- or any other profiles column -- matching spec SS17's "never raw email" rule. Ranking is by
-- lifetime Points (not XP, not credits), with a stable earned-first tiebreak
-- (member_progression_summaries.created_at ascending), per spec SS17.
-- ---------------------------------------------------------------------------
create view public.leaderboard_global as
select
  mps.profile_id,
  p.full_name,
  mps.points_total,
  mps.xp_total,
  mps.current_level,
  row_number() over (order by mps.points_total desc, mps.created_at asc) as rank
from public.member_progression_summaries mps
join public.profiles p on p.id = mps.profile_id
where not mps.leaderboard_opt_out;

grant select on public.leaderboard_global to authenticated;

-- My Church scope: auth.uid() is evaluated per-query regardless of the view's own ownership, so
-- this correctly restricts to only the churches the CALLING member actually belongs to -- never
-- another church's roster, and never dependent on member_progression_summaries' own restrictive
-- RLS (which this view, like every view, evaluates with its owning role's privileges -- the
-- auth.uid() filter below is what actually enforces the isolation for this specific view).
create view public.leaderboard_my_church as
select
  mps.profile_id,
  p.full_name,
  mps.points_total,
  mps.xp_total,
  mps.current_level,
  cm.church_id,
  row_number() over (partition by cm.church_id order by mps.points_total desc, mps.created_at asc) as rank
from public.member_progression_summaries mps
join public.profiles p on p.id = mps.profile_id
join public.church_memberships cm on cm.profile_id = mps.profile_id
where not mps.leaderboard_opt_out
  and exists (
    select 1 from public.church_memberships my_cm
    where my_cm.church_id = cm.church_id and my_cm.profile_id = auth.uid()
  );

grant select on public.leaderboard_my_church to authenticated;

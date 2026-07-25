-- Phase 10.3, checkpoint 9 (Journey integration).
--
-- IMPORTANT CORRECTION vs. docs/PHASE10_EXPERIENCE_PLATFORM_SPEC.md's original assumption: that
-- spec assumed completing an Experience should advance lesson_journeys.current_stage from
-- 'studied' to 'experienced'. Auditing services/supabase/journeys.ts's markStudiedComplete()
-- (already shipped, Phase 5) shows this is wrong -- current_stage already advances to
-- 'experienced' immediately and unconditionally the moment a member finishes the Studied
-- checklist, entirely unrelated to any real-world Experience. That transition already exists and
-- is not touched here.
--
-- The real, previously-unclaimed transition is 'experienced' -> 'applied': no code path in this
-- repository has ever written 'applied' to a real lesson_journeys row before (confirmed --
-- testimonies_before_insert only *reads* studied_completed_at, it never writes current_stage; the
-- real Applied-stage UI is still entirely mock). Completing a real-world Experience tied to a
-- lesson is the natural real-world equivalent of "applying what you studied" -- this migration
-- makes that the one narrow, idempotent write path for it.
--
-- Scope: this does NOT rebuild the Journey system, the Applied-stage UI, or testimony submission.
-- It adds exactly one AFTER UPDATE trigger on church_experience_registrations that advances a
-- member's own lesson_journeys row for lessons linked to the completed Experience via
-- church_experience_lessons with relationship='required' (a deliberate, documented v1 choice --
-- 'recommended' links are supplementary and do not gate progression; see docs/PHASE10_3_AUDIT.md).
--
-- Why SECURITY DEFINER is required at all: lesson_journeys_update_own (0008_lesson_journeys.sql)
-- only lets a member update their OWN row. Experience completion is typically recorded by a HOST
-- (completion_method='host_marked'), so the acting user is not the journey owner -- an ordinary
-- RLS-gated UPDATE from the host's session cannot write another member's lesson_journeys row, and
-- must not be made to (RLS here is correct and untouched). A SECURITY DEFINER trigger is the
-- narrowly-scoped, already-established way this schema handles exactly this shape of problem
-- (see testimonies_before_insert, protect_lesson_ownership).

create or replace function public.sync_journey_on_experience_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lesson_id uuid;
begin
  -- Transition guard: only fires on the actual not_started -> completed change, never on a
  -- repeated save of the same value (idempotent by construction -- a retried action or duplicate
  -- page load that re-submits completion_status='completed' is a no-op here).
  if new.completion_status <> 'completed' or old.completion_status is not distinct from 'completed' then
    return new;
  end if;

  for v_lesson_id in
    select cel.lesson_id
    from public.church_experience_lessons cel
    join public.church_experience_occurrences o on o.experience_id = cel.experience_id
    where o.id = new.occurrence_id
      and cel.relationship = 'required'
  loop
    -- Doubly idempotent: only ever advances a journey sitting exactly at 'experienced' with a
    -- real studied completion already on record -- re-running this (e.g. if the same completion
    -- somehow re-fired) finds current_stage already 'applied' and matches nothing.
    update public.lesson_journeys
    set current_stage = 'applied'
    where user_id = new.profile_id
      and lesson_id = v_lesson_id
      and current_stage = 'experienced'
      and studied_completed_at is not null;
  end loop;

  return new;
end;
$$;

revoke all on function public.sync_journey_on_experience_completion() from public;

create trigger sync_journey_on_experience_completion_trigger
  after update on public.church_experience_registrations
  for each row execute function public.sync_journey_on_experience_completion();

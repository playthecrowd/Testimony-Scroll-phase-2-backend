-- Repair Batch 3, D22 (Trello Hv90Iye0): "First Lesson Completed" badge (and its Points/XP) never
-- awarded despite genuinely completing a lesson's Studied stage -- confirmed live during QA
-- (Studied-stage completion itself persisted correctly; only the reward trigger never fired).
--
-- ROOT CAUSE: award_progression_on_lesson_studied() (0033_progression_award_rpcs.sql) fires only
-- when lesson_journeys.current_stage transitions INTO 'studied'. But per 0008_lesson_journeys.sql,
-- a journey row is created ALREADY at current_stage = 'studied' ("A journey is only ever created
-- already at 'studied' in this milestone"), and markStudiedComplete() (services/supabase/journeys.ts)
-- moves current_stage FORWARD, to 'experienced', on completion. So new.current_stage is always
-- 'experienced' on the real completion event, never 'studied' -- new.current_stage <> 'studied' is
-- always true, and the trigger returns before ever calling private.award_progression_event.
--
-- FIX: use studied_completed_at's null -> non-null transition instead, exactly the signal already
-- used correctly elsewhere on this same table for the identical "lesson studied" concept --
-- testimonies_before_insert (0018_testimonies.sql) and church_experience_journey_sync (0026) both
-- already check `studied_completed_at is not null` rather than current_stage. This migration makes
-- the progression trigger consistent with that established, already-correct pattern instead of
-- inventing a new one.
--
-- No schema change, no data change: `create or replace function` redefines the trigger's body only.
-- The trigger itself (award_progression_on_lesson_studied_trigger) already fires `after update on
-- lesson_journeys for each row` and does not need to be re-created, only the function it calls.
--
-- NOT RETROACTIVE: a redefined trigger only affects future row events. Any member (including QA
-- accounts) who completed a Studied stage before this migration applies will NOT retroactively
-- receive the badge/points from this change alone -- that would require a one-time backfill, which
-- is a data write requiring its own separate explicit approval and is deliberately NOT included
-- here.
create or replace function public.award_progression_on_lesson_studied()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.studied_completed_at is null or old.studied_completed_at is not null then
    return new;
  end if;
  perform private.award_progression_event(new.user_id, 'lesson_studied', new.id, new.lesson_id, null, null);
  return new;
end;
$$;

revoke all on function public.award_progression_on_lesson_studied() from public;

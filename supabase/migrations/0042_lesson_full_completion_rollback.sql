-- Emergency rollback for 0042_lesson_full_completion.sql. Run this ONLY if 0042 needs to be
-- reversed after being applied -- not a routine or "just in case" operation.
--
-- WHAT THIS RESTORES (schema/behavior, going forward): removes lesson_journeys.completed_at, drops
-- the lesson_journeys_compute_completion trigger and compute_lesson_journey_completion function,
-- drops lesson_journey_items_item_key_check, and restores sync_journey_on_experience_completion to
-- its exact pre-0042 body (0026_church_experience_journey_sync.sql, reproduced verbatim below --
-- the "any ONE required Experience satisfied" trigger, including that version's own bug). After
-- this runs, the schema and live behavior are byte-identical to the moment before
-- 0042_lesson_full_completion.sql was ever applied. The pre-existing
-- sync_journey_on_experience_completion_trigger (AFTER UPDATE on church_experience_registrations)
-- is untouched throughout -- 0042 only ever replaced that function's body, never the trigger
-- definition, so there is nothing to drop or recreate on that side.
--
-- WHAT THIS DOES NOT AND CANNOT RESTORE (data, already written): this is the disclosure that
-- matters most before running this file.
--   1. Every lesson_journeys.completed_at value 0042 ever computed -- whether by the live trigger
--      on a real completion, or by 0042's own one-time Step A/B backfill -- is deleted outright by
--      DROP COLUMN. There is no shadow copy. If you re-apply 0042_lesson_full_completion.sql later,
--      its backfill (Step A/B) will re-derive completed_at for every row that still qualifies at
--      that later time, using the SAME logic -- but a value that was earned and then lost to a
--      member no longer registering as "required-satisfied" by the time you re-apply (e.g. a host
--      un-marked an Experience registration in between) would NOT be recomputed identically, since
--      Step A/B only look at current state, not history.
--   2. 0042's Step 0 historical correction (normalizing an unjustified legacy current_stage =
--      'applied' row back to 'experienced') is a normal DATA UPDATE, not a schema change -- this
--      rollback does not and will not attempt to reverse it. Doing so would mean deliberately
--      writing back a value that Step 0 proved was NOT earned under either the old or the new
--      logic, which is not a sensible "rollback" goal, it is reintroducing a known bug's output.
--      If you need the exact pre-0042 current_stage values for audit purposes, recover them from a
--      database backup/PITR taken before 0042 was applied -- not from this file.
--   3. Any current_stage advancement that happened via the NEW (all-required) trigger logic while
--      0042 was live -- which may differ from what the OLD (any-one-required) trigger in this
--      rollback would have produced for the same events -- is not reverted. Once this rollback
--      restores the old trigger body, it only governs NEW writes going forward; it does not replay
--      history.
--
-- In short: this rollback is safe to run for reversing the SCHEMA and going back to the OLD live
-- behavior, but it is a data-loss operation for completed_at and it does not un-write Step 0's
-- corrections. Confirm you have a recent backup/PITR point before applying this to a database with
-- real member data, if preserving the exact pre-rollback historical values matters to you.
--
-- Wrapped in an explicit transaction, matching every other file in this package.

begin;

drop trigger if exists lesson_journeys_compute_completion on public.lesson_journeys;
drop function if exists public.compute_lesson_journey_completion();

alter table public.lesson_journey_items drop constraint if exists lesson_journey_items_item_key_check;

alter table public.lesson_journeys drop column if exists completed_at;

-- Restored verbatim from 0026_church_experience_journey_sync.sql -- the pre-0042 body, including
-- that version's "any ONE required Experience satisfied" behavior. See disclosure item 3 above.
create or replace function public.sync_journey_on_experience_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lesson_id uuid;
begin
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

notify pgrst, 'reload schema';

commit;

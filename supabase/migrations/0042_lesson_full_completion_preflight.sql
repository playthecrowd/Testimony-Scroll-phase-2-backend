-- Preflight report for 0042_lesson_full_completion.sql. READ-ONLY -- no INSERT, UPDATE, DELETE,
-- ALTER, or DDL of any kind. Safe to run any number of times, against production, before applying
-- the migration. Nothing here is destructive and nothing here needs to run inside a transaction.
--
-- Purpose: surface, in one consolidated operator-readable report, everything the migration's own
-- header says to check first -- specifically, whether the new lesson_journey_items.item_key CHECK
-- constraint will fail against existing data (which would abort the whole migration transaction,
-- per its own header), how many rows Step 0/A/B will touch and in what direction, and a handful of
-- sanity checks confirming assumptions the migration and its acceptance test both rely on (the
-- uniqueness constraints on lesson_journeys/lesson_journey_items are exactly as strict as
-- documented, and lesson_journeys.completed_at / the item_key constraint do not already exist).
--
-- Run this in the Supabase SQL Editor and read the NOTICE output (the "Messages" panel, not the
-- result grid -- every line below is a RAISE NOTICE, not a SELECT result set). A single DO block is
-- used deliberately so the whole report prints together in one place, in a fixed order, instead of
-- ten separate result grids that would need to be individually opened and compared.
--
-- This file makes no pass/fail determination on its own -- it reports facts. The one line that
-- matters most is section 3 (item_key vocabulary check): if it reports any row, the migration WILL
-- abort when you run it, and you must resolve those rows (correct or remove them) before proceeding.
-- Everything else is informational context for reviewing the migration's expected effect size.

do $$
declare
  v_journeys_total bigint;
  v_items_total bigint;
  v_completed_at_exists boolean;
  v_item_key_constraint_exists boolean;
  v_stage_row record;
  v_bad_item_keys bigint;
  v_applied_no_studied bigint;
  v_dup_journeys bigint;
  v_dup_items bigint;
  v_step0_will_correct bigint;
  v_step0_will_preserve bigint;
  v_stepA_will_set bigint;
  v_stepB_will_set bigint;
begin
  raise notice '=================================================================';
  raise notice '0042_lesson_full_completion -- PREFLIGHT REPORT (read-only, % )', now();
  raise notice '=================================================================';

  -- ---------------------------------------------------------------------------
  -- 1. Baseline row counts
  -- ---------------------------------------------------------------------------
  select count(*) into v_journeys_total from public.lesson_journeys;
  select count(*) into v_items_total from public.lesson_journey_items;
  raise notice '';
  raise notice '-- Section 1: baseline row counts --';
  raise notice 'lesson_journeys total rows:      %', v_journeys_total;
  raise notice 'lesson_journey_items total rows: %', v_items_total;

  -- ---------------------------------------------------------------------------
  -- 2. Pre-existing-object checks -- confirm the migration's additive DDL has not already been
  -- applied (both statements are one-run-only and will error with "already exists" otherwise, per
  -- the migration's own header; this section lets you confirm that BEFORE hitting the error live).
  -- ---------------------------------------------------------------------------
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'lesson_journeys' and column_name = 'completed_at'
  ) into v_completed_at_exists;

  select exists (
    select 1 from pg_constraint
    where conname = 'lesson_journey_items_item_key_check'
  ) into v_item_key_constraint_exists;

  raise notice '';
  raise notice '-- Section 2: pre-existing-object checks --';
  raise notice 'lesson_journeys.completed_at already exists: % (expected false; if true, this migration has already run)', v_completed_at_exists;
  raise notice 'lesson_journey_items_item_key_check already exists: % (expected false; if true, this migration has already run)', v_item_key_constraint_exists;

  -- ---------------------------------------------------------------------------
  -- 3. item_key vocabulary check -- THE gate for whether the migration's CHECK constraint addition
  -- will succeed. If v_bad_item_keys > 0, the migration's transaction will abort on that ALTER TABLE
  -- statement and nothing in the file will apply (transactional safety, not a partial-apply risk --
  -- but you should still resolve this first rather than relying on the abort as a safety net).
  -- ---------------------------------------------------------------------------
  select count(*) into v_bad_item_keys
  from public.lesson_journey_items
  where item_key not in (
    'overview', 'primary_scripture', 'supporting_scriptures', 'notes',
    'video', 'audio', 'slides', 'document', 'questions'
  );

  raise notice '';
  raise notice '-- Section 3: item_key vocabulary check (blocks the migration if nonzero) --';
  raise notice 'lesson_journey_items rows with an item_key OUTSIDE the 9-key vocabulary: %', v_bad_item_keys;
  if v_bad_item_keys > 0 then
    raise notice 'ACTION REQUIRED: run `select distinct item_key from public.lesson_journey_items where item_key not in (''overview'',''primary_scripture'',''supporting_scriptures'',''notes'',''video'',''audio'',''slides'',''document'',''questions'');` to see the offending values before applying the migration.';
  end if;

  -- ---------------------------------------------------------------------------
  -- 4. current_stage histogram
  -- ---------------------------------------------------------------------------
  raise notice '';
  raise notice '-- Section 4: current_stage histogram --';
  for v_stage_row in
    select current_stage, count(*) as n
    from public.lesson_journeys
    group by current_stage
    order by current_stage
  loop
    raise notice '  % : %', rpad(v_stage_row.current_stage, 14), v_stage_row.n;
  end loop;

  -- ---------------------------------------------------------------------------
  -- 5. Anomaly check -- current_stage = 'applied' without studied_completed_at set. Should always
  -- be zero (the OLD pre-migration trigger only ever advanced to 'applied' from 'experienced' with
  -- studied_completed_at already non-null), but this is a direct, cheap check of that assumption
  -- rather than trusting it silently. This migration does not specifically special-case this
  -- anomaly if it exists (Step 0's correction and Part B's live derivation both treat a null
  -- studied_completed_at as "nothing to derive yet" and would push such a row toward 'experienced'
  -- with no further advancement until Study is completed).
  -- ---------------------------------------------------------------------------
  select count(*) into v_applied_no_studied
  from public.lesson_journeys
  where current_stage = 'applied' and studied_completed_at is null;

  raise notice '';
  raise notice '-- Section 5: anomaly check --';
  raise notice 'rows with current_stage = ''applied'' but studied_completed_at IS NULL (expected 0): %', v_applied_no_studied;

  -- ---------------------------------------------------------------------------
  -- 6. Duplicate-row sanity checks -- both should already be structurally impossible via existing
  -- unique constraints (0008_lesson_journeys.sql: unique(user_id, lesson_id) and
  -- unique(journey_id, item_key)). Included as a direct confirmation, not a new safeguard.
  -- ---------------------------------------------------------------------------
  select count(*) into v_dup_journeys
  from (
    select user_id, lesson_id from public.lesson_journeys group by user_id, lesson_id having count(*) > 1
  ) d;

  select count(*) into v_dup_items
  from (
    select journey_id, item_key from public.lesson_journey_items group by journey_id, item_key having count(*) > 1
  ) d;

  raise notice '';
  raise notice '-- Section 6: duplicate-row sanity checks (expected 0 for both -- already DB-enforced) --';
  raise notice 'duplicate (user_id, lesson_id) groups in lesson_journeys: %', v_dup_journeys;
  raise notice 'duplicate (journey_id, item_key) groups in lesson_journey_items: %', v_dup_items;

  -- ---------------------------------------------------------------------------
  -- 7. Preview: Step 0 historical current_stage correction. Mirrors the migration's own Step 0
  -- predicate exactly.
  -- ---------------------------------------------------------------------------
  select count(*) into v_step0_will_correct
  from public.lesson_journeys lj
  where lj.current_stage = 'applied'
    and not (
      exists (
        select 1 from public.church_experience_lessons cel
        where cel.lesson_id = lj.lesson_id and cel.relationship = 'required'
      )
      and not exists (
        select 1
        from public.church_experience_lessons required_link
        where required_link.lesson_id = lj.lesson_id
          and required_link.relationship = 'required'
          and not exists (
            select 1
            from public.church_experience_occurrences occurrence
            join public.church_experience_registrations registration
              on registration.occurrence_id = occurrence.id
            where occurrence.experience_id = required_link.experience_id
              and registration.profile_id = lj.user_id
              and registration.completion_status = 'completed'
          )
      )
    );

  select count(*) into v_step0_will_preserve
  from public.lesson_journeys lj
  where lj.current_stage = 'applied'
    and exists (
      select 1 from public.church_experience_lessons cel
      where cel.lesson_id = lj.lesson_id and cel.relationship = 'required'
    )
    and not exists (
      select 1
      from public.church_experience_lessons required_link
      where required_link.lesson_id = lj.lesson_id
        and required_link.relationship = 'required'
        and not exists (
          select 1
          from public.church_experience_occurrences occurrence
          join public.church_experience_registrations registration
            on registration.occurrence_id = occurrence.id
          where occurrence.experience_id = required_link.experience_id
            and registration.profile_id = lj.user_id
            and registration.completion_status = 'completed'
        )
    );

  raise notice '';
  raise notice '-- Section 7: Step 0 preview (historical current_stage=''applied'' correction) --';
  raise notice 'rows currently ''applied'' that Step 0 WILL correct to ''experienced'' (unjustified legacy state): %', v_step0_will_correct;
  raise notice 'rows currently ''applied'' that Step 0 WILL leave untouched (genuinely justified): %', v_step0_will_preserve;

  -- ---------------------------------------------------------------------------
  -- 8. Preview: Steps A/B completed_at backfill.
  -- ---------------------------------------------------------------------------
  select count(*) into v_stepA_will_set
  from public.lesson_journeys lj
  where lj.studied_completed_at is not null
    and not exists (
      select 1 from public.church_experience_lessons cel
      where cel.lesson_id = lj.lesson_id and cel.relationship = 'required'
    );

  select count(*) into v_stepB_will_set
  from public.lesson_journeys lj
  where lj.studied_completed_at is not null
    and exists (
      select 1 from public.church_experience_lessons cel
      where cel.lesson_id = lj.lesson_id and cel.relationship = 'required'
    )
    and not exists (
      select 1
      from public.church_experience_lessons required_link
      where required_link.lesson_id = lj.lesson_id
        and required_link.relationship = 'required'
        and not exists (
          select 1
          from public.church_experience_occurrences occurrence
          join public.church_experience_registrations registration
            on registration.occurrence_id = occurrence.id
          where occurrence.experience_id = required_link.experience_id
            and registration.profile_id = lj.user_id
            and registration.completion_status = 'completed'
        )
    );

  raise notice '';
  raise notice '-- Section 8: Steps A/B preview (completed_at backfill) --';
  raise notice 'rows Step A will backfill (no required Experience, completed_at := studied_completed_at): %', v_stepA_will_set;
  raise notice 'rows Step B will backfill (required Experience satisfied, completed_at := now(), current_stage := ''applied''): %', v_stepB_will_set;
  raise notice 'total rows expected to have completed_at set immediately after migration: %', v_stepA_will_set + v_stepB_will_set;

  raise notice '';
  raise notice '=================================================================';
  raise notice 'END OF PREFLIGHT REPORT';
  if v_bad_item_keys > 0 or v_completed_at_exists or v_item_key_constraint_exists then
    raise notice 'STATUS: BLOCKED -- resolve the flagged item(s) above before applying the migration.';
  else
    raise notice 'STATUS: no blocking conditions detected. Review sections 4-8 for expected effect size, then proceed to the migration file.';
  end if;
  raise notice '=================================================================';
end;
$$;

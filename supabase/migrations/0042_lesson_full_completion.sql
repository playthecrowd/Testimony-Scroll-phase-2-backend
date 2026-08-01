-- Phase 10A groundwork: a server-authoritative, immutable "this learner fully completed this
-- lesson" record, distinct from lesson_journeys.current_stage's existing 5-value vocabulary
-- (captured/studied/experienced/applied/added-to-story). 'added-to-story' remains unreachable by
-- design and is never written by anything in this migration. studied_completed_at, current_stage,
-- and completed_at are all fully server-derived and immutable, computed from one shared predicate,
-- instead of trusting whatever a caller (client or another trigger) supplies for any of the three.
--
-- Completion predicate: Study complete AND every distinct required-linked Experience
-- (church_experience_lessons.relationship = 'required') satisfied for that learner. A lesson with
-- zero required links is vacuously satisfied on that side for completed_at's purposes. current_stage
-- is more specific: it only advances to 'applied' when a required Experience genuinely exists and
-- is fully satisfied -- a lesson with no required Experience has nothing to "apply", so current_stage
-- caps at 'experienced' for it, exactly matching this table's pre-existing behavior for that case
-- (nothing has ever advanced such a journey past 'experienced'). This is a deliberate split, not an
-- oversight -- an earlier draft of this migration incorrectly let completed_at's vacuous-truth case
-- also drive current_stage to 'applied', which would have been a real, undisclosed change to
-- current_stage's existing UI meaning; caught during review before being applied. 'recommended'
-- links never gate anything (same v1 choice 0026_church_experience_journey_sync.sql established).
-- Both completion orders are handled.
--
-- Security audit performed before this revision (full findings in the accompanying report, not
-- repeated in full here):
--   - studied_completed_at, current_stage, AND completed_at are all forgeable via direct REST
--     today -- lesson_journeys' table-level `grant ... update ... to authenticated` (0008) is not
--     column-scoped, and lesson_journeys_update_own RLS only checks row ownership. All three are
--     protected identically: any client-supplied value is discarded before evaluation, and each
--     can only become non-default via this migration's own server-side derivation.
--   - lesson_journey_items (the checklist records studied_completed_at's derivation depends on) has
--     no delete grant (delete is already impossible) and a unique(journey_id, item_key) constraint
--     (duplicates are already impossible), but had no item_key vocabulary constraint -- added below.
--   - Every one of the 9 checklist keys, including 'questions', is learner-attested with no
--     independently verifiable backing record in this schema (no video-watch telemetry, no real
--     per-learner answer-submission/grading table). This migration proves "the row's rightful
--     owner marked every applicable item complete, exactly once, no fabricated extras counted" --
--     it does NOT and cannot prove genuine reading/viewing/listening or correct question
--     completion. Building that is a real, separate future security/progression enhancement
--     (video telemetry, real answer grading), explicitly out of scope for this migration.
--   - Historical-stage correction (new in this revision): a prior revision of this migration left
--     one gap explicitly disclosed-but-unfixed -- pre-existing rows where current_stage was already
--     'applied', written by the OLD pre-migration 0026 trigger bug (which advanced on ANY ONE
--     required-linked Experience being satisfied, not ALL of them). Section 2b's Step 0 below now
--     corrects this. Also new in this revision: Step 0, Step A, and Step B (Section 2b) all run
--     BEFORE the protection trigger is created (Section 2b's own tail, after all three data
--     updates) -- an earlier draft placed them after CREATE TRIGGER, which is a real bug, not a
--     style choice: that trigger discards any UPDATE-supplied change to current_stage/completed_at
--     that differs from the row's prior stored value, so it would have silently canceled every one
--     of these backfill writes, including its own. Running them first, against a table with no
--     trigger yet attached, avoids that self-cancellation entirely -- any 'applied' row that does
--     not meet the SAME all-required predicate this migration's own trigger enforces going forward
--     is reset to 'experienced' (the correct terminal stage for it); any 'applied' row that IS
--     genuinely justified (a real required Experience link exists and every one is satisfied) is
--     left untouched. This never regresses a row that was already correct, and never invents
--     completed_at for a row that doesn't earn it.
--
-- current_stage's INSERT default ('studied', not 'captured') matches the pre-existing column
-- default and pre-existing getOrCreateJourney() insert code exactly (services/supabase/journeys.ts
-- never specifies current_stage; 0008_lesson_journeys.sql's own header states "a journey is only
-- ever created already at 'studied' in this milestone... there is no separate 'Captured' member
-- action to perform") -- this migration does not change that, only defensively enforces it.
--
-- One-run-only, like every other migration in this history: add column/add constraint both fail
-- cleanly ("already exists") on a second run rather than silently no-opping or corrupting data. If
-- you need to re-run after a partial failure, run the rollback SQL first, then re-run from a clean
-- state.
--
-- Wrapped in an explicit transaction: if the item_key CHECK constraint below fails validation
-- against unexpected existing data, the ENTIRE migration aborts, nothing partial is applied, and
-- nothing is deleted or rewritten. Run the preflight query in the accompanying report first to
-- confirm this won't happen before executing this file.

begin;

-- ---------------------------------------------------------------------------
-- 0. lesson_journey_items.item_key vocabulary -- closes the "fabricated item key" gap. Does not
-- change the completion predicate's correctness (it already only ever reads the fixed, real
-- required_keys list derived from actual lesson content, so an unrecognized key was already inert
-- to it) but removes the ability to write nonsense keys at all, for data hygiene. Fails the whole
-- transaction if any existing row already violates it -- see header.
-- ---------------------------------------------------------------------------

alter table public.lesson_journey_items
  add constraint lesson_journey_items_item_key_check
  check (item_key in (
    'overview', 'primary_scripture', 'supporting_scriptures', 'notes',
    'video', 'audio', 'slides', 'document', 'questions'
  ));

-- ---------------------------------------------------------------------------
-- 1. lesson_journeys.completed_at
-- ---------------------------------------------------------------------------

alter table public.lesson_journeys add column completed_at timestamptz;

comment on column public.lesson_journeys.completed_at is
  'Server-computed, immutable full-lesson-completion timestamp (Study + every required-linked '
  'Experience) -- distinct from current_stage and from studied_completed_at (Study-only). Set '
  'exactly once, only by compute_lesson_journey_completion. Never cleared or changed once set.';

-- ---------------------------------------------------------------------------
-- 2. compute_lesson_journey_completion -- fires on every insert/update of a learner's own journey
-- row. ALL THREE of studied_completed_at, current_stage, and completed_at are protected and
-- derived here, in one function, in this order, so each part can trust the one before it within
-- the same statement -- Postgres fires multiple BEFORE triggers on one table/event in alphabetical
-- order by trigger name, which would be an easy-to-break implicit dependency if these were split
-- across separate triggers.
--
-- Part A -- studied_completed_at: any client-supplied value is discarded (INSERT: unconditionally;
-- UPDATE: restored to the prior stored value) before evaluation. The only way it can become
-- non-null is this function independently re-deriving, from public.lessons/lesson_media and
-- lesson_journey_items (the real per-item completion records), the same "which checklist items
-- are applicable to this lesson's actual content" logic lib/journeyChecklist.ts's
-- getApplicableChecklistItems() implements client-side, and confirming every applicable item has a
-- completed=true row for THIS journey specifically. No RPC needed -- this protects the column
-- regardless of entry point and requires zero changes to markStudiedComplete().
--
-- Part B -- current_stage and completed_at. v_all_required_satisfied (vacuously true when no
-- required Experience exists) gates completed_at -- Study alone is full completion when there is
-- nothing else to complete. v_has_required_experience additionally gates current_stage's
-- 'applied' value specifically -- a lesson with no required Experience has nothing to "apply", so
-- current_stage caps at 'experienced' for it even though completed_at is set; current_stage only
-- reaches 'applied' when a required Experience genuinely exists and is satisfied. Both booleans
-- are computed once and reused, not two independently-written predicates that could disagree.
-- current_stage is forward-only (never regresses once 'applied') and 'added-to-story' is never
-- written here (still unreachable by design). Any client-supplied current_stage/completed_at
-- change is discarded before this derivation runs, on both insert and update. INSERT forces
-- current_stage to 'studied', matching the pre-existing column default exactly (see header).
-- ---------------------------------------------------------------------------

create or replace function public.compute_lesson_journey_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempted_study_completion boolean;
  v_about_text text;
  v_primary_scripture text;
  v_supporting_scriptures text[];
  v_has_required_experience boolean;
  v_all_required_satisfied boolean;
begin
  -- ---- Part A: studied_completed_at ----

  if tg_op = 'INSERT' then
    v_attempted_study_completion := new.studied_completed_at is not null;
    new.studied_completed_at := null;
  elsif tg_op = 'UPDATE' then
    v_attempted_study_completion := new.studied_completed_at is not null and old.studied_completed_at is null;
    if new.studied_completed_at is distinct from old.studied_completed_at then
      new.studied_completed_at := old.studied_completed_at;
    end if;
  else
    v_attempted_study_completion := false;
  end if;

  if v_attempted_study_completion and new.studied_completed_at is null then
    select l.about_text, l.primary_scripture, l.supporting_scriptures
    into v_about_text, v_primary_scripture, v_supporting_scriptures
    from public.lessons l
    where l.id = new.lesson_id;

    -- Mirrors lib/journeyChecklist.ts's getApplicableChecklistItems() exactly. Every applicable
    -- key must have a completed = true lesson_journey_items row for THIS journey. This proves
    -- ownership-verified self-attestation of every applicable item, not genuine content
    -- engagement -- see this migration's header for why that distinction is disclosed, not hidden.
    if not exists (
      select required_key
      from (
        select 'overview'::text as required_key where btrim(coalesce(v_about_text, '')) <> ''
        union all
        select 'primary_scripture' where btrim(coalesce(v_primary_scripture, '')) <> ''
        union all
        select 'supporting_scriptures' where coalesce(array_length(v_supporting_scriptures, 1), 0) > 0
        union all
        select 'notes' where exists (
          select 1 from public.lesson_media lm where lm.lesson_id = new.lesson_id and lm.media_type = 'notes'
        )
        union all
        select 'video' where exists (
          select 1 from public.lesson_media lm where lm.lesson_id = new.lesson_id and lm.media_type = 'video'
        )
        union all
        select 'audio' where exists (
          select 1 from public.lesson_media lm where lm.lesson_id = new.lesson_id and lm.media_type = 'audio'
        )
        union all
        select 'slides' where exists (
          select 1 from public.lesson_media lm where lm.lesson_id = new.lesson_id and lm.media_type = 'slides'
        )
        union all
        select 'document' where exists (
          select 1 from public.lesson_media lm where lm.lesson_id = new.lesson_id and lm.media_type = 'document'
        )
        union all
        select 'questions'
      ) required_keys
      where not exists (
        select 1
        from public.lesson_journey_items lji
        where lji.journey_id = new.id
          and lji.item_key = required_keys.required_key
          and lji.completed = true
      )
    ) then
      new.studied_completed_at := now();
    end if;
  end if;

  -- ---- Part B: current_stage and completed_at ----

  if tg_op = 'INSERT' then
    new.current_stage := 'studied';
  elsif tg_op = 'UPDATE' and new.current_stage is distinct from old.current_stage then
    new.current_stage := old.current_stage;
  end if;

  if tg_op = 'INSERT' then
    new.completed_at := null;
  elsif tg_op = 'UPDATE' and new.completed_at is distinct from old.completed_at then
    new.completed_at := old.completed_at;
  end if;

  if new.studied_completed_at is null then
    return new; -- nothing further can be derived yet
  end if;

  if new.current_stage = 'added-to-story' then
    return new; -- never touched or regressed by this function
  end if;

  select exists (
    select 1
    from public.church_experience_lessons required_link
    where required_link.lesson_id = new.lesson_id
      and required_link.relationship = 'required'
  ) into v_has_required_experience;

  select not exists (
    select 1
    from public.church_experience_lessons required_link
    where required_link.lesson_id = new.lesson_id
      and required_link.relationship = 'required'
      and not exists (
        select 1
        from public.church_experience_occurrences occurrence
        join public.church_experience_registrations registration
          on registration.occurrence_id = occurrence.id
        where occurrence.experience_id = required_link.experience_id
          and registration.profile_id = new.user_id
          and registration.completion_status = 'completed'
      )
  ) into v_all_required_satisfied;

  -- current_stage: 'applied' only when a required Experience genuinely exists AND is fully
  -- satisfied -- a lesson with none has nothing to "apply", so it caps at 'experienced', exactly
  -- matching this table's pre-existing behavior for that case.
  if v_has_required_experience and v_all_required_satisfied then
    new.current_stage := 'applied';
  elsif new.current_stage <> 'applied' then
    new.current_stage := 'experienced'; -- forward-only: never regresses out of 'applied'
  end if;

  -- completed_at: Study alone is full completion when there is no required Experience at all
  -- (v_all_required_satisfied is vacuously true in that case).
  if new.completed_at is null and v_all_required_satisfied then
    new.completed_at := now();
  end if;

  return new;
end;
$$;

revoke all on function public.compute_lesson_journey_completion() from public;

-- ---------------------------------------------------------------------------
-- 2b. One-time historical correction and completion backfill. ALL THREE data updates MUST run
-- before the protection trigger is created. Once enabled, that trigger intentionally rejects
-- outside changes to current_stage and completed_at, so placing any of these updates after
-- CREATE TRIGGER would cancel the migration's own writes.
-- A justified applied row has at least one required Experience and every required Experience is
-- satisfied by this learner. Everything else is legacy output from the old any-one-required
-- trigger and is normalized to experienced. added-to-story rows are never selected.
-- ---------------------------------------------------------------------------

update public.lesson_journeys lj
set current_stage = 'experienced'
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

-- Step A: no required Experience. Study completion is the exact historical full-completion time.
update public.lesson_journeys lj
set completed_at = lj.studied_completed_at
where lj.completed_at is null
  and lj.studied_completed_at is not null
  and not exists (
    select 1 from public.church_experience_lessons cel
    where cel.lesson_id = lj.lesson_id and cel.relationship = 'required'
  );

-- Step B: at least one required Experience and every required Experience is currently satisfied.
-- No completion-specific historical timestamp exists, so now() means confirmed as of migration.
update public.lesson_journeys lj
set completed_at = now(),
    current_stage = 'applied'
where lj.completed_at is null
  and lj.studied_completed_at is not null
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

drop trigger if exists lesson_journeys_compute_completion on public.lesson_journeys;
create trigger lesson_journeys_compute_completion
  before insert or update on public.lesson_journeys
  for each row execute function public.compute_lesson_journey_completion();

-- ---------------------------------------------------------------------------
-- 3. sync_journey_on_experience_completion (0026) simplified: current_stage/completed_at
-- derivation lives entirely in compute_lesson_journey_completion above, which re-fires on this
-- function's own UPDATE (any write to lesson_journeys re-invokes it) and independently
-- re-evaluates the shared predicates from fresh church_experience_registrations data. Writing
-- current_stage/completed_at here too would be redundant and risk two independently-maintained
-- copies of the same predicate drifting apart -- so this function's only remaining job is
-- identifying which journey row needs re-evaluation and touching it (a genuine no-op SET that
-- still fires the BEFORE trigger). Every other line is otherwise unchanged from
-- 0026_church_experience_journey_sync.sql.
-- ---------------------------------------------------------------------------

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
    set last_opened_at = last_opened_at
    where user_id = new.profile_id
      and lesson_id = v_lesson_id
      and current_stage = 'experienced'
      and studied_completed_at is not null;
  end loop;

  return new;
end;
$$;

revoke all on function public.sync_journey_on_experience_completion() from public;

-- ---------------------------------------------------------------------------
-- 4. Historical correction/backfill notes. The actual Step 0/A/B statements ran in Section 2b,
-- before the protection trigger was enabled. They are documented here beside the live sync logic
-- only for migration-review readability; there are intentionally no UPDATE statements below.
--
-- Step A (no required Experience): studied_completed_at IS the exact, verifiable moment the
-- (only) required condition became true -- used directly, not approximated. current_stage is left
-- untouched -- it is already 'experienced' (set by markStudiedComplete()) and, per this migration's
-- corrected logic, 'experienced' IS the correct terminal current_stage for a lesson with no
-- required Experience -- there is nothing stale to fix here.
--
-- Step B (has required Experience(s), all now satisfied): church_experience_registrations has no
-- completion-specific timestamp column, only a generic updated_at maintained by a blanket
-- set_updated_at() trigger that fires on ANY edit to the row -- not a reliable proxy for the true
-- historical completion moment, so it is deliberately NOT used. completed_at for these rows is set
-- to migration execution time (now()) instead, honestly representing "confirmed complete as of
-- this migration," not a reconstructed historical moment. current_stage is set to 'applied' in the
-- SAME statement, matching exactly what the live trigger would derive for these rows -- no
-- inconsistency window.
--
-- Steps A and B use the identical all-required predicate structure as the live trigger and only
-- ever touch rows whose completed_at is currently null.
-- ---------------------------------------------------------------------------

notify pgrst, 'reload schema';

commit;

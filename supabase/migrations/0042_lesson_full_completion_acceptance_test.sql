-- Real, transactional, database-level acceptance test for 0042_lesson_full_completion.sql.
--
-- WHAT THIS IS: 31 enumerated scenarios, each exercised against REAL rows in REAL tables (auth.
-- users, profiles, churches, lessons, lesson_media, church_experiences, church_experience_
-- occurrences, church_experience_lessons, church_experience_registrations, lesson_journeys,
-- lesson_journey_items) through the ACTUAL live triggers this migration installs -- not a
-- source-scan/regex proof like tests/lessonFullCompletion.test.ts (this repo's TypeScript test
-- suite has no live database to run against in the development environment; this file is the
-- live-database complement to that source-scan suite, meant to be run BY HAND, by a human with
-- Supabase SQL Editor access, against a real Postgres instance with 0042_lesson_full_completion.sql
-- already applied).
--
-- WHEN TO RUN: after applying 0042_lesson_full_completion.sql, preferably during a quiet window.
-- This live-safe version never disables triggers or alters production tables. Re-runnable any
-- number of times -- every fixture row this file creates is deliberately rolled
-- back at the end (see the OPERATIONAL NOTE below), so nothing here ever persists.
--
-- FIXTURES: two synthetic learners (auth.users + profiles), one church, a set of lessons with
-- varying content/required-Experience shapes, and a matching set of church_experiences/
-- occurrences/registrations -- all named with a "QA0042" / ".invalid" prefix so they are
-- unmistakably test data if a rollback ever somehow fails to occur. auth.users is Supabase-managed
-- (GoTrue); this file inserts the minimal column set documented for that table's standard schema.
-- If your project's auth.users schema differs, that specific INSERT (Section 1 below) is the
-- single most likely statement to need adjustment -- if it errors, the whole transaction aborts
-- cleanly (see the note below) and nothing else in this file runs; report the exact error back for
-- a targeted fix rather than modifying auth.users columns by guesswork.
--
-- PASS/FAIL: each scenario is checked via pg_temp.qa_assert(condition, label) (defined in Section
-- 0), which RAISE NOTICE 'PASS: ...' on success or RAISE EXCEPTION 'FAIL: ...' on the first
-- failure. A single failure aborts the whole DO block immediately -- there is no "collect all
-- failures and report at the end" behavior, matching this migration's own "abort the whole
-- transaction on any problem" philosophy rather than silently continuing past a broken assumption.
--
-- OPERATIONAL NOTE on the trailing ROLLBACK: this file is BEGIN; ... DO $$ ... $$; ROLLBACK; on
-- purpose -- even a fully passing run discards every fixture row, since none of this is real
-- production data. If any scenario FAILS, the DO block's RAISE EXCEPTION aborts the transaction
-- immediately and some SQL clients (including some configurations of the Supabase SQL Editor) will
-- stop executing the remainder of a multi-statement script after an error, meaning the trailing
-- ROLLBACK; below may not visibly execute. This is not a data-safety problem -- Postgres will not
-- allow an aborted transaction to COMMIT under any circumstance, so no fixture row can leak into
-- real data regardless -- but if you see a FAIL, explicitly run ROLLBACK; yourself (or simply
-- disconnect the SQL Editor session) to close out the aborted transaction before running anything
-- else in that session.
--
-- WHAT THIS FILE DOES NOT DO: it does not call Supabase Auth -- every RLS/grant check runs under
-- direct role/JWT-claim impersonation instead (SET LOCAL ROLE authenticated + set_config('request.
-- jwt.claims', ...) -- the same mechanism auth.uid() reads in production; no real HTTP/JWT
-- round-trip is needed for a genuine, grant-and-RLS-accurate answer). Scenario 23 specifically does
-- this to test lesson_journey_items' effective DELETE/INSERT/UPDATE access -- an earlier revision
-- checked only information_schema.role_table_grants for an absent DELETE grant, which turned out to
-- be wrong on the live database (a DELETE grant IS present despite no migration in this repo's
-- history ever granting it -- see the delivery report). A bare grant check cannot tell you whether
-- RLS actually blocks real access, which is exactly the gap genuine impersonation closes. This file
-- also does not recreate pre-migration rows or rerun the one-time historical normalization: doing
-- that faithfully after migration would require disabling the live protection trigger. Historical
-- normalization is verified by the read-only preflight's predicted count, the migration's ordering
-- (normalization before CREATE TRIGGER), and the post-migration query showing zero unjustified
-- applied rows. RLS enforcement for every OTHER table in this schema is already covered by this
-- repo's existing tests/rlsChurchIsolation.test.ts-style source-scan suite and stays out of scope
-- here -- Scenario 23's impersonation is specifically about the one gap this round's live testing
-- surfaced, not a general RLS audit of every table this file touches.
--
-- POST-MIGRATION VERIFICATION (bottom of this file, after the ROLLBACK; below): a separate,
-- standalone, read-only block -- not part of the transactional fixture test above, and not rolled
-- back -- that queries real (non-fixture) data to confirm the migration's one-time historical
-- correction and backfill actually landed. Run it once, after applying the migration, and compare
-- its output against the preflight's Section 7/8 predictions (see that block's own comment for the
-- exact comparison to make).

begin;

do $$
declare
  -- learners
  v_learner_a uuid := gen_random_uuid();
  v_learner_b uuid := gen_random_uuid();
  v_church uuid := gen_random_uuid();

  -- lessons
  v_lesson_bare uuid := gen_random_uuid();               -- only 'questions' applicable
  v_lesson_second_no_req uuid := gen_random_uuid();       -- only 'questions' applicable, distinct lesson
  v_lesson_full_no_req uuid := gen_random_uuid();         -- all 9 keys applicable, zero required Experience
  v_lesson_one_req uuid := gen_random_uuid();              -- all 9 keys applicable, one required Experience
  v_lesson_two_req uuid := gen_random_uuid();              -- all 9 keys applicable, two required + one recommended
  v_lesson_order_a uuid := gen_random_uuid();              -- Experience-first ordering
  v_lesson_order_b uuid := gen_random_uuid();              -- Study-first ordering
  v_lesson_legacy_unjustified uuid := gen_random_uuid();   -- Step 0 simulation target
  v_lesson_legacy_justified uuid := gen_random_uuid();     -- Step 0 simulation target
  v_lesson_legacy_backfill_a uuid := gen_random_uuid();    -- Step A simulation target
  v_lesson_legacy_backfill_b uuid := gen_random_uuid();    -- Step B simulation target

  -- church_experiences / occurrences (one pair per named use, kept fully isolated per scenario so
  -- no scenario's registration state can accidentally satisfy another scenario's predicate)
  v_experience_a uuid; v_occurrence_a uuid;
  v_experience_b1 uuid; v_occurrence_b1 uuid;
  v_experience_b2 uuid; v_occurrence_b2 uuid;
  v_experience_b3 uuid; v_occurrence_b3 uuid; -- recommended-only, never required
  v_experience_c uuid; v_occurrence_c uuid;
  v_experience_d uuid; v_occurrence_d uuid;
  v_experience_e uuid; v_occurrence_e uuid; -- legacy-unjustified
  v_experience_f uuid; v_occurrence_f uuid; -- legacy-justified
  v_experience_g uuid; v_occurrence_g uuid; -- legacy backfill Step B

  -- journeys
  v_journey_bare uuid;
  v_journey_second_no_req uuid;
  v_journey_full_no_req uuid;
  v_journey_one_req uuid;
  v_journey_two_req uuid;
  v_journey_order_a uuid;
  v_journey_order_b uuid;
  v_journey_legacy_unjustified uuid;
  v_journey_legacy_justified uuid;
  v_journey_legacy_backfill_a uuid;
  v_journey_legacy_backfill_b uuid;
  v_journey_scratch_b uuid; -- learner_b, zero items, dedicated to Scenario 23d

  -- registrations
  v_reg_a uuid; v_reg_b1 uuid; v_reg_b2 uuid; v_reg_b3 uuid; v_reg_c uuid; v_reg_d uuid;
  v_reg_e uuid; v_reg_f uuid; v_reg_g uuid;

  -- scratch
  v_row record;
  v_stage text;
  v_completed_at timestamptz;
  v_studied_at timestamptz;
  v_count bigint;
  v_23_check boolean;
  v_rows_23a bigint;
  v_rows_23b bigint;
  v_rows_23c bigint;
  v_rows_23d bigint;
  v_rows_23e bigint;
  v_rows_23f bigint;
  v_23d_error text;
  v_before timestamptz;
  v_lesson_id uuid;
  v_full_lessons uuid[];
begin
  -- ---------------------------------------------------------------------------
  -- Section 0: assertion helper. pg_temp scopes it to this session only -- it is never visible to
  -- any other connection and is automatically dropped when this session ends, independent of the
  -- transaction's commit/rollback outcome.
  -- ---------------------------------------------------------------------------
  create or replace function pg_temp.qa_assert(p_condition boolean, p_label text)
  returns void
  language plpgsql
  as $fn$
  begin
    if p_condition then
      raise notice 'PASS: %', p_label;
    else
      raise exception 'FAIL: %', p_label;
    end if;
  end;
  $fn$;

  -- ---------------------------------------------------------------------------
  -- Section 1: base fixtures -- learners, church, lessons, media.
  -- ---------------------------------------------------------------------------
  -- raw_user_meta_data carries full_name/account_type so the pre-existing on_auth_user_created ->
  -- handle_new_user() AFTER INSERT trigger (0003_functions.sql: unconditionally inserts into
  -- public.profiles using new.raw_user_meta_data ->> 'full_name' and
  -- coalesce(new.raw_user_meta_data ->> 'account_type', 'member')) creates the matching profiles
  -- row itself, with the exact values this fixture wants. A separate explicit insert into
  -- public.profiles for the same id would violate its primary key here -- handle_new_user() already
  -- creates that row the moment the auth.users insert commits, before any later statement in this
  -- script could run its own insert.
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    is_sso_user, is_anonymous
  ) values
    (v_learner_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'qa-0042-learner-a@example.invalid', 'qa-fixture-not-a-real-password',
     now(), now(), now(), '{}'::jsonb,
     jsonb_build_object('full_name', 'QA0042 Learner A', 'account_type', 'member'),
     false, '', '', '', '', false, false),
    (v_learner_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'qa-0042-learner-b@example.invalid', 'qa-fixture-not-a-real-password',
     now(), now(), now(), '{}'::jsonb,
     jsonb_build_object('full_name', 'QA0042 Learner B', 'account_type', 'member'),
     false, '', '', '', '', false, false);

  insert into public.churches (id, name, slug, status)
  values (v_church, 'QA0042 Fixture Church', 'qa-0042-fixture-church-' || left(v_church::text, 8), 'published');

  insert into public.lessons (id, slug, title, church_id, status, about_text, primary_scripture, supporting_scriptures)
  values
    (v_lesson_bare, 'qa-0042-bare-' || left(v_lesson_bare::text, 8), 'QA0042 Bare Lesson', v_church, 'published', null, null, '{}'),
    (v_lesson_second_no_req, 'qa-0042-second-' || left(v_lesson_second_no_req::text, 8), 'QA0042 Second Bare Lesson', v_church, 'published', null, null, '{}'),
    (v_lesson_full_no_req, 'qa-0042-full-noreq-' || left(v_lesson_full_no_req::text, 8), 'QA0042 Full Content, No Required Experience', v_church, 'published', 'About text.', 'John 3:16', array['Romans 8:28']),
    (v_lesson_one_req, 'qa-0042-one-req-' || left(v_lesson_one_req::text, 8), 'QA0042 Full Content, One Required Experience', v_church, 'published', 'About text.', 'John 3:16', array['Romans 8:28']),
    (v_lesson_two_req, 'qa-0042-two-req-' || left(v_lesson_two_req::text, 8), 'QA0042 Full Content, Two Required Experiences', v_church, 'published', 'About text.', 'John 3:16', array['Romans 8:28']),
    (v_lesson_order_a, 'qa-0042-order-a-' || left(v_lesson_order_a::text, 8), 'QA0042 Order Test A (Experience-first)', v_church, 'published', 'About text.', 'John 3:16', array['Romans 8:28']),
    (v_lesson_order_b, 'qa-0042-order-b-' || left(v_lesson_order_b::text, 8), 'QA0042 Order Test B (Study-first)', v_church, 'published', 'About text.', 'John 3:16', array['Romans 8:28']),
    (v_lesson_legacy_unjustified, 'qa-0042-legacy-unj-' || left(v_lesson_legacy_unjustified::text, 8), 'QA0042 Legacy Unjustified', v_church, 'published', null, null, '{}'),
    (v_lesson_legacy_justified, 'qa-0042-legacy-just-' || left(v_lesson_legacy_justified::text, 8), 'QA0042 Legacy Justified', v_church, 'published', null, null, '{}'),
    (v_lesson_legacy_backfill_a, 'qa-0042-legacy-bfa-' || left(v_lesson_legacy_backfill_a::text, 8), 'QA0042 Legacy Backfill A', v_church, 'published', null, null, '{}'),
    (v_lesson_legacy_backfill_b, 'qa-0042-legacy-bfb-' || left(v_lesson_legacy_backfill_b::text, 8), 'QA0042 Legacy Backfill B', v_church, 'published', null, null, '{}');

  -- Full 9-key checklist media, for every lesson that needs all 9 keys applicable.
  v_full_lessons := array[v_lesson_full_no_req, v_lesson_one_req, v_lesson_two_req, v_lesson_order_a, v_lesson_order_b];
  foreach v_lesson_id in array v_full_lessons loop
    insert into public.lesson_media (lesson_id, media_type)
    values (v_lesson_id, 'notes'), (v_lesson_id, 'video'), (v_lesson_id, 'audio'), (v_lesson_id, 'slides'), (v_lesson_id, 'document');
  end loop;

  -- ---------------------------------------------------------------------------
  -- Section 2: church_experiences / occurrences (one dedicated pair per use).
  -- ---------------------------------------------------------------------------
  insert into public.church_experiences (church_id, title, type, format, status) values (v_church, 'QA0042-A', 'bible_study', 'self_guided', 'published') returning id into v_experience_a;
  insert into public.church_experiences (church_id, title, type, format, status) values (v_church, 'QA0042-B1', 'bible_study', 'self_guided', 'published') returning id into v_experience_b1;
  insert into public.church_experiences (church_id, title, type, format, status) values (v_church, 'QA0042-B2', 'bible_study', 'self_guided', 'published') returning id into v_experience_b2;
  insert into public.church_experiences (church_id, title, type, format, status) values (v_church, 'QA0042-B3', 'bible_study', 'self_guided', 'published') returning id into v_experience_b3;
  insert into public.church_experiences (church_id, title, type, format, status) values (v_church, 'QA0042-C', 'bible_study', 'self_guided', 'published') returning id into v_experience_c;
  insert into public.church_experiences (church_id, title, type, format, status) values (v_church, 'QA0042-D', 'bible_study', 'self_guided', 'published') returning id into v_experience_d;
  insert into public.church_experiences (church_id, title, type, format, status) values (v_church, 'QA0042-E', 'bible_study', 'self_guided', 'published') returning id into v_experience_e;
  insert into public.church_experiences (church_id, title, type, format, status) values (v_church, 'QA0042-F', 'bible_study', 'self_guided', 'published') returning id into v_experience_f;
  insert into public.church_experiences (church_id, title, type, format, status) values (v_church, 'QA0042-G', 'bible_study', 'self_guided', 'published') returning id into v_experience_g;

  insert into public.church_experience_occurrences (experience_id, church_id, starts_at, timezone) values (v_experience_a, v_church, now(), 'America/Chicago') returning id into v_occurrence_a;
  insert into public.church_experience_occurrences (experience_id, church_id, starts_at, timezone) values (v_experience_b1, v_church, now(), 'America/Chicago') returning id into v_occurrence_b1;
  insert into public.church_experience_occurrences (experience_id, church_id, starts_at, timezone) values (v_experience_b2, v_church, now(), 'America/Chicago') returning id into v_occurrence_b2;
  insert into public.church_experience_occurrences (experience_id, church_id, starts_at, timezone) values (v_experience_b3, v_church, now(), 'America/Chicago') returning id into v_occurrence_b3;
  insert into public.church_experience_occurrences (experience_id, church_id, starts_at, timezone) values (v_experience_c, v_church, now(), 'America/Chicago') returning id into v_occurrence_c;
  insert into public.church_experience_occurrences (experience_id, church_id, starts_at, timezone) values (v_experience_d, v_church, now(), 'America/Chicago') returning id into v_occurrence_d;
  insert into public.church_experience_occurrences (experience_id, church_id, starts_at, timezone) values (v_experience_e, v_church, now(), 'America/Chicago') returning id into v_occurrence_e;
  insert into public.church_experience_occurrences (experience_id, church_id, starts_at, timezone) values (v_experience_f, v_church, now(), 'America/Chicago') returning id into v_occurrence_f;
  insert into public.church_experience_occurrences (experience_id, church_id, starts_at, timezone) values (v_experience_g, v_church, now(), 'America/Chicago') returning id into v_occurrence_g;

  insert into public.church_experience_lessons (experience_id, lesson_id, relationship) values
    (v_experience_a, v_lesson_one_req, 'required'),
    (v_experience_b1, v_lesson_two_req, 'required'),
    (v_experience_b2, v_lesson_two_req, 'required'),
    (v_experience_b3, v_lesson_two_req, 'recommended'),
    (v_experience_c, v_lesson_order_a, 'required'),
    (v_experience_d, v_lesson_order_b, 'required'),
    (v_experience_e, v_lesson_legacy_unjustified, 'required'),
    (v_experience_f, v_lesson_legacy_justified, 'required'),
    (v_experience_g, v_lesson_legacy_backfill_b, 'required');

  -- ---------------------------------------------------------------------------
  -- Scenarios 1-3: INSERT-time forgery protection. The insert payload itself attempts to forge all
  -- three protected columns; the trigger must discard every one of them.
  -- ---------------------------------------------------------------------------
  insert into public.lesson_journeys (user_id, lesson_id, current_stage, studied_completed_at, completed_at)
  values (v_learner_a, v_lesson_bare, 'applied', now(), now())
  returning id, current_stage, studied_completed_at, completed_at into v_journey_bare, v_stage, v_studied_at, v_completed_at;

  perform pg_temp.qa_assert(v_studied_at is null, 'Scenario 1: forged studied_completed_at on INSERT is discarded');
  perform pg_temp.qa_assert(v_stage = 'studied', 'Scenario 2: forged current_stage on INSERT is discarded and defaults to studied');
  perform pg_temp.qa_assert(v_completed_at is null, 'Scenario 3: forged completed_at on INSERT is discarded');

  -- ---------------------------------------------------------------------------
  -- Scenario 4: UPDATE-time studied_completed_at forgery restored to prior stored value.
  -- ---------------------------------------------------------------------------
  insert into public.lesson_journey_items (journey_id, item_key, item_type, completed)
  values (v_journey_bare, 'questions', 'checklist', true);

  update public.lesson_journeys set studied_completed_at = now() where id = v_journey_bare
  returning studied_completed_at into v_studied_at;
  perform pg_temp.qa_assert(v_studied_at is not null, 'setup: v_journey_bare study completion (only questions applicable)');

  update public.lesson_journeys set studied_completed_at = now() - interval '999 days' where id = v_journey_bare
  returning studied_completed_at into v_studied_at;
  perform pg_temp.qa_assert(v_studied_at <> now() - interval '999 days', 'Scenario 4: UPDATE forgery of studied_completed_at is restored to the prior stored value, not the forged one');

  -- ---------------------------------------------------------------------------
  -- Scenario 5 & 6: UPDATE-time current_stage / completed_at forgery, no qualifying data.
  -- ---------------------------------------------------------------------------
  update public.lesson_journeys set current_stage = 'applied' where id = v_journey_bare
  returning current_stage into v_stage;
  perform pg_temp.qa_assert(v_stage <> 'applied', 'Scenario 5: forged current_stage=applied on UPDATE with no qualifying required Experience is not accepted');

  update public.lesson_journeys set completed_at = now() + interval '10 years' where id = v_journey_bare
  returning completed_at into v_completed_at;
  perform pg_temp.qa_assert(v_completed_at is not null and v_completed_at < now() + interval '1 day', 'Scenario 6: forged completed_at on UPDATE is not accepted verbatim (real server-derived value only)');

  -- ---------------------------------------------------------------------------
  -- Scenarios 7-10: checklist-driven studied_completed_at derivation, incl. immutability.
  -- ---------------------------------------------------------------------------
  select studied_completed_at into v_studied_at from public.lesson_journeys where id = v_journey_bare;
  perform pg_temp.qa_assert(v_studied_at is not null, 'Scenario 7: lesson with only questions applicable completes Study once that sole item is marked complete');

  insert into public.lesson_journeys (user_id, lesson_id) values (v_learner_a, v_lesson_full_no_req) returning id into v_journey_full_no_req;
  insert into public.lesson_journey_items (journey_id, item_key, item_type, completed)
  select v_journey_full_no_req, k, 'checklist', true
  from unnest(array['overview','primary_scripture','supporting_scriptures','notes','video','audio','slides']) as k; -- 7 of 9, deliberately missing 'document' and 'questions'

  update public.lesson_journeys set studied_completed_at = now() where id = v_journey_full_no_req
  returning studied_completed_at into v_studied_at;
  perform pg_temp.qa_assert(v_studied_at is null, 'Scenario 8: incomplete checklist (7 of 9 applicable items) does not falsely complete Study');

  insert into public.lesson_journey_items (journey_id, item_key, item_type, completed)
  values (v_journey_full_no_req, 'document', 'checklist', true), (v_journey_full_no_req, 'questions', 'checklist', true);

  update public.lesson_journeys set studied_completed_at = now() where id = v_journey_full_no_req
  returning studied_completed_at, completed_at into v_studied_at, v_completed_at;
  perform pg_temp.qa_assert(v_studied_at is not null, 'Scenario 9: completing the final applicable item (9 of 9) completes Study');
  perform pg_temp.qa_assert(v_completed_at is not null, 'Scenario 11: lesson with zero required Experience -- completed_at set on vacuous truth once Study completes');

  select current_stage into v_stage from public.lesson_journeys where id = v_journey_full_no_req;
  perform pg_temp.qa_assert(v_stage = 'experienced', 'Scenario 11: lesson with zero required Experience -- current_stage caps at experienced, never applied, even though completed_at is set');

  v_before := v_studied_at;
  update public.lesson_journeys set last_opened_at = now() where id = v_journey_full_no_req
  returning studied_completed_at into v_studied_at;
  perform pg_temp.qa_assert(v_studied_at = v_before, 'Scenario 10: studied_completed_at is immutable once set -- unrelated later update does not reset it to a new now()');

  -- ---------------------------------------------------------------------------
  -- Scenarios 12-13: single required Experience, unsatisfied then satisfied.
  -- ---------------------------------------------------------------------------
  insert into public.lesson_journeys (user_id, lesson_id) values (v_learner_a, v_lesson_one_req) returning id into v_journey_one_req;
  insert into public.lesson_journey_items (journey_id, item_key, item_type, completed)
  select v_journey_one_req, k, 'checklist', true
  from unnest(array['overview','primary_scripture','supporting_scriptures','notes','video','audio','slides','document','questions']) as k;
  update public.lesson_journeys set studied_completed_at = now() where id = v_journey_one_req;

  select current_stage, completed_at into v_stage, v_completed_at from public.lesson_journeys where id = v_journey_one_req;
  perform pg_temp.qa_assert(v_stage = 'experienced' and v_completed_at is null, 'Scenario 12: required Experience exists but is unsatisfied -- current_stage stays experienced, completed_at stays null');

  insert into public.church_experience_registrations (occurrence_id, profile_id, status, completion_status) values (v_occurrence_a, v_learner_a, 'confirmed', 'not_started') returning id into v_reg_a;
  update public.church_experience_registrations set completion_status = 'completed' where id = v_reg_a;

  select current_stage, completed_at into v_stage, v_completed_at from public.lesson_journeys where id = v_journey_one_req;
  perform pg_temp.qa_assert(v_stage = 'applied' and v_completed_at is not null, 'Scenario 13: satisfying the single required Experience (via the sync trigger touch) advances current_stage to applied and sets completed_at');

  -- ---------------------------------------------------------------------------
  -- Scenarios 14-16: two required Experiences (partial vs. full), recommended link is inert.
  -- ---------------------------------------------------------------------------
  insert into public.lesson_journeys (user_id, lesson_id) values (v_learner_a, v_lesson_two_req) returning id into v_journey_two_req;
  insert into public.lesson_journey_items (journey_id, item_key, item_type, completed)
  select v_journey_two_req, k, 'checklist', true
  from unnest(array['overview','primary_scripture','supporting_scriptures','notes','video','audio','slides','document','questions']) as k;
  update public.lesson_journeys set studied_completed_at = now() where id = v_journey_two_req;

  insert into public.church_experience_registrations (occurrence_id, profile_id, status, completion_status) values (v_occurrence_b1, v_learner_a, 'confirmed', 'not_started') returning id into v_reg_b1;
  insert into public.church_experience_registrations (occurrence_id, profile_id, status, completion_status) values (v_occurrence_b2, v_learner_a, 'confirmed', 'not_started') returning id into v_reg_b2;
  insert into public.church_experience_registrations (occurrence_id, profile_id, status, completion_status) values (v_occurrence_b3, v_learner_a, 'confirmed', 'not_started') returning id into v_reg_b3; -- recommended, left incomplete forever

  update public.church_experience_registrations set completion_status = 'completed' where id = v_reg_b1; -- only 1 of 2 required
  select current_stage, completed_at into v_stage, v_completed_at from public.lesson_journeys where id = v_journey_two_req;
  perform pg_temp.qa_assert(v_stage = 'experienced' and v_completed_at is null, 'Scenario 14: two required Experiences, only one satisfied -- current_stage stays experienced, completed_at stays null (the "any one" bug this migration fixes)');

  update public.church_experience_registrations set completion_status = 'completed' where id = v_reg_b2; -- now both required satisfied
  select current_stage, completed_at into v_stage, v_completed_at from public.lesson_journeys where id = v_journey_two_req;
  perform pg_temp.qa_assert(v_stage = 'applied' and v_completed_at is not null, 'Scenario 15: both required Experiences satisfied -- current_stage becomes applied, completed_at is set');
  perform pg_temp.qa_assert(v_stage = 'applied', 'Scenario 16: the recommended-only link (never completed) has zero effect on the above -- current_stage still reached applied');

  -- ---------------------------------------------------------------------------
  -- Scenario 17: Experience-first ordering (learner_b).
  -- ---------------------------------------------------------------------------
  insert into public.lesson_journeys (user_id, lesson_id) values (v_learner_b, v_lesson_order_a) returning id into v_journey_order_a;
  insert into public.church_experience_registrations (occurrence_id, profile_id, status, completion_status) values (v_occurrence_c, v_learner_b, 'confirmed', 'not_started') returning id into v_reg_c;
  update public.church_experience_registrations set completion_status = 'completed' where id = v_reg_c; -- Experience satisfied BEFORE Study

  select current_stage, completed_at into v_stage, v_completed_at from public.lesson_journeys where id = v_journey_order_a;
  perform pg_temp.qa_assert(v_stage = 'studied' and v_completed_at is null, 'Scenario 17 setup: Experience satisfied before Study has no premature effect');

  insert into public.lesson_journey_items (journey_id, item_key, item_type, completed)
  select v_journey_order_a, k, 'checklist', true
  from unnest(array['overview','primary_scripture','supporting_scriptures','notes','video','audio','slides','document','questions']) as k;
  update public.lesson_journeys set studied_completed_at = now() where id = v_journey_order_a;

  select current_stage, completed_at into v_stage, v_completed_at from public.lesson_journeys where id = v_journey_order_a;
  perform pg_temp.qa_assert(v_stage = 'applied' and v_completed_at is not null, 'Scenario 17: Experience-first ordering -- completing Study afterward correctly reaches applied/completed_at in the same statement');

  -- ---------------------------------------------------------------------------
  -- Scenario 18: Study-first ordering (learner_b, second lesson).
  -- ---------------------------------------------------------------------------
  insert into public.lesson_journeys (user_id, lesson_id) values (v_learner_b, v_lesson_order_b) returning id into v_journey_order_b;
  insert into public.lesson_journey_items (journey_id, item_key, item_type, completed)
  select v_journey_order_b, k, 'checklist', true
  from unnest(array['overview','primary_scripture','supporting_scriptures','notes','video','audio','slides','document','questions']) as k;
  update public.lesson_journeys set studied_completed_at = now() where id = v_journey_order_b;

  select current_stage, completed_at into v_stage, v_completed_at from public.lesson_journeys where id = v_journey_order_b;
  perform pg_temp.qa_assert(v_stage = 'experienced' and v_completed_at is null, 'Scenario 18 setup: Study completed before the required Experience -- correctly not yet applied');

  insert into public.church_experience_registrations (occurrence_id, profile_id, status, completion_status) values (v_occurrence_d, v_learner_b, 'confirmed', 'not_started') returning id into v_reg_d;
  update public.church_experience_registrations set completion_status = 'completed' where id = v_reg_d; -- fires sync_journey_on_experience_completion's touch

  select current_stage, completed_at into v_stage, v_completed_at from public.lesson_journeys where id = v_journey_order_b;
  perform pg_temp.qa_assert(v_stage = 'applied' and v_completed_at is not null, 'Scenario 18: Study-first ordering -- satisfying the required Experience afterward (via the sync trigger touch) correctly reaches applied/completed_at');

  -- ---------------------------------------------------------------------------
  -- Scenarios 19-20: forward-only current_stage and completed_at immutability under a real
  -- regression attempt (a required Experience that WAS satisfied is later un-satisfied).
  -- ---------------------------------------------------------------------------
  select completed_at into v_before from public.lesson_journeys where id = v_journey_one_req;
  update public.church_experience_registrations set completion_status = 'not_started' where id = v_reg_a; -- does not itself touch lesson_journeys (guard: only fires on transition INTO 'completed')
  update public.lesson_journeys set last_opened_at = now() where id = v_journey_one_req; -- forces re-evaluation
  select current_stage, completed_at into v_stage, v_completed_at from public.lesson_journeys where id = v_journey_one_req;
  perform pg_temp.qa_assert(v_stage = 'applied', 'Scenario 19: current_stage is forward-only -- losing required-Experience satisfaction after reaching applied does not regress it');
  perform pg_temp.qa_assert(v_completed_at = v_before, 'Scenario 20: completed_at is immutable -- unaffected by the same later regression attempt');
  update public.church_experience_registrations set completion_status = 'completed' where id = v_reg_a; -- restore, in case any later scenario re-touches this row

  -- ---------------------------------------------------------------------------
  -- Scenarios 21-22: lesson_journey_items.item_key CHECK constraint.
  -- ---------------------------------------------------------------------------
  begin
    insert into public.lesson_journey_items (journey_id, item_key, item_type, completed)
    values (v_journey_bare, 'not_a_real_checklist_key', 'checklist', true);
    perform pg_temp.qa_assert(false, 'Scenario 21: a fabricated item_key should have been rejected but was accepted');
  exception
    when check_violation then
      perform pg_temp.qa_assert(true, 'Scenario 21: a fabricated item_key is rejected by lesson_journey_items_item_key_check');
  end;

  insert into public.lesson_journeys (user_id, lesson_id) values (v_learner_a, v_lesson_second_no_req) returning id into v_journey_second_no_req;
  insert into public.lesson_journey_items (journey_id, item_key, item_type, completed)
  select v_journey_second_no_req, k, 'checklist', true
  from unnest(array['overview','primary_scripture','supporting_scriptures','notes','video','audio','slides','document','questions']) as k;
  select count(*) into v_count from public.lesson_journey_items where journey_id = v_journey_second_no_req;
  perform pg_temp.qa_assert(v_count = 9, 'Scenario 22: all 9 legitimate item_key values remain insertable without error');

  -- ---------------------------------------------------------------------------
  -- Scenario 23: effective DELETE/INSERT/UPDATE access on lesson_journey_items, under GENUINE
  -- role/JWT impersonation -- not grant-existence alone, and not "no error was thrown" alone
  -- either. An earlier draft of this scenario asserted the OPPOSITE of correct Postgres RLS
  -- semantics for 23a (it treated the DELETE succeeding as the expected/passing outcome). That was
  -- wrong: lesson_journey_items has RLS enabled and NO delete policy at all (0008_lesson_journeys.
  -- sql's own comment: "No delete policy on either table by design"). Per Postgres's documented RLS
  -- behavior, a table with RLS enabled and zero applicable policies for a given command denies that
  -- command for every row, for any non-owner role -- silently, with no error, affecting 0 rows. The
  -- table-level DELETE grant found on the live database (present despite no migration in this
  -- repo's history ever granting it -- see the delivery report) does not, by itself, make any row
  -- deletable; RLS is the actual gate. This version verifies the EXACT row count each statement
  -- affects via GET DIAGNOSTICS ... = ROW_COUNT, not a follow-up SELECT EXISTS guess, and does not
  -- treat "no SQL error" as proof of anything -- INSERT is a separate case (see 23d below).
  --
  -- Impersonates learner_a via SET ROLE + request.jwt.claims -- the exact mechanism auth.uid()
  -- reads in production (every RLS policy in this schema resolves it via
  -- current_setting('request.jwt.claims', true)::json->>'sub') -- then switches back to this
  -- session's original role before the rest of this file continues. Staying in this one continuous
  -- DO block (rather than splitting around the role switch) is deliberate: every scenario after
  -- this one depends on plpgsql variables declared at the top of this same block, which a second DO
  -- block could not see.
  -- ---------------------------------------------------------------------------

  insert into public.lesson_journeys (user_id, lesson_id)
  values (v_learner_b, v_lesson_legacy_unjustified)
  returning id into v_journey_scratch_b; -- fresh, zero items -- avoids the ambiguity of inserting
  -- into a journey that already has all 9 real vocabulary keys populated

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', v_learner_a::text, 'role', 'authenticated')::text, true);

  -- 23a: DELETE own item. Expected: 0 rows affected. No DELETE policy exists for ANY row -- this
  -- is not an ownership check being applied, it is the universal RLS default-deny for a command
  -- with zero policies. The row (v_journey_bare's 'questions' item, the same one that justified its
  -- studied_completed_at back in Scenario 7) is expected to remain fully intact afterward.
  delete from public.lesson_journey_items where journey_id = v_journey_bare and item_key = 'questions';
  get diagnostics v_rows_23a = row_count;

  -- 23b: DELETE another learner's item. Expected: 0 rows affected, for the identical reason as
  -- 23a -- not a distinct cross-learner check, since DELETE has no policy to distinguish owners at
  -- all. Included separately anyway so both directions are explicitly, independently verified
  -- rather than assumed symmetric.
  delete from public.lesson_journey_items where journey_id = v_journey_order_a and item_key = 'overview';
  get diagnostics v_rows_23b = row_count;

  -- 23c: INSERT into own journey. Expected: 1 row affected -- lesson_journey_items_insert_own's
  -- WITH CHECK passes (journey.user_id = auth.uid()). Unchanged from pre-0042 behavior; this
  -- migration never touched INSERT policy/grant on this table.
  insert into public.lesson_journey_items (journey_id, item_key, item_type, completed)
  values (v_journey_bare, 'overview', 'checklist', true);
  get diagnostics v_rows_23c = row_count;

  -- 23d: INSERT into another learner's journey. Expected: an RLS policy-violation ERROR, NOT a
  -- silent 0-row insert. Unlike DELETE/UPDATE (which filter via USING, silently, before the
  -- statement runs), INSERT has only WITH CHECK, evaluated per new row; a failing row aborts the
  -- statement with "new row violates row-level security policy" rather than being silently
  -- skipped. Caught in a nested block (its own implicit savepoint) precisely so that expected
  -- failure doesn't abort this whole scenario or the SET ROLE state around it -- SET LOCAL ROLE and
  -- the request.jwt.claims GUC were both set before entering this block, so they survive its
  -- internal rollback intact.
  v_23d_error := null;
  v_rows_23d := null;
  begin
    insert into public.lesson_journey_items (journey_id, item_key, item_type, completed)
    values (v_journey_scratch_b, 'overview', 'checklist', true);
    get diagnostics v_rows_23d = row_count;
  exception
    when others then
      v_23d_error := sqlerrm;
  end;

  -- 23e: UPDATE own item. Expected: 1 row affected -- lesson_journey_items_update_own's USING
  -- clause makes the row visible, WITH CHECK still passes after the update (ownership unchanged).
  -- Unchanged from pre-0042 behavior. Deliberately targets 'questions' -- the SAME item that
  -- originally justified v_journey_bare's studied_completed_at back in Scenario 7 -- rather than
  -- the newly-inserted 'overview' from 23c. Since 23a's DELETE on 'questions' was blocked, it
  -- survived untouched; targeting it here (via UPDATE, the path that actually succeeds) is what
  -- makes the item-6 check below a genuine test of un-completing the ORIGINAL justifying evidence,
  -- not an unrelated decoy item.
  update public.lesson_journey_items set completed = false where journey_id = v_journey_bare and item_key = 'questions';
  get diagnostics v_rows_23e = row_count;

  -- 23f: UPDATE another learner's item. Expected: 0 rows affected -- USING makes the row invisible
  -- for update entirely; no WITH CHECK failure is even reached, so no error, just 0 rows -- the
  -- same silent-filtering mechanic as 23a/23b, applied to UPDATE's USING clause instead of DELETE's.
  update public.lesson_journey_items set completed = false where journey_id = v_journey_order_a and item_key = 'primary_scripture';
  get diagnostics v_rows_23f = row_count;

  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);

  perform pg_temp.qa_assert(v_rows_23a = 0, format('Scenario 23a: DELETE on own row affected %s row(s) (expected 0 -- RLS denies DELETE for every row on this table, no policy exists for it; the table-level grant alone does not make the row deletable)', v_rows_23a));
  perform pg_temp.qa_assert(v_rows_23b = 0, format('Scenario 23b: DELETE on another learner''s row affected %s row(s) (expected 0 -- identical universal default-deny as 23a, verified independently)', v_rows_23b));
  perform pg_temp.qa_assert(v_rows_23c = 1, format('Scenario 23c: INSERT into own journey affected %s row(s) (expected 1 -- unchanged from pre-0042 behavior)', v_rows_23c));
  perform pg_temp.qa_assert(
    v_23d_error is not null and (v_23d_error ilike '%row-level security%' or v_23d_error ilike '%row security%'),
    format('Scenario 23d: INSERT into another learner''s journey -- expected an RLS policy-violation error (INSERT''s WITH CHECK failure aborts the statement rather than silently inserting 0 rows). Actual: %s', coalesce(v_23d_error, 'no error was raised -- rows_affected=' || coalesce(v_rows_23d::text, 'null') || ' (this would mean the insert was NOT blocked -- a real finding, not expected)'))
  );
  perform pg_temp.qa_assert(v_rows_23e = 1, format('Scenario 23e: UPDATE on own row affected %s row(s) (expected 1 -- unchanged from pre-0042 behavior)', v_rows_23e));
  perform pg_temp.qa_assert(v_rows_23f = 0, format('Scenario 23f: UPDATE on another learner''s row affected %s row(s) (expected 0 -- USING makes the row invisible for update, no error, just no match)', v_rows_23f));

  -- Item 6 of the report, informational only -- NOT a security pass/fail, and this file does not
  -- assert an opinion on whether it is correct product behavior (that is an explicit product
  -- decision, not something to infer from a test). Reported as a plain factual confirmation: since
  -- 23a shows DELETE is fully blocked, deleting a checklist row is NOT a reachable path for an
  -- authenticated learner in practice, despite the stray grant -- distinct from 23e, where UPDATE
  -- on an owned row DOES succeed, and where 23e was deliberately pointed at 'questions' -- the
  -- SAME item that originally justified this journey's studied_completed_at. This checks whether
  -- studied_completed_at (set once, back in Scenario 7, specifically because 'questions' was
  -- completed) is affected by 23e successfully un-completing that same item -- i.e., whether
  -- previously earned completion is immutable against a later change to the exact evidence that
  -- earned it, by the one means (UPDATE) that actually succeeds here.
  select (studied_completed_at is not null) into v_23_check from public.lesson_journeys where id = v_journey_bare;
  perform pg_temp.qa_assert(v_23_check, 'Scenario 23 (item 6, informational): studied_completed_at on v_journey_bare remains set even after the SAME checklist item that originally justified it (''questions'') was successfully un-completed via UPDATE (23e) -- confirms studied_completed_at is immutable once set, by design (0042''s own header: "Never cleared or changed once set"). This scenario reports the fact only; whether un-checking a self-attested item should or should not affect previously earned completion, points, or rewards is a product decision, not something this test decides.');

  -- ---------------------------------------------------------------------------
  -- Scenarios 24-25: live protection around unjustified vs. justified applied state. Historical
  -- normalization itself runs before CREATE TRIGGER in the migration and is verified by comparing
  -- preflight/postflight counts; this live acceptance test never disables a production trigger.
  -- ---------------------------------------------------------------------------
  insert into public.lesson_journeys (user_id, lesson_id)
  values (v_learner_a, v_lesson_legacy_unjustified)
  returning id into v_journey_legacy_unjustified;
  insert into public.lesson_journey_items (journey_id, item_key, item_type, completed)
  values (v_journey_legacy_unjustified, 'questions', 'checklist', true);
  update public.lesson_journeys set studied_completed_at = now() where id = v_journey_legacy_unjustified;
  update public.lesson_journeys set current_stage = 'applied' where id = v_journey_legacy_unjustified;
  select current_stage into v_stage from public.lesson_journeys where id = v_journey_legacy_unjustified;
  perform pg_temp.qa_assert(v_stage = 'experienced', 'Scenario 24: an unjustified live attempt to set applied is rejected');

  insert into public.lesson_journeys (user_id, lesson_id)
  values (v_learner_a, v_lesson_legacy_justified)
  returning id into v_journey_legacy_justified;
  insert into public.lesson_journey_items (journey_id, item_key, item_type, completed)
  values (v_journey_legacy_justified, 'questions', 'checklist', true);
  update public.lesson_journeys set studied_completed_at = now() where id = v_journey_legacy_justified;
  insert into public.church_experience_registrations (occurrence_id, profile_id, status, completion_status)
  values (v_occurrence_f, v_learner_a, 'confirmed', 'not_started') returning id into v_reg_f;
  update public.church_experience_registrations set completion_status = 'completed' where id = v_reg_f;
  select current_stage into v_stage from public.lesson_journeys where id = v_journey_legacy_justified;
  perform pg_temp.qa_assert(v_stage = 'applied', 'Scenario 25: a genuinely justified live journey reaches applied');

  -- ---------------------------------------------------------------------------
  -- Scenarios 26-27: live timestamp behavior corresponding to the two historical backfill shapes.
  -- The one-time backfill itself is verified by preflight/postflight counts, not by disabling the
  -- live trigger.
  -- ---------------------------------------------------------------------------
  insert into public.lesson_journeys (user_id, lesson_id)
  values (v_learner_a, v_lesson_legacy_backfill_a)
  returning id into v_journey_legacy_backfill_a;
  insert into public.lesson_journey_items (journey_id, item_key, item_type, completed)
  values (v_journey_legacy_backfill_a, 'questions', 'checklist', true);
  update public.lesson_journeys set studied_completed_at = now() where id = v_journey_legacy_backfill_a;

  select completed_at, studied_completed_at into v_completed_at, v_studied_at from public.lesson_journeys where id = v_journey_legacy_backfill_a;
  perform pg_temp.qa_assert(v_completed_at = v_studied_at, 'Scenario 26: no-required live completion gives completed_at the same transaction timestamp as studied_completed_at');

  insert into public.lesson_journeys (user_id, lesson_id)
  values (v_learner_a, v_lesson_legacy_backfill_b)
  returning id into v_journey_legacy_backfill_b;
  insert into public.lesson_journey_items (journey_id, item_key, item_type, completed)
  values (v_journey_legacy_backfill_b, 'questions', 'checklist', true);
  update public.lesson_journeys set studied_completed_at = now() where id = v_journey_legacy_backfill_b;
  insert into public.church_experience_registrations (occurrence_id, profile_id, status, completion_status)
  values (v_occurrence_g, v_learner_a, 'confirmed', 'not_started') returning id into v_reg_g;
  update public.church_experience_registrations set completion_status = 'completed' where id = v_reg_g;
  select completed_at, current_stage into v_completed_at, v_stage from public.lesson_journeys where id = v_journey_legacy_backfill_b;
  perform pg_temp.qa_assert(v_completed_at is not null and v_stage = 'applied', 'Scenario 27: required-Experience live completion sets completed_at and applied together');

  -- ---------------------------------------------------------------------------
  -- Scenario 28: Steps A/B never clobber a row whose completed_at is already non-null (re-running
  -- them, as would happen if an operator pasted the migration section twice, is a no-op for rows
  -- already backfilled or already live-completed).
  -- ---------------------------------------------------------------------------
  select completed_at into v_before from public.lesson_journeys where id = v_journey_bare; -- already completed live, in Scenario 7

  update public.lesson_journeys lj
  set completed_at = lj.studied_completed_at
  where lj.completed_at is null
    and lj.studied_completed_at is not null
    and not exists (
      select 1 from public.church_experience_lessons cel
      where cel.lesson_id = lj.lesson_id and cel.relationship = 'required'
    );

  select completed_at into v_completed_at from public.lesson_journeys where id = v_journey_bare;
  perform pg_temp.qa_assert(v_completed_at = v_before, 'Scenario 28: re-running the backfill does not alter a row whose completed_at is already set');

  -- ---------------------------------------------------------------------------
  -- Scenarios 29-31: completion counting readiness and cross-user isolation. This migration does
  -- not itself create a counting RPC (that belongs to the future Kingdom Scrolls gateway work) --
  -- these scenarios confirm the underlying data supports the exact query that future work will use.
  -- Counts are deliberately restricted to a known, named set of lesson_ids per learner (rather than
  -- "every journey this learner has") so this check is self-contained and unaffected by how many
  -- other lessons earlier scenarios happened to complete for the same learner in this same run.
  -- ---------------------------------------------------------------------------
  insert into public.lesson_journey_items (journey_id, item_key, item_type, completed)
  select v_journey_second_no_req, k, 'checklist', true
  from unnest(array['overview','primary_scripture','supporting_scriptures','notes','video','audio','slides','document','questions']) as k
  on conflict (journey_id, item_key) do nothing;
  update public.lesson_journeys set studied_completed_at = now() where id = v_journey_second_no_req;

  select count(distinct lesson_id) into v_count
  from public.lesson_journeys
  where user_id = v_learner_a and completed_at is not null and lesson_id in (v_lesson_bare, v_lesson_second_no_req);
  perform pg_temp.qa_assert(v_count = 2, 'Scenario 29: two distinct fully-completed lessons for learner_a (bare + second_no_req) produce a completion count of exactly 2');

  update public.lesson_journeys set last_opened_at = now() where id = v_journey_bare; -- harmless re-touch of an already-completed row
  select count(distinct lesson_id) into v_count
  from public.lesson_journeys
  where user_id = v_learner_a and completed_at is not null and lesson_id in (v_lesson_bare, v_lesson_second_no_req);
  perform pg_temp.qa_assert(v_count = 2, 'Scenario 30: re-touching an already-completed journey does not create a duplicate row or change the completion count');

  select count(distinct lesson_id) into v_count
  from public.lesson_journeys
  where user_id = v_learner_b and completed_at is not null and lesson_id in (v_lesson_order_a, v_lesson_order_b);
  perform pg_temp.qa_assert(v_count = 2, 'Scenario 31: learner_b''s own completion count (order_a + order_b, both reached applied/completed_at) is computed independently of learner_a''s -- cross-user isolation holds in the underlying data');

  raise notice '=================================================================';
  raise notice 'ALL 31 SCENARIOS PASSED';
  raise notice '=================================================================';
end;
$$;

rollback;

-- ---------------------------------------------------------------------------
-- POST-MIGRATION VERIFICATION -- run this separately, once, after applying the migration. It is
-- read-only, needs no transaction, and is intentionally outside the BEGIN/ROLLBACK block above (it
-- queries real production data, not fixtures). It re-evaluates the identical predicates the
-- migration's Step 0/A/B and the preflight's Section 7/8 use, against the database as it actually
-- stands right now -- proving the one-time historical correction and backfill genuinely landed,
-- not just that today's live trigger behaves correctly on fresh rows (which the transactional test
-- above already covers).
--
-- How to read the output: compare each of these three counts against the preflight report you ran
-- BEFORE applying the migration.
--   - "unjustified applied rows remaining" must be 0 -- the preflight's Section 7
--     "WILL correct to experienced" count should now be fully reflected as corrected. Any nonzero
--     value here means a legacy 'applied' row survived Step 0 uncorrected.
--   - "Step A-eligible rows still missing completed_at" must be 0 -- the preflight's Section 8
--     "Step A will backfill" count should now be fully absorbed.
--   - "Step B-eligible rows still missing completed_at" must be 0 -- the preflight's Section 8
--     "Step B will backfill" count should now be fully absorbed.
-- If any of the three is nonzero, do not treat the migration as successfully applied -- report the
-- exact numbers (and re-run the preflight for comparison) before doing anything else.
-- ---------------------------------------------------------------------------

do $$
declare
  v_unjustified_applied bigint;
  v_stepA_still_missing bigint;
  v_stepB_still_missing bigint;
begin
  select count(*) into v_unjustified_applied
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

  select count(*) into v_stepA_still_missing
  from public.lesson_journeys lj
  where lj.completed_at is null
    and lj.studied_completed_at is not null
    and not exists (
      select 1 from public.church_experience_lessons cel
      where cel.lesson_id = lj.lesson_id and cel.relationship = 'required'
    );

  select count(*) into v_stepB_still_missing
  from public.lesson_journeys lj
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

  raise notice '=================================================================';
  raise notice 'POST-MIGRATION VERIFICATION (compare against the preflight report)';
  raise notice '=================================================================';
  raise notice 'unjustified applied rows remaining (expect 0, vs. preflight Section 7 "WILL correct"): %', v_unjustified_applied;
  raise notice 'Step A-eligible rows still missing completed_at (expect 0, vs. preflight Section 8 "Step A will backfill"): %', v_stepA_still_missing;
  raise notice 'Step B-eligible rows still missing completed_at (expect 0, vs. preflight Section 8 "Step B will backfill"): %', v_stepB_still_missing;
  if v_unjustified_applied = 0 and v_stepA_still_missing = 0 and v_stepB_still_missing = 0 then
    raise notice 'STATUS: historical correction and backfill fully landed.';
  else
    raise notice 'STATUS: BLOCKED -- one or more counts above is nonzero. Do not treat the migration as fully applied.';
  end if;
  raise notice '=================================================================';
end;
$$;

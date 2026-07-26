-- Host/Admin-authored multiple-choice lesson questions: lesson_questions keeps its existing
-- plain-text `question` column as-is; this table adds up to 4 structured answer choices per
-- question, with exactly one flagged correct. Old lesson_questions rows with zero choices remain
-- valid and continue to render as plain reflection questions -- choices is simply an empty array
-- for those, no backfill needed, no existing row touched by this migration. Member-facing answer
-- *submission*/grading/analytics is explicitly out of scope for this phase -- this table only
-- stores host/admin-authored reference data (question + 4 choices + which one is correct).

create table public.lesson_question_choices (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.lesson_questions (id) on delete cascade,
  answer_text text not null check (char_length(btrim(answer_text)) > 0),
  sort_order integer not null default 0,
  is_correct boolean not null default false,
  created_at timestamptz not null default now()
);

create index lesson_question_choices_question_id_idx on public.lesson_question_choices (question_id);

-- "At most one correct choice per question", DB-enforced via a partial unique index -- cheap (one
-- index), and protects the data even if a future write path forgets to validate. Deliberately NOT
-- "exactly one" at the DB layer: delete-then-reinsert replace semantics (see
-- services/supabase/questions.ts) mean a question transiently has zero choice rows mid-replace,
-- and a true "exactly one, always" constraint would need a deferred constraint trigger to tolerate
-- that. "Exactly one" is enforced at the app/service layer before any insert is issued.
create unique index lesson_question_choices_one_correct_per_question
  on public.lesson_question_choices (question_id)
  where is_correct;

alter table public.lesson_question_choices enable row level security;

grant select on public.lesson_question_choices to anon, authenticated;
grant insert, update, delete on public.lesson_question_choices to authenticated;

-- Same shape as lesson_questions' own policies (0014_lesson_questions.sql), one join hop further
-- out: lesson_question_choices -> lesson_questions.lesson_id -> lessons.church_id ->
-- private.is_church_manager. That function's unconditional platform-admin bypass
-- (0003_functions.sql) already covers campaign lessons (church_id null) exactly the way
-- 0038_campaign_lessons.sql relies on for lesson_questions itself -- no campaign-specific policy
-- needed here either, zero new policy surface beyond the standard 4.
create policy "lesson_question_choices_select_follows_lesson"
  on public.lesson_question_choices for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.lesson_questions q
      join public.lessons l on l.id = q.lesson_id
      where q.id = lesson_question_choices.question_id
        and (l.status = 'published' or (select private.is_church_manager(l.church_id)))
    )
  );

create policy "lesson_question_choices_insert_managed"
  on public.lesson_question_choices for insert
  to authenticated
  with check (
    exists (
      select 1 from public.lesson_questions q
      join public.lessons l on l.id = q.lesson_id
      where q.id = lesson_question_choices.question_id
        and (select private.is_church_manager(l.church_id))
    )
  );

create policy "lesson_question_choices_update_managed"
  on public.lesson_question_choices for update
  to authenticated
  using (
    exists (
      select 1 from public.lesson_questions q
      join public.lessons l on l.id = q.lesson_id
      where q.id = lesson_question_choices.question_id
        and (select private.is_church_manager(l.church_id))
    )
  )
  with check (
    exists (
      select 1 from public.lesson_questions q
      join public.lessons l on l.id = q.lesson_id
      where q.id = lesson_question_choices.question_id
        and (select private.is_church_manager(l.church_id))
    )
  );

create policy "lesson_question_choices_delete_managed"
  on public.lesson_question_choices for delete
  to authenticated
  using (
    exists (
      select 1 from public.lesson_questions q
      join public.lessons l on l.id = q.lesson_id
      where q.id = lesson_question_choices.question_id
        and (select private.is_church_manager(l.church_id))
    )
  );

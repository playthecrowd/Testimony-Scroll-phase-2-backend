-- Closes a real exposure in lesson_question_choices.is_correct: migration 0039 granted plain
-- SELECT on the whole table to anon/authenticated (needed for answer_text/sort_order so the study
-- flow can render the 4 choices), which also handed out is_correct -- readable both through the
-- app's own broad LESSON_SELECT embed (leaking into client page props/RSC payload for any lesson
-- with multiple-choice questions) and directly via the Supabase REST API with the public anon key,
-- bypassing the app entirely. RLS filters rows, not columns, and Postgres column grants are
-- per-role, not per-row, so "hosts who manage this lesson" and "members reading it" can't be told
-- apart by grant alone (both are `authenticated`). The fix: revoke column-level access to
-- is_correct outright, and read it only through SECURITY DEFINER functions that re-check
-- authorization internally -- the same pattern migration 0042 established for completed_at.

revoke select on public.lesson_question_choices from anon, authenticated;
grant select (id, question_id, answer_text, sort_order, created_at)
  on public.lesson_question_choices to anon, authenticated;

-- Host/admin editing (QuestionsEditor) needs is_correct for lessons they manage. A non-manager
-- gets zero rows back, not an error -- same "fail closed, quietly" shape as the RLS policies this
-- mirrors, so this can't be used to probe which lessons exist.
create or replace function public.get_lesson_questions_for_edit(p_lesson_id uuid)
returns table (
  question_id uuid,
  question text,
  sort_order int,
  choice_id uuid,
  answer_text text,
  choice_sort_order int,
  is_correct boolean
)
language sql
security definer
set search_path = ''
as $$
  select q.id, q.question, q.sort_order, c.id, c.answer_text, c.sort_order, c.is_correct
  from public.lesson_questions q
  join public.lessons l on l.id = q.lesson_id
  left join public.lesson_question_choices c on c.question_id = q.id
  where q.lesson_id = p_lesson_id
    and (select private.is_church_manager(l.church_id))
  order by q.sort_order, c.sort_order;
$$;

grant execute on function public.get_lesson_questions_for_edit(uuid) to authenticated;

-- Member-facing answer check. Returns only whether the caller's specific choice_id was correct --
-- never is_correct itself, never any other choice's content. Confirms the choice actually belongs
-- to the question and the question belongs to a lesson the caller may access (published, or their
-- own church's draft) before answering, so a fabricated or mismatched id can't be used to probe
-- unrelated lessons/questions.
create or replace function public.check_lesson_question_answer(p_question_id uuid, p_choice_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_correct boolean;
begin
  select c.is_correct into v_correct
  from public.lesson_question_choices c
  join public.lesson_questions q on q.id = c.question_id
  join public.lessons l on l.id = q.lesson_id
  where c.id = p_choice_id
    and c.question_id = p_question_id
    and (l.status = 'published' or (select private.is_church_manager(l.church_id)));

  if v_correct is null then
    raise exception 'Choice not found or not accessible' using errcode = '22023';
  end if;

  return v_correct;
end;
$$;

grant execute on function public.check_lesson_question_answer(uuid, uuid) to authenticated;

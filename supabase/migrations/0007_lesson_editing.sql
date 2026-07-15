-- Lesson editing: unblock speaker changes on update, and add a standalone find-or-create-speaker
-- RPC the edit flow can call (the same logic already used inline by submit_lesson_draft, 0003).
--
-- This migration is genuinely required, not incidental: protect_lesson_ownership_trigger
-- (0003_functions.sql) currently raises an exception if speaker_id changes on UPDATE, which
-- directly blocks the explicitly-required "Speaker" editable field. church_id and created_by stay
-- protected -- lessons remain locked to their creating church in this milestone, per instructions.

create or replace function public.protect_lesson_ownership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_user = 'postgres' or coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  if new.church_id is distinct from old.church_id
     or new.created_by is distinct from old.created_by then
    raise exception 'Cannot change lesson ownership fields (church_id, created_by)';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- find_or_create_speaker -- same normalized find-or-create shape as the inline logic in
-- submit_lesson_draft, exposed standalone so the edit flow can resolve a (possibly changed)
-- speaker name to an id without duplicating that race-safe logic in application code.
-- SECURITY INVOKER: the caller needs their own legitimate speakers_insert_managed RLS rights for
-- p_church_id, same trust model as submit_lesson_draft.
-- ---------------------------------------------------------------------------
create or replace function public.find_or_create_speaker(
  p_church_id uuid,
  p_speaker_name text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_speaker_id uuid;
begin
  if p_speaker_name is null or length(btrim(p_speaker_name)) = 0 then
    return null;
  end if;

  select id into v_speaker_id
  from public.speakers
  where church_id = p_church_id and lower(btrim(name)) = lower(btrim(p_speaker_name));

  if v_speaker_id is null then
    begin
      insert into public.speakers (church_id, name)
      values (p_church_id, btrim(p_speaker_name))
      returning id into v_speaker_id;
    exception when unique_violation then
      select id into v_speaker_id
      from public.speakers
      where church_id = p_church_id and lower(btrim(name)) = lower(btrim(p_speaker_name));
    end;
  end if;

  return v_speaker_id;
end;
$$;

revoke all on function public.find_or_create_speaker(uuid, text) from public;
grant execute on function public.find_or_create_speaker(uuid, text) to authenticated;

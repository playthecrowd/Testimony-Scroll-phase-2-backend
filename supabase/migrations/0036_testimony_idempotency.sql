-- Repair Batch 2, D23 (Trello tBiCxvNF): rapidly clicking "Submit Testimony" created multiple
-- duplicate testimony records -- no client debounce, and no server/DB-side protection at all.
-- Reuses the exact idempotency-key pattern already established for credit_ledger_entries
-- (0027/0028_credit_wallet_rpcs.sql: grant_credits/transfer_credits) rather than inventing a new
-- one: a nullable idempotency_key column plus a partial unique index, checked by a wrapping RPC
-- before falling through to the real insert.
--
-- Column type is uuid (not text) per the same convention idempotency keys already follow
-- elsewhere in this schema. Nullable and safe for existing rows: every row inserted before this
-- migration gets NULL, and a partial unique index (`where idempotency_key is not null`) means
-- NULL rows never participate in the uniqueness check at all -- Postgres also already treats
-- multiple NULLs in a unique index as non-colliding by default, so this is doubly safe.
--
-- Owner column is `submitted_by`, not `profile_id` -- confirmed by reading 0018_testimonies.sql
-- directly rather than assumed.
alter table public.testimonies add column if not exists idempotency_key uuid;

create unique index if not exists testimonies_submitted_by_idempotency_key_key
  on public.testimonies (submitted_by, idempotency_key)
  where idempotency_key is not null;

-- ---------------------------------------------------------------------------
-- submit_testimony_idempotent -- the new, authoritative write path for testimony submission.
-- SECURITY DEFINER, like every other RPC in this codebase that needs to bypass RLS for its own
-- internal reads/writes -- authorization is re-derived explicitly via auth.uid() throughout, never
-- trusted from a parameter, exactly mirroring register_for_experience_occurrence (0023) and
-- grant_credits (0028)'s own trust model. No client-supplied member/profile id parameter exists at
-- all: submitted_by is always auth.uid(), both for the idempotency lookup and the insert itself.
--
-- church_id/display_name are deliberately never set here (same as the original plain insert()
-- this replaces) -- testimonies_before_insert (0018) recomputes both from the real lesson/profile
-- data on every insert this function performs, and also still enforces the "only a completed
-- lesson" rule for both primary_lesson_id and every supporting_lesson_ids entry. This function
-- does not duplicate any of that logic; it only adds idempotency around the same insert path.
--
-- Idempotency semantics: a request for (auth.uid(), idempotency_key) that has already succeeded
-- returns the existing row rather than erroring or creating a second one -- true for a real user
-- retry (slow network, double click that got past the client-side guard) and for a genuine
-- concurrent race (two requests for the same key arriving close enough together that both pass the
-- pre-check select) alike, since the second case is caught by the unique index itself and handled
-- in the exception block below rather than left as a raised error.
-- ---------------------------------------------------------------------------
create or replace function public.submit_testimony_idempotent(
  p_idempotency_key text,
  p_primary_lesson_id uuid,
  p_supporting_lesson_ids uuid[],
  p_title text,
  p_topic text,
  p_scripture text,
  p_written_testimony text,
  p_video_url text,
  p_audio_url text,
  p_visibility text,
  p_identity_display text,
  p_suggested_character text,
  p_story_generation_permission boolean,
  p_future_episode_permission boolean,
  p_voice_likeness_permission boolean
)
returns public.testimonies
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.testimonies;
  v_new public.testimonies;
  v_constraint text;
  v_key uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to submit a testimony.';
  end if;

  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'An idempotency key is required.';
  end if;

  -- Explicit format validation with a friendly message, rather than relying only on the implicit
  -- ::uuid cast below throwing a raw Postgres "invalid input syntax" error.
  if p_idempotency_key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'Invalid idempotency key format.';
  end if;
  v_key := p_idempotency_key::uuid;

  -- Fast path: this exact (profile, key) has already produced a row -- return it, not a new one
  -- and not an error. Two different profiles may safely reuse the same key value (the index is a
  -- composite of both columns), and two genuinely separate submissions from the same profile are
  -- only ever separated by the caller choosing a different key.
  select * into v_existing
  from public.testimonies
  where submitted_by = auth.uid() and idempotency_key = v_key;
  if v_existing.id is not null then
    return v_existing;
  end if;

  begin
    insert into public.testimonies (
      submitted_by, primary_lesson_id, supporting_lesson_ids, title, topic, scripture,
      written_testimony, video_url, audio_url, visibility, identity_display, suggested_character,
      story_generation_permission, future_episode_permission, voice_likeness_permission,
      church_status, platform_status, idempotency_key
    ) values (
      auth.uid(), p_primary_lesson_id, coalesce(p_supporting_lesson_ids, '{}'), p_title, p_topic, p_scripture,
      p_written_testimony, p_video_url, p_audio_url, p_visibility, p_identity_display, p_suggested_character,
      p_story_generation_permission, p_future_episode_permission, p_voice_likeness_permission,
      'pending', case when p_visibility = 'public' then 'pending' else 'not_submitted' end,
      v_key
    )
    returning * into v_new;
  exception when unique_violation then
    -- Only the idempotency index means "same logical submission, return it" -- any other unique
    -- violation (present or future) is a real error and must not be silently swallowed here.
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'testimonies_submitted_by_idempotency_key_key' then
      select * into v_existing
      from public.testimonies
      where submitted_by = auth.uid() and idempotency_key = v_key;
      return v_existing;
    end if;
    raise;
  end;

  return v_new;
end;
$$;

revoke all on function public.submit_testimony_idempotent(
  text, uuid, uuid[], text, text, text, text, text, text, text, text, text, boolean, boolean, boolean
) from public;
grant execute on function public.submit_testimony_idempotent(
  text, uuid, uuid[], text, text, text, text, text, text, text, text, text, boolean, boolean, boolean
) to authenticated;

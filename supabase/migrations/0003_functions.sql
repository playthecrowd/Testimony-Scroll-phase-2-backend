-- Helper functions, triggers, and RPCs. RLS is enabled afterwards in 0004_rls.sql, once
-- every function referenced by a policy already exists.

-- ---------------------------------------------------------------------------
-- private.is_church_manager -- RLS helper, SECURITY DEFINER to avoid recursing into the
-- RLS of the tables it inspects. Lives in a private schema that must never be added to
-- Supabase's "Exposed Schemas" API setting, so it cannot be called as a public RPC endpoint.
-- ---------------------------------------------------------------------------
create schema if not exists private;

create or replace function private.is_church_manager(p_church_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.church_memberships cm
    where cm.church_id = p_church_id
      and cm.profile_id = auth.uid()
      and cm.role in ('host', 'admin')
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_platform_admin
  );
$$;

revoke all on function private.is_church_manager(uuid) from public;
grant usage on schema private to anon, authenticated;
grant execute on function private.is_church_manager(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- handle_new_user -- populates profiles on signup. account_type here is a UX label only
-- (which signup tab was used / which dashboard to route to); it is never read by RLS.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email, account_type)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.email,
    coalesce(new.raw_user_meta_data ->> 'account_type', 'member')
  );
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- protect_profile_columns -- blocks normal users from touching privileged columns.
-- Trusted server-side paths (dashboard SQL editor / service-role calls) are allowed through,
-- since triggers fire for every role and RLS-bypass is independent of trigger execution.
-- ---------------------------------------------------------------------------
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_user = 'postgres' or coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.email is distinct from old.email
     or new.account_type is distinct from old.account_type
     or new.is_platform_admin is distinct from old.is_platform_admin
     or new.created_at is distinct from old.created_at then
    raise exception 'Cannot modify protected profile fields (id, email, account_type, is_platform_admin, created_at)';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_profile_columns() from public;

create trigger protect_profile_columns_trigger
  before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- ---------------------------------------------------------------------------
-- protect_lesson_ownership -- lessons never legitimately change which church/speaker/
-- creator they belong to after creation in this milestone; blocks that outright as a
-- belt-and-suspenders complement to the UPDATE policy's WITH CHECK (see 0004_rls.sql).
-- ---------------------------------------------------------------------------
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
     or new.created_by is distinct from old.created_by
     or new.speaker_id is distinct from old.speaker_id then
    raise exception 'Cannot change lesson ownership fields (church_id, speaker_id, created_by)';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_lesson_ownership() from public;

create trigger protect_lesson_ownership_trigger
  before update on public.lessons
  for each row execute function public.protect_lesson_ownership();

-- ---------------------------------------------------------------------------
-- create_church_with_host -- the ONLY way a host/admin church_memberships row is created.
-- SECURITY DEFINER because it must bypass the no-self-escalation rule on church_memberships,
-- but only for a signed-in, eligible (account_type = 'host') caller creating their own new church.
-- ---------------------------------------------------------------------------
create or replace function public.create_church_with_host(
  p_name text,
  p_city text,
  p_region text,
  p_country text
)
returns public.churches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account_type text;
  v_base_slug text;
  v_slug text;
  v_suffix int := 0;
  v_church public.churches;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to create a church.';
  end if;

  select account_type into v_account_type
  from public.profiles
  where id = auth.uid();

  if v_account_type is null then
    raise exception 'Profile not found for the current user.';
  end if;

  -- One-time eligibility gate on this bootstrap RPC only. Ongoing authorization over the
  -- resulting church always comes from church_memberships/is_platform_admin, never account_type.
  if v_account_type <> 'host' then
    raise exception 'Only Church Host accounts can create a church.';
  end if;

  if exists (
    select 1 from public.church_memberships
    where profile_id = auth.uid() and role in ('host', 'admin')
  ) then
    raise exception 'You already manage a church.';
  end if;

  if p_name is null or length(btrim(p_name)) = 0 then
    raise exception 'Church name is required.';
  end if;
  if length(p_name) > 200 then
    raise exception 'Church name must be 200 characters or fewer.';
  end if;
  if length(coalesce(p_city, '')) > 100
     or length(coalesce(p_region, '')) > 100
     or length(coalesce(p_country, '')) > 100 then
    raise exception 'City, region, and country must each be 100 characters or fewer.';
  end if;

  v_base_slug := trim(both '-' from regexp_replace(lower(btrim(p_name)), '[^a-z0-9]+', '-', 'g'));
  if v_base_slug = '' then
    v_base_slug := 'church';
  end if;
  v_slug := v_base_slug;

  while exists (select 1 from public.churches where slug = v_slug) loop
    v_suffix := v_suffix + 1;
    v_slug := v_base_slug || '-' || v_suffix::text;
  end loop;

  insert into public.churches (name, slug, city, region, country, status, is_demo, created_by)
  values (btrim(p_name), v_slug, p_city, p_region, p_country, 'published', false, auth.uid())
  returning * into v_church;

  insert into public.church_memberships (church_id, profile_id, role)
  values (v_church.id, auth.uid(), 'host');

  return v_church;
end;
$$;

revoke all on function public.create_church_with_host(text, text, text, text) from public;
grant execute on function public.create_church_with_host(text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- submit_lesson_draft -- bundles lesson + speaker/ministry find-or-create + media + host
-- rows in one call. SECURITY INVOKER: the caller already has legitimate RLS rights on every
-- table touched for their own church, so no privilege bypass is needed -- if any insert
-- fails RLS (e.g. church_id the caller doesn't manage), the whole call aborts atomically.
-- p_media is a jsonb array of {media_type, url, content, title} objects.
-- ---------------------------------------------------------------------------
create or replace function public.submit_lesson_draft(
  p_church_id uuid,
  p_title text,
  p_short_description text,
  p_about_text text,
  p_topic text,
  p_subject text,
  p_ministry_name text,
  p_speaker_name text,
  p_date date,
  p_lesson_type text,
  p_primary_scripture text,
  p_supporting_scriptures text[],
  p_tags text[],
  p_quest_url text,
  p_media jsonb
)
returns public.lessons
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_base_slug text;
  v_slug text;
  v_suffix int := 0;
  v_lesson public.lessons;
  v_speaker_id uuid;
  v_ministry_id uuid;
  v_media_item jsonb;
  v_media_type text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to submit a lesson.';
  end if;

  if p_title is null or length(btrim(p_title)) = 0 then
    raise exception 'Lesson title is required.';
  end if;

  if p_church_id is null then
    raise exception 'A church is required.';
  end if;

  -- speaker find-or-create, normalized + race-safe
  if p_speaker_name is not null and length(btrim(p_speaker_name)) > 0 then
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
  end if;

  -- ministry find-or-create, normalized + race-safe
  if p_ministry_name is not null and length(btrim(p_ministry_name)) > 0 then
    select id into v_ministry_id
    from public.ministries
    where church_id = p_church_id and lower(btrim(name)) = lower(btrim(p_ministry_name));

    if v_ministry_id is null then
      begin
        insert into public.ministries (church_id, name)
        values (p_church_id, btrim(p_ministry_name))
        returning id into v_ministry_id;
      exception when unique_violation then
        select id into v_ministry_id
        from public.ministries
        where church_id = p_church_id and lower(btrim(name)) = lower(btrim(p_ministry_name));
      end;
    end if;
  end if;

  v_base_slug := trim(both '-' from regexp_replace(lower(btrim(p_title)), '[^a-z0-9]+', '-', 'g'));
  if v_base_slug = '' then
    v_base_slug := 'lesson';
  end if;
  v_slug := v_base_slug;

  while exists (select 1 from public.lessons where slug = v_slug) loop
    v_suffix := v_suffix + 1;
    v_slug := v_base_slug || '-' || v_suffix::text;
  end loop;

  insert into public.lessons (
    slug, title, short_description, about_text, topic, subject, ministry_category,
    church_id, speaker_id, date, lesson_type, primary_scripture, supporting_scriptures,
    tags, quest_url, status, created_by
  )
  values (
    v_slug, btrim(p_title), p_short_description, p_about_text, p_topic, p_subject, p_ministry_name,
    p_church_id, v_speaker_id, p_date, p_lesson_type, p_primary_scripture,
    coalesce(p_supporting_scriptures, '{}'), coalesce(p_tags, '{}'), p_quest_url, 'draft', auth.uid()
  )
  returning * into v_lesson;

  if v_ministry_id is not null then
    insert into public.lesson_ministries (lesson_id, ministry_id)
    values (v_lesson.id, v_ministry_id)
    on conflict do nothing;
  end if;

  if p_media is not null then
    for v_media_item in select * from jsonb_array_elements(p_media)
    loop
      v_media_type := v_media_item ->> 'media_type';
      if v_media_type in ('notes', 'video', 'audio', 'slides', 'document', 'transcript') then
        insert into public.lesson_media (lesson_id, media_type, url, content, title)
        values (
          v_lesson.id,
          v_media_type,
          v_media_item ->> 'url',
          v_media_item ->> 'content',
          v_media_item ->> 'title'
        );
      end if;
    end loop;
  end if;

  insert into public.lesson_hosts (lesson_id, church_id, status, participant_count)
  values (v_lesson.id, p_church_id, 'scheduled', 0);

  return v_lesson;
end;
$$;

revoke all on function public.submit_lesson_draft(
  uuid, text, text, text, text, text, text, text, date, text, text, text[], text[], text, jsonb
) from public;
grant execute on function public.submit_lesson_draft(
  uuid, text, text, text, text, text, text, text, date, text, text, text[], text[], text, jsonb
) to authenticated;

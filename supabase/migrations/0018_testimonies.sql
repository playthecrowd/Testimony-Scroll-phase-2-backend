-- Phase 6 (docs/PHASE6_AUDIT.md): Kingdom Scroll testimonies -- previously entirely mock
-- (data/testimonies.ts + localStorage). Two independent status columns, not one, because the
-- workflow genuinely has two separate decisions: a church can approve a testimony for its own use
-- without it ever becoming part of the public Kingdom Scroll -- only a platform admin's approval
-- does that, and only for visibility='public' testimonies. This is the real mechanism behind
-- "a member's testimony must not become publicly visible immediately."

create table public.testimonies (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid not null references public.profiles (id) on delete cascade,
  church_id uuid not null references public.churches (id) on delete cascade,
  primary_lesson_id uuid not null references public.lessons (id) on delete cascade,
  supporting_lesson_ids uuid[] not null default '{}',
  title text not null,
  topic text,
  scripture text,
  written_testimony text not null,
  video_url text,
  audio_url text,
  visibility text not null check (visibility in ('public', 'church_only', 'private')),
  identity_display text not null check (identity_display in ('full_name', 'first_name', 'username', 'anonymous')),
  -- Resolved once at submission time (testimonies_before_insert) from the submitter's own profile
  -- and their chosen identity_display -- never derived at read time. This is deliberate: exposing
  -- a submitter's name on a public testimony requires reading their profiles row, which normal
  -- profiles RLS (self-only, or a church manager of a church the profile belongs to) does not
  -- grant to an arbitrary public visitor. Precomputing and storing exactly the consented-to
  -- string avoids ever needing a new profiles RLS policy that exposes more than this one string.
  display_name text,
  -- Free-text only, deliberately not a foreign key -- no real characters table exists yet
  -- (data/characters.ts is still mock; Phase 7 owns designing that schema). Never linked to any
  -- record; a production admin decides any real character relationship entirely outside this table.
  suggested_character text,
  story_generation_permission boolean not null default false,
  future_episode_permission boolean not null default false,
  voice_likeness_permission boolean not null default false,
  church_status text not null default 'pending' check (church_status in ('pending', 'approved', 'rejected')),
  platform_status text not null default 'not_submitted'
    check (platform_status in ('not_submitted', 'pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index testimonies_submitted_by_idx on public.testimonies (submitted_by);
create index testimonies_church_id_idx on public.testimonies (church_id);

create trigger testimonies_set_updated_at
  before update on public.testimonies
  for each row execute function public.set_updated_at(); -- defined in 0008_lesson_journeys.sql

-- ---------------------------------------------------------------------------
-- testimonies_before_insert -- derives church_id from the primary lesson (never trusts client
-- input for it -- a testimony's church is always the church that owns the lesson it's about) and
-- enforces Part 14's "a member may only attach lessons they have actually completed" rule against
-- the real lesson_journeys table, for both the primary lesson and every supporting lesson id.
-- This is real server-side enforcement, not a hidden dropdown option.
-- ---------------------------------------------------------------------------
create or replace function public.testimonies_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_church_id uuid;
  v_lesson_id uuid;
  v_full_name text;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to submit a testimony.';
  end if;

  select church_id into v_church_id from public.lessons where id = new.primary_lesson_id;
  if v_church_id is null then
    raise exception 'That lesson could not be found.';
  end if;
  new.church_id := v_church_id;

  -- Resolve the display name once, here, from the real profile -- never at read time (see the
  -- display_name column comment above for why).
  select full_name, email into v_full_name, v_email from public.profiles where id = auth.uid();
  new.display_name := case new.identity_display
    when 'full_name' then coalesce(nullif(btrim(v_full_name), ''), split_part(v_email, '@', 1))
    -- 'username' falls back to the same first-name behavior as first_name: no username feature
    -- exists anywhere in this app yet (confirmed across every prior phase's audit) -- this is an
    -- honest simplification, not a silent misfeature, until a real username field exists.
    when 'first_name', 'username' then coalesce(nullif(split_part(btrim(coalesce(v_full_name, '')), ' ', 1), ''), split_part(v_email, '@', 1))
    else 'A Kingdom Member'
  end;

  if not exists (
    select 1 from public.lesson_journeys j
    where j.user_id = auth.uid() and j.lesson_id = new.primary_lesson_id and j.studied_completed_at is not null
  ) then
    raise exception 'You can only submit a testimony for a lesson you have completed.';
  end if;

  foreach v_lesson_id in array coalesce(new.supporting_lesson_ids, '{}'::uuid[])
  loop
    if not exists (
      select 1 from public.lesson_journeys j
      where j.user_id = auth.uid() and j.lesson_id = v_lesson_id and j.studied_completed_at is not null
    ) then
      raise exception 'You can only attach lessons you have completed.';
    end if;
  end loop;

  return new;
end;
$$;

revoke all on function public.testimonies_before_insert() from public;

create trigger testimonies_before_insert_trigger
  before insert on public.testimonies
  for each row execute function public.testimonies_before_insert();

-- ---------------------------------------------------------------------------
-- protect_testimony_status_columns -- a church manager may only ever change church_status; a
-- platform admin may only ever change platform_status. Neither may reassign ownership/association
-- fields after submission. Same shape as protect_lesson_ownership (0003_functions.sql).
-- ---------------------------------------------------------------------------
create or replace function public.protect_testimony_status_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_platform_admin boolean;
begin
  if current_user = 'postgres' or coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  select p.is_platform_admin into v_is_platform_admin from public.profiles p where p.id = auth.uid();

  if not coalesce(v_is_platform_admin, false) and new.platform_status is distinct from old.platform_status then
    raise exception 'Only a platform administrator can change platform_status.';
  end if;

  if coalesce(v_is_platform_admin, false) and new.church_status is distinct from old.church_status then
    raise exception 'Only the submitting church can change church_status.';
  end if;

  if new.submitted_by is distinct from old.submitted_by
     or new.church_id is distinct from old.church_id
     or new.primary_lesson_id is distinct from old.primary_lesson_id then
    raise exception 'Cannot change testimony ownership/association fields.';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_testimony_status_columns() from public;

create trigger protect_testimony_status_columns_trigger
  before update on public.testimonies
  for each row execute function public.protect_testimony_status_columns();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.testimonies enable row level security;

grant select, insert, update on public.testimonies to authenticated;

create policy "testimonies_select_own"
  on public.testimonies for select
  to authenticated
  using (submitted_by = auth.uid());

-- Reuses private.is_church_manager(church_id) exactly like Phase 5's lesson_requests -- covers
-- both "this church's own host/admin reviewing testimonies submitted to them" and "a platform
-- admin reviewing any testimony," since the function's admin branch doesn't depend on church_id.
create policy "testimonies_select_managed"
  on public.testimonies for select
  to authenticated
  using (private.is_church_manager(church_id));

-- The real privacy gate: both stages must be approved before anyone else can see it.
create policy "testimonies_select_public_approved"
  on public.testimonies for select
  to anon, authenticated
  using (visibility = 'public' and church_status = 'approved' and platform_status = 'approved');

-- church_id is set by the before-insert trigger, not trusted from the client -- this policy only
-- needs to gate ownership and the two status columns' starting values.
create policy "testimonies_insert_own"
  on public.testimonies for insert
  to authenticated
  with check (
    submitted_by = auth.uid()
    and church_status = 'pending'
    and platform_status = (case when visibility = 'public' then 'pending' else 'not_submitted' end)
  );

create policy "testimonies_update_managed"
  on public.testimonies for update
  to authenticated
  using (private.is_church_manager(church_id))
  with check (private.is_church_manager(church_id));

-- ---------------------------------------------------------------------------
-- testimony_likes -- Part 14: likes/predetermined reactions only, no unrestricted comments.
-- ---------------------------------------------------------------------------
create table public.testimony_likes (
  id uuid primary key default gen_random_uuid(),
  testimony_id uuid not null references public.testimonies (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (testimony_id, profile_id)
);

create index testimony_likes_testimony_id_idx on public.testimony_likes (testimony_id);

alter table public.testimony_likes enable row level security;

grant select, insert, delete on public.testimony_likes to authenticated;
grant select on public.testimony_likes to anon;

-- Public, same as a typical like count/who-liked feature -- no stated privacy requirement on this,
-- and only ever meaningful on an already-public-approved testimony in practice.
create policy "testimony_likes_select_public"
  on public.testimony_likes for select
  to anon, authenticated
  using (true);

-- Can only like a testimony that's actually public and fully approved -- not a pending or
-- church-only one the liker may not even be authorized to see the content of.
create policy "testimony_likes_insert_own"
  on public.testimony_likes for insert
  to authenticated
  with check (
    profile_id = auth.uid()
    and exists (
      select 1 from public.testimonies t
      where t.id = testimony_likes.testimony_id
        and t.visibility = 'public' and t.church_status = 'approved' and t.platform_status = 'approved'
    )
  );

create policy "testimony_likes_delete_own"
  on public.testimony_likes for delete
  to authenticated
  using (profile_id = auth.uid());

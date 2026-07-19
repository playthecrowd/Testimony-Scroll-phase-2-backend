-- Enable RLS and add policies. Safe now: every table and helper function referenced below
-- already exists (0001_tables.sql, 0003_functions.sql).
--
-- Base table GRANTs are explicit throughout rather than assumed, since Supabase's default
-- privileges for anon/authenticated on tables created via migration (vs. the dashboard table
-- editor) shouldn't be relied on implicitly. GRANT is the first gate, RLS the second --
-- both must allow an operation for it to succeed.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

grant select on public.profiles to authenticated;
-- Column-level lockdown: independent of RLS, only these two columns may ever be touched
-- by a normal user update, regardless of what the update payload contains.
grant update (full_name, avatar_url) on public.profiles to authenticated;

create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- churches
-- ---------------------------------------------------------------------------
alter table public.churches enable row level security;

grant select on public.churches to anon, authenticated;
grant update (name, city, region, country, description, logo_url, verified) on public.churches to authenticated;

create policy "churches_select_published_or_managed"
  on public.churches for select
  to anon, authenticated
  using (status = 'published' or (select private.is_church_manager(id)));

create policy "churches_update_managed"
  on public.churches for update
  to authenticated
  using ((select private.is_church_manager(id)))
  with check ((select private.is_church_manager(id)));

-- No INSERT policy/grant for authenticated: the only way a church is created is the
-- create_church_with_host RPC, which is SECURITY DEFINER and bypasses this entirely.

-- ---------------------------------------------------------------------------
-- church_memberships
-- ---------------------------------------------------------------------------
alter table public.church_memberships enable row level security;

grant select, insert on public.church_memberships to authenticated;

create policy "church_memberships_select_own"
  on public.church_memberships for select
  to authenticated
  using (profile_id = auth.uid());

-- Self-service insert can only ever grant the harmless default role to yourself.
-- host/admin rows are created exclusively by create_church_with_host (SECURITY DEFINER).
create policy "church_memberships_insert_self_member_only"
  on public.church_memberships for insert
  to authenticated
  with check (profile_id = auth.uid() and role = 'member');

-- ---------------------------------------------------------------------------
-- speakers
-- ---------------------------------------------------------------------------
alter table public.speakers enable row level security;

grant select on public.speakers to anon, authenticated;
grant insert on public.speakers to authenticated;

create policy "speakers_select_public"
  on public.speakers for select
  to anon, authenticated
  using (true);

create policy "speakers_insert_managed"
  on public.speakers for insert
  to authenticated
  with check ((select private.is_church_manager(church_id)));

-- ---------------------------------------------------------------------------
-- lessons
-- ---------------------------------------------------------------------------
alter table public.lessons enable row level security;

grant select on public.lessons to anon, authenticated;
grant insert, update on public.lessons to authenticated;

create policy "lessons_select_published_or_managed"
  on public.lessons for select
  to anon, authenticated
  using (status = 'published' or (select private.is_church_manager(church_id)));

create policy "lessons_insert_managed_draft_only"
  on public.lessons for insert
  to authenticated
  with check (status = 'draft' and (select private.is_church_manager(church_id)));

-- WITH CHECK here (not just USING) ensures the row still belongs to a church the caller
-- manages *after* the update too -- prevents moving a lesson into an unauthorized church.
-- protect_lesson_ownership_trigger (0003) additionally blocks church_id/speaker_id/created_by
-- from changing at all, regardless of this policy.
create policy "lessons_update_managed"
  on public.lessons for update
  to authenticated
  using ((select private.is_church_manager(church_id)))
  with check ((select private.is_church_manager(church_id)));

-- Kingdom Members have no INSERT or UPDATE policy match at all (they hold no host/admin
-- church_memberships row), so they structurally cannot create or publish lessons.

-- ---------------------------------------------------------------------------
-- lesson_media
-- ---------------------------------------------------------------------------
alter table public.lesson_media enable row level security;

grant select on public.lesson_media to anon, authenticated;
grant insert, update, delete on public.lesson_media to authenticated;

create policy "lesson_media_select_follows_lesson"
  on public.lesson_media for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.lessons l
      where l.id = lesson_media.lesson_id
        and (l.status = 'published' or (select private.is_church_manager(l.church_id)))
    )
  );

create policy "lesson_media_insert_managed"
  on public.lesson_media for insert
  to authenticated
  with check (
    exists (
      select 1 from public.lessons l
      where l.id = lesson_media.lesson_id
        and (select private.is_church_manager(l.church_id))
    )
  );

create policy "lesson_media_update_managed"
  on public.lesson_media for update
  to authenticated
  using (
    exists (select 1 from public.lessons l where l.id = lesson_media.lesson_id and (select private.is_church_manager(l.church_id)))
  )
  with check (
    exists (select 1 from public.lessons l where l.id = lesson_media.lesson_id and (select private.is_church_manager(l.church_id)))
  );

create policy "lesson_media_delete_managed"
  on public.lesson_media for delete
  to authenticated
  using (
    exists (select 1 from public.lessons l where l.id = lesson_media.lesson_id and (select private.is_church_manager(l.church_id)))
  );

-- ---------------------------------------------------------------------------
-- lesson_hosts
-- ---------------------------------------------------------------------------
alter table public.lesson_hosts enable row level security;

grant select on public.lesson_hosts to anon, authenticated;
grant insert on public.lesson_hosts to authenticated;

create policy "lesson_hosts_select_follows_lesson"
  on public.lesson_hosts for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.lessons l
      where l.id = lesson_hosts.lesson_id
        and (l.status = 'published' or (select private.is_church_manager(l.church_id)))
    )
  );

create policy "lesson_hosts_insert_managed"
  on public.lesson_hosts for insert
  to authenticated
  with check (
    exists (
      select 1 from public.lessons l
      where l.id = lesson_hosts.lesson_id
        and (select private.is_church_manager(l.church_id))
    )
  );

-- ---------------------------------------------------------------------------
-- ministries
-- ---------------------------------------------------------------------------
alter table public.ministries enable row level security;

grant select on public.ministries to anon, authenticated;
grant insert on public.ministries to authenticated;

create policy "ministries_select_public"
  on public.ministries for select
  to anon, authenticated
  using (true);

create policy "ministries_insert_managed"
  on public.ministries for insert
  to authenticated
  with check ((select private.is_church_manager(church_id)));

-- ---------------------------------------------------------------------------
-- lesson_ministries
-- ---------------------------------------------------------------------------
alter table public.lesson_ministries enable row level security;

grant select on public.lesson_ministries to anon, authenticated;
grant insert on public.lesson_ministries to authenticated;

create policy "lesson_ministries_select_follows_lesson"
  on public.lesson_ministries for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.lessons l
      where l.id = lesson_ministries.lesson_id
        and (l.status = 'published' or (select private.is_church_manager(l.church_id)))
    )
  );

create policy "lesson_ministries_insert_managed"
  on public.lesson_ministries for insert
  to authenticated
  with check (
    exists (
      select 1 from public.lessons l
      where l.id = lesson_ministries.lesson_id
        and (select private.is_church_manager(l.church_id))
    )
  );

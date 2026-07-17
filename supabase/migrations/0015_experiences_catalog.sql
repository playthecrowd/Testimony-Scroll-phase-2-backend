-- Phase 3 (docs/PHASE3_AUDIT.md section 3c): the lesson builder's "Experience Connection" step
-- needs a real catalog to select from -- previously the only "experience" data on a lesson was a
-- raw quest_url text field (kept, unchanged, as a manual-fallback field; see lessons.quest_url).
--
-- experiences is intentionally a bare catalog with NO authenticated write policy at all in this
-- migration: managing its real content (creating/curating official Quest for the Kingdom
-- experiences) is Production Administrator work (Phase 9 in the roadmap), which doesn't exist yet.
-- Rows are added via the Supabase dashboard or a seed script (is_demo = true) until that admin
-- surface is built -- the same bootstrapping approach already used for demo churches/lessons.

create table public.experiences (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  preview_image_url text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.experiences enable row level security;

grant select on public.experiences to anon, authenticated;

-- Public, cross-church readable by design -- same shape as speakers/ministries (0004_rls.sql):
-- an experience is shared platform content, not owned by any one church.
create policy "experiences_select_public"
  on public.experiences for select
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- lesson_experiences -- join table connecting a lesson to one or more catalog experiences, with
-- an optional host-authored note explaining the relationship (Part 8: "Allow a relationship/
-- reason note"). Mirrors lesson_ministries' RLS shape (0004_rls.sql), plus an UPDATE/DELETE pair
-- (lesson_ministries has neither, but a host actively curating experience selections while
-- editing a lesson needs to remove/revise one, unlike ministries' find-or-create-only model).
-- ---------------------------------------------------------------------------
create table public.lesson_experiences (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  experience_id uuid not null references public.experiences (id) on delete cascade,
  relationship_note text,
  created_at timestamptz not null default now(),
  unique (lesson_id, experience_id)
);

create index lesson_experiences_lesson_id_idx on public.lesson_experiences (lesson_id);
create index lesson_experiences_experience_id_idx on public.lesson_experiences (experience_id);

alter table public.lesson_experiences enable row level security;

grant select on public.lesson_experiences to anon, authenticated;
grant insert, update, delete on public.lesson_experiences to authenticated;

create policy "lesson_experiences_select_follows_lesson"
  on public.lesson_experiences for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.lessons l
      where l.id = lesson_experiences.lesson_id
        and (l.status = 'published' or (select private.is_church_manager(l.church_id)))
    )
  );

create policy "lesson_experiences_insert_managed"
  on public.lesson_experiences for insert
  to authenticated
  with check (
    exists (
      select 1 from public.lessons l
      where l.id = lesson_experiences.lesson_id
        and (select private.is_church_manager(l.church_id))
    )
  );

create policy "lesson_experiences_update_managed"
  on public.lesson_experiences for update
  to authenticated
  using (
    exists (select 1 from public.lessons l where l.id = lesson_experiences.lesson_id and (select private.is_church_manager(l.church_id)))
  )
  with check (
    exists (select 1 from public.lessons l where l.id = lesson_experiences.lesson_id and (select private.is_church_manager(l.church_id)))
  );

create policy "lesson_experiences_delete_managed"
  on public.lesson_experiences for delete
  to authenticated
  using (
    exists (select 1 from public.lessons l where l.id = lesson_experiences.lesson_id and (select private.is_church_manager(l.church_id)))
  );

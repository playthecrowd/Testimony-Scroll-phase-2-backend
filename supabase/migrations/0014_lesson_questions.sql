-- Phase 3 (docs/PHASE3_AUDIT.md): lesson builder Questions step needs real, per-lesson questions.
-- Previously the Study page's Questions tab read from data/questions.ts, a static mock catalog
-- entirely disconnected from real Supabase lessons -- any lesson built through Experience Builder
-- got zero real questions. This table is host-authored only in this phase; no auto-generated
-- suggestions (that would need the AI/content-extraction pipeline, deferred to its own later
-- phase -- see docs/PHASE3_AUDIT.md section 3d). Wiring the Study page's Questions tab to read
-- from this table instead of the mock catalog is Phase 4's job, not this migration's.

create table public.lesson_questions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  question text not null,
  sort_order integer not null default 0,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create index lesson_questions_lesson_id_idx on public.lesson_questions (lesson_id);

alter table public.lesson_questions enable row level security;

grant select on public.lesson_questions to anon, authenticated;
grant insert, update, delete on public.lesson_questions to authenticated;

-- Mirrors lesson_media's policies exactly (0004_rls.sql): visible to anyone once the lesson is
-- published, or to that lesson's own church manager regardless of status; writable only by that
-- church's manager.
create policy "lesson_questions_select_follows_lesson"
  on public.lesson_questions for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.lessons l
      where l.id = lesson_questions.lesson_id
        and (l.status = 'published' or (select private.is_church_manager(l.church_id)))
    )
  );

create policy "lesson_questions_insert_managed"
  on public.lesson_questions for insert
  to authenticated
  with check (
    exists (
      select 1 from public.lessons l
      where l.id = lesson_questions.lesson_id
        and (select private.is_church_manager(l.church_id))
    )
  );

create policy "lesson_questions_update_managed"
  on public.lesson_questions for update
  to authenticated
  using (
    exists (select 1 from public.lessons l where l.id = lesson_questions.lesson_id and (select private.is_church_manager(l.church_id)))
  )
  with check (
    exists (select 1 from public.lessons l where l.id = lesson_questions.lesson_id and (select private.is_church_manager(l.church_id)))
  );

create policy "lesson_questions_delete_managed"
  on public.lesson_questions for delete
  to authenticated
  using (
    exists (select 1 from public.lessons l where l.id = lesson_questions.lesson_id and (select private.is_church_manager(l.church_id)))
  );

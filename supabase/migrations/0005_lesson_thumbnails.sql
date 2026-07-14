-- Lesson thumbnail uploads: a new column for image alt text (featured_image_url already exists,
-- see 0001_tables.sql), a public Storage bucket, and RLS on storage.objects mirroring the
-- private.is_church_manager() pattern already used for public.lessons (0003/0004).

-- ---------------------------------------------------------------------------
-- lessons.featured_image_alt
-- ---------------------------------------------------------------------------
alter table public.lessons add column if not exists featured_image_alt text;

-- No RLS/grant change needed for this column: 0004_rls.sql already grants
-- `insert, update on public.lessons to authenticated` without a column-level restriction, and
-- lessons_update_managed already covers it.

-- ---------------------------------------------------------------------------
-- storage bucket
-- ---------------------------------------------------------------------------
-- public = true so published lessons' thumbnails can be rendered with a plain public URL (no
-- signed URLs / auth headers needed from next/image or <img>). This means the SELECT policy
-- below is a defense-in-depth check for authenticated/API-mediated reads (e.g. supabase.storage
-- .download()) -- the actual privacy boundary for a draft lesson's thumbnail is that its
-- featured_image_url is never returned by a public `lessons` query in the first place
-- (lessons_select_published_or_managed, 0004_rls.sql), so an outside visitor has no way to learn
-- an unpublished lesson's storage path to begin with. This mirrors how churches.logo_url and
-- speakers.avatar_url already work in this schema (public URLs, no per-object gating).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lesson-thumbnails', 'lesson-thumbnails', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- storage.objects policies -- path convention is {churchId}/{lessonId}/{uniqueFileName}, so the
-- first folder segment is the church_id private.is_church_manager() checks against.
-- ---------------------------------------------------------------------------
create policy "lesson_thumbnails_select_published_or_managed"
  on storage.objects for select
  to anon, authenticated
  using (
    bucket_id = 'lesson-thumbnails'
    and exists (
      select 1 from public.lessons l
      where l.id = (storage.foldername(name))[2]::uuid
        and (l.status = 'published' or (select private.is_church_manager(l.church_id)))
    )
  );

create policy "lesson_thumbnails_insert_managed"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'lesson-thumbnails'
    and (select private.is_church_manager(((storage.foldername(name))[1])::uuid))
  );

create policy "lesson_thumbnails_update_managed"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'lesson-thumbnails'
    and (select private.is_church_manager(((storage.foldername(name))[1])::uuid))
  )
  with check (
    bucket_id = 'lesson-thumbnails'
    and (select private.is_church_manager(((storage.foldername(name))[1])::uuid))
  );

create policy "lesson_thumbnails_delete_managed"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'lesson-thumbnails'
    and (select private.is_church_manager(((storage.foldername(name))[1])::uuid))
  );

-- Kingdom Members hold no host/admin church_memberships row for any church, so
-- is_church_manager() is false for every church_id and they structurally cannot insert, update,
-- or delete objects in this bucket -- the same shape as lessons_insert_managed_draft_only.

-- Phase 3 (docs/PHASE3_AUDIT.md section 3a): the "Upload Notes (PDF, DOCX, TXT)" dropzone in the
-- lesson builder has been inert since it was first built -- an <input type="file"> with no
-- onChange handler at all. This gives it a real destination, mirroring 0005_lesson_thumbnails.sql
-- exactly, including its public=true reasoning: the real privacy boundary is that an unpublished
-- lesson's document URL is never returned by a public `lessons`/`lesson_media` query in the first
-- place (lessons_select_published_or_managed / lesson_media_select_follows_lesson), so an outside
-- visitor has no way to learn a draft's document path to begin with, same as churches.logo_url,
-- speakers.avatar_url, and lessons.featured_image_url already work in this schema.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lesson-documents',
  'lesson-documents',
  true,
  20971520, -- 20 MB
  array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
)
on conflict (id) do nothing;

-- Path convention: {churchId}/{lessonId}/{uniqueFileName}, same as lesson-thumbnails -- first
-- folder segment is the church_id private.is_church_manager() checks against.
create policy "lesson_documents_select_published_or_managed"
  on storage.objects for select
  to anon, authenticated
  using (
    bucket_id = 'lesson-documents'
    and exists (
      select 1 from public.lessons l
      where l.id = (storage.foldername(name))[2]::uuid
        and (l.status = 'published' or (select private.is_church_manager(l.church_id)))
    )
  );

create policy "lesson_documents_insert_managed"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'lesson-documents'
    and (select private.is_church_manager(((storage.foldername(name))[1])::uuid))
  );

create policy "lesson_documents_update_managed"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'lesson-documents'
    and (select private.is_church_manager(((storage.foldername(name))[1])::uuid))
  )
  with check (
    bucket_id = 'lesson-documents'
    and (select private.is_church_manager(((storage.foldername(name))[1])::uuid))
  );

create policy "lesson_documents_delete_managed"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'lesson-documents'
    and (select private.is_church_manager(((storage.foldername(name))[1])::uuid))
  );

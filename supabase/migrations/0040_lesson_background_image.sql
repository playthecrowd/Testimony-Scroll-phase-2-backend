-- Lesson detail page background/hero image -- distinct from featured_image_url (the card/
-- list/homepage thumbnail). Nullable: LessonDetailClient falls back to featured_image_url, then
-- to the current dark page background, when this is unset.
--
-- No RLS or grant changes needed: 0004_rls.sql's blanket
-- `grant insert, update on public.lessons to authenticated` already covers every column on this
-- table (it's table-level, not column-scoped), and the existing lessons_update_managed RLS policy
-- already decides *who* may write any column via private.is_church_manager(church_id) -- that
-- check doesn't enumerate columns, so a new one is covered automatically.
alter table public.lessons add column if not exists background_image_url text;

-- Adds media-review/normalization metadata columns to lesson_media.
--
-- None of these columns are referenced anywhere in the current application code (verified via a
-- full-repo search for provider, normalized_url, validation_status, reviewed_at, reviewed_by, and
-- their camelCase equivalents -- no UI, server action, or TypeScript type touches them yet). They
-- are therefore added as plain nullable columns with no default and, deliberately, no CHECK
-- constraint on validation_status: inventing an allowed-value set with no code to derive it from
-- would risk conflicting with whatever the eventual feature actually implements. Add a CHECK
-- constraint in a later migration once real application code defines the allowed values.
--
-- reviewed_by follows the same pattern as lessons.created_by / churches.created_by
-- (public.profiles(id), on delete set null) since it represents "which profile reviewed this
-- media" -- the standard person-reference shape already used elsewhere in this schema.
alter table public.lesson_media
  add column if not exists provider text,
  add column if not exists normalized_url text,
  add column if not exists validation_status text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles (id) on delete set null;

-- No RLS/grant changes needed: 0004_rls.sql already grants full-row
-- select/insert/update/delete on lesson_media (no column-level restriction), and the existing
-- lesson_media_* policies are row-level, so they cover these new columns automatically.

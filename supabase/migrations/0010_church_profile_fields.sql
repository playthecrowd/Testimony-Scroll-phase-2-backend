-- Phase 2 (docs/PHASE2_AUDIT.md): Church Profile needs fields the prompt's Part 7 calls for that
-- churches never had -- address, website, contact info, tradition/category, banner image.
-- "Ministries or relevant categories" reuses the existing public.ministries table (already
-- church_id-scoped, previously only surfaced through lesson_ministries) rather than adding a
-- second categories table.

alter table public.churches
  add column address_line1 text,
  add column website text,
  add column contact_email text,
  add column contact_phone text,
  add column church_type text,
  add column banner_url text;

comment on column public.churches.church_type is
  'Free-text denomination/tradition label (e.g. "Non-denominational", "Baptist") -- intentionally '
  'not a fixed enum, since this varies too widely to constrain at the schema level.';

comment on column public.churches.contact_email is
  'Host-managed contact info. Whether this is shown on the public church page or kept host-only '
  'is an application-layer decision, not an RLS one -- churches_select_published_or_managed '
  'already exposes the whole row to anon/authenticated for published churches, same as '
  'description/website/etc.';

-- The existing churches_update_managed column grant (0004_rls.sql) predates these columns --
-- widen it so a church manager can actually write the new fields. RLS itself (the policy, not
-- the grant) is unchanged: still gated by private.is_church_manager(id) both ways.
grant update (
  name, city, region, country, description, logo_url, verified,
  address_line1, website, contact_email, contact_phone, church_type, banner_url
) on public.churches to authenticated;

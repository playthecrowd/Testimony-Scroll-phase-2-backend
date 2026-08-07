-- Restores two column-level UPDATE lockdowns that were never actually in effect, discovered while
-- verifying migration 0046's own column-scoped grant on wf_decision_stages.
--
-- Root cause: this project's public schema carries a default privilege (ALTER DEFAULT PRIVILEGES,
-- set outside any migration file, at the Supabase project level) that grants `authenticated` full
-- arwdDxtm on every newly created table automatically. A plain `grant update (col1, col2) on
-- table to authenticated` only ever *adds* privileges on top of whatever already exists -- it can
-- never narrow a broader grant already in place. Confirmed live (information_schema.column_privileges)
-- that `authenticated` currently has UPDATE on every single column of public.profiles and
-- public.churches, not just the columns their own migrations' comments claim are the only ones
-- exposed.
--
-- public.profiles (0004_rls.sql intended: full_name, avatar_url only) -- the practical impact here
-- is fully mitigated by a second, independent layer: protect_profile_columns() (0003_functions.sql)
-- is a BEFORE UPDATE trigger that already blocks id/email/account_type/is_platform_admin/created_at
-- from changing for every role except postgres/service_role, regardless of grants. This migration
-- still restores the grant-level lockdown too -- defense-in-depth was clearly the original intent
-- (0004's own comment: "Column-level lockdown: independent of RLS, only these two columns..."),
-- and a grant that silently does nothing is itself a liability for the next person who reads it and
-- trusts the comment.
--
-- public.churches (0004_rls.sql + 0010_church_profile_fields.sql intended: name, city, region,
-- country, description, logo_url, verified, address_line1, website, contact_email, contact_phone,
-- church_type, banner_url) -- unlike profiles, there is NOT a comprehensive trigger covering the
-- remaining columns. Only entity_type has one (protect_church_entity_type, 0041), added specifically
-- because that migration's author already suspected the grant alone wasn't reliable enough --
-- correctly, as it turns out. Before this migration, any church manager (not just a platform admin)
-- could directly update their own church's slug, member_count, status, is_demo, created_by,
-- created_at, or timezone via a plain client update, bypassing whatever the app's own UI/actions
-- intend as the only path to change them.
--
-- Explicitly NOT touched: public.lessons and public.testimonies. Both were column-scoped-grant
-- candidates from the same audit, but both already carry an unrestricted `grant insert, update on
-- ... to authenticated` from their very first migration (0004_rls.sql, 0018_testimonies.sql) -- full
-- column access there is deliberate, with RLS (lessons_update_managed, testimonies_update_managed)
-- as the only intended gate, exactly as 0021_admin_completion.sql's and 0038_campaign_lessons.sql's
-- own comments already say ("RLS below still decides who can actually write these"). Their later
-- `grant update (featured)`-style statements are redundant, not narrowing attempts, so there is
-- nothing to fix on either table.
--
-- Separately observed, deliberately NOT addressed here (different bug class, needs its own decision):
-- public.churches.verified is in the intended grant list above by original design (0004), and
-- updateChurchVerified() (services/supabase/churches.ts) is only ever called from an admin-gated
-- server action (app/admin/churches/actions.ts). But churches_update_managed RLS
-- (private.is_church_manager) does not distinguish a platform admin from an ordinary host/manager of
-- their own church -- meaning any host can currently self-set their own church's `verified` flag
-- directly via the client, bypassing the admin-only action. This grant restoration does not change
-- that (verified stays in the churches grant list, matching original intent) -- it is a distinct,
-- pre-existing RLS-policy-scope question or the app layer, not a default-privilege grant bug.

revoke update on public.profiles from authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;

revoke update on public.churches from authenticated;
grant update (
  name, city, region, country, description, logo_url, verified,
  address_line1, website, contact_email, contact_phone, church_type, banner_url
) on public.churches to authenticated;

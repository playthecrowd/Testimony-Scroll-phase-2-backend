-- Host Dashboard needs a real, per-church member count (Phase 1: eliminate the hardcoded
-- "Radiant Life Church" fallback in app/host-dashboard/page.tsx and its stale mock member
-- totals). church_memberships currently only has "church_memberships_select_own" (0004_rls.sql)
-- -- a Host querying `.eq("church_id", churchId)` under RLS gets back at most their own single
-- row, never a real roster count, because RLS intersects with every query regardless of the
-- filter clause. This adds a second, additive SELECT policy (permissive policies OR together)
-- so a church's own host/admin -- or a platform admin, via the same private.is_church_manager
-- helper every other church-scoped policy already uses -- can read that church's membership
-- rows. Read-only: no INSERT/UPDATE/DELETE policy is added here, so self-service role
-- escalation (0004's "church_memberships_insert_self_member_only") is unaffected.

create policy "church_memberships_select_managed"
  on public.church_memberships for select
  to authenticated
  using (private.is_church_manager(church_id));

-- Phase 2 (docs/PHASE2_AUDIT.md): a real Church Member Management list needs member names/emails,
-- not just a count. public.profiles currently only has "profiles_select_own" (0004_rls.sql) -- a
-- church manager querying profiles joined to their church's church_memberships gets back nothing
-- for anyone but themselves, for the same reason 0009's church_memberships fix was needed: RLS
-- intersects with every query regardless of the join/filter clause.
--
-- This adds a second, additive SELECT policy so a church manager can read the profiles of people
-- who have a church_memberships row in a church they manage. It does not widen what a manager can
-- update (profiles_update_own, unchanged, still self-only) and does not let a manager see a
-- member's churches beyond the one(s) they themselves manage.

create policy "profiles_select_managed_church_members"
  on public.profiles for select
  to authenticated
  using (
    exists (
      select 1
      from public.church_memberships cm
      where cm.profile_id = profiles.id
        and private.is_church_manager(cm.church_id)
    )
  );

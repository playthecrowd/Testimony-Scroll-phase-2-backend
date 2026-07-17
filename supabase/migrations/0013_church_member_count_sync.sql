-- churches.member_count (0001_tables.sql) has never been kept in sync with real membership --
-- it was only ever set by scripts/seed.ts's demo data, which is exactly the "stale mock member
-- total" defect docs/PHASE1_AUDIT.md fixed on the Host Dashboard by querying church_memberships
-- directly instead. The public Church Profile page (app/churches/[churchId]/page.tsx) still
-- reads this column though, since a public visitor has no RLS right to count church_memberships
-- rows directly (that read is deliberately manager-only, 0009_church_memberships_manager_read.sql)
-- -- so this column needs to actually become correct, via triggers, rather than removing the
-- public page's use of it.

create or replace function public.sync_church_member_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_church_id uuid := coalesce(new.church_id, old.church_id);
begin
  update public.churches
  set member_count = (select count(*) from public.church_memberships where church_id = v_church_id)
  where id = v_church_id;
  return null; -- AFTER trigger, return value is ignored
end;
$$;

revoke all on function public.sync_church_member_count() from public;

create trigger church_memberships_sync_member_count
  after insert or delete on public.church_memberships
  for each row execute function public.sync_church_member_count();

-- One-time backfill so every existing church's count reflects its real membership rows
-- immediately, rather than only becoming correct the next time someone joins/leaves.
update public.churches c
set member_count = (select count(*) from public.church_memberships cm where cm.church_id = c.id);

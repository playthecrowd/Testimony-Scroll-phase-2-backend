-- Phase 10.3: resolves the ownership-reassignment edge case flagged in docs/PHASE10_2_AUDIT.md's
-- known limitations.
--
-- church_experiences_write_managed (0022_church_experiences.sql) grants "for all" gated by
-- private.is_church_manager(church_id), checked against both the OLD row (USING) and the NEW row
-- (WITH CHECK). A host/admin who manages two or more churches could therefore issue a raw UPDATE
-- reassigning church_id from a church they manage to another church they also manage -- RLS alone
-- does not fully prevent this, since both the old and new church_id would each independently pass
-- is_church_manager. This is the same shape of gap protect_lesson_ownership already closes for
-- lessons (0003_functions.sql) -- lessons never legitimately change which church/creator they
-- belong to after creation, and neither should an Experience.
--
-- Smallest safe fix: block church_id/created_by from ever changing via UPDATE, full stop,
-- regardless of who manages what. This is a belt-and-suspenders complement to the RLS policy's
-- WITH CHECK, not a replacement for it.

create or replace function public.protect_church_experience_ownership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_user = 'postgres' or coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  if new.church_id is distinct from old.church_id
     or new.created_by is distinct from old.created_by then
    raise exception 'Cannot change Experience ownership fields (church_id, created_by)';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_church_experience_ownership() from public;

create trigger protect_church_experience_ownership_trigger
  before update on public.church_experiences
  for each row execute function public.protect_church_experience_ownership();

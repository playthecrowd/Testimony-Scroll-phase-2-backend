-- Phase 10D1: Organization account/entity parity. Organization is an additive account/entity
-- category, not a separate application -- it reuses the existing churches table and the existing
-- host-dashboard/experience-builder routes, distinguished only by entity_type and account_type,
-- exactly as Church already is.
--
-- Known technical debt, accepted deliberately rather than risked: the underlying table keeps its
-- legacy name public.churches for both entity types. Renaming it (e.g. to `entities`) would touch
-- every RLS policy, FK, and service-layer query in the codebase for a purely cosmetic gain, and is
-- explicitly out of scope for this phase. entity_type is the discriminator; churches is read as
-- "the shared entity table" from this migration forward, not literally "always a church."
--
-- Wrapped in an explicit transaction so a failure partway through (e.g. the constraint-lookup DO
-- block below finding zero or more than one match) leaves the schema completely unchanged rather
-- than half-migrated -- Postgres DDL is already transactional per statement, but BEGIN/COMMIT here
-- makes that guarantee explicit and self-contained regardless of how this file is executed (SQL
-- Editor paste, CLI, etc.), which is not a guarantee any other file in this migration history
-- makes explicit today.

begin;

-- ---------------------------------------------------------------------------
-- 1. churches.entity_type
-- ---------------------------------------------------------------------------

alter table public.churches
  add column entity_type text not null default 'church' check (entity_type in ('church', 'organization'));

comment on column public.churches.entity_type is
  'Discriminates Church vs Organization rows in this shared entity table. Every pre-existing row '
  'backfilled to ''church'' by the column default above. Never read by RLS -- private.is_church_manager '
  'and every policy built on it key only off church_id/id, identical for both entity types. Deliberately '
  'never added to churches_update_managed''s column grant (0004_rls.sql/0010_church_profile_fields.sql) -- '
  'the authenticated role has no UPDATE privilege on this column at all, so it cannot be changed through '
  'the normal grant path regardless of RLS. protect_church_entity_type below is the second, independent '
  'layer: it also blocks any SECURITY DEFINER code path that updates the row directly (which runs as the '
  'function owner and is not subject to the authenticated role''s column grants).';

-- ---------------------------------------------------------------------------
-- 2. protect_church_entity_type -- defense-in-depth belt-and-suspenders complement to the column
-- grant above, matching this codebase's own established pattern (protect_profile_columns,
-- protect_lesson_ownership in 0003_functions.sql): once set at creation by create_church_with_host,
-- entity_type may only ever be changed by a platform administrator, never by an ordinary
-- Church/Organization manager -- ordinary profile/church-profile editing (name, description,
-- address, etc.) is completely untouched, since this trigger only inspects entity_type specifically.
-- ---------------------------------------------------------------------------

create or replace function public.protect_church_entity_type()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.entity_type is distinct from old.entity_type then
    if not exists (select 1 from public.profiles where id = auth.uid() and is_platform_admin) then
      raise exception 'Cannot change entity_type -- only a platform administrator may reclassify a Church/Organization.';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.protect_church_entity_type() from public;

drop trigger if exists protect_church_entity_type_trigger on public.churches;
create trigger protect_church_entity_type_trigger
  before update on public.churches
  for each row execute function public.protect_church_entity_type();

-- ---------------------------------------------------------------------------
-- 3. profiles.account_type: add 'organization' as a third signup/onboarding intent, alongside the
-- existing 'host' (Church) and 'member'. Backward compatible -- every existing row is already
-- 'host' or 'member', both still valid under the new constraint.
--
-- The check constraint's real name is located dynamically rather than assumed, and `into strict`
-- makes the lookup itself the safety check: it raises NO_DATA_FOUND if no check constraint on
-- profiles mentions account_type, or TOO_MANY_ROWS if more than one does, aborting the whole
-- transaction in either case rather than silently dropping the wrong (or an unrelated) constraint.
-- Confirmed by inspecting every migration that has ever touched public.profiles (0001 through
-- 0041): account_type's is the only CHECK constraint that table has ever had.
-- ---------------------------------------------------------------------------

do $$
declare
  v_constraint_name text;
begin
  select conname into strict v_constraint_name
  from pg_constraint
  where conrelid = 'public.profiles'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%account_type%';

  execute format('alter table public.profiles drop constraint %I', v_constraint_name);
end $$;

alter table public.profiles add constraint profiles_account_type_check
  check (account_type in ('host', 'member', 'organization'));

-- ---------------------------------------------------------------------------
-- 4. create_church_with_host generalized to create either entity type, gated by a matching
-- account_type ('host' -> church, 'organization' -> organization) so a member can never create
-- either by simply calling this RPC -- authorization still flows from account_type at creation
-- time only; ongoing authorization over the resulting row always comes from church_memberships/
-- is_platform_admin, unchanged. p_entity_type defaults to 'church' so every existing call site
-- (4 positional args, e.g. app/onboarding/church/actions.ts) keeps its exact prior behavior with
-- zero code changes required there. The old 4-arg signature is dropped first (not left as a second
-- overload) so there remains exactly one function body to maintain and existing 4-arg callers
-- transparently resolve to this one via the new parameter's default.
-- ---------------------------------------------------------------------------

drop function if exists public.create_church_with_host(text, text, text, text);

create or replace function public.create_church_with_host(
  p_name text,
  p_city text,
  p_region text,
  p_country text,
  p_entity_type text default 'church'
)
returns public.churches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account_type text;
  v_base_slug text;
  v_slug text;
  v_suffix int := 0;
  v_church public.churches;
  v_required_account_type text;
  v_fallback_slug text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to create a church.';
  end if;

  if p_entity_type not in ('church', 'organization') then
    raise exception 'Invalid entity type.';
  end if;

  select account_type into v_account_type
  from public.profiles
  where id = auth.uid();

  if v_account_type is null then
    raise exception 'Profile not found for the current user.';
  end if;

  -- One-time eligibility gate on this bootstrap RPC only. Ongoing authorization over the
  -- resulting entity always comes from church_memberships/is_platform_admin, never account_type.
  -- Cross-validated against the requested entity type, not just trusted from the client: an
  -- account_type='host' caller cannot create an organization by passing p_entity_type='organization',
  -- and vice versa -- selecting an entry card never grants permission on its own.
  v_required_account_type := case when p_entity_type = 'organization' then 'organization' else 'host' end;
  if v_account_type <> v_required_account_type then
    if p_entity_type = 'organization' then
      raise exception 'Only Organization accounts can create an organization.';
    else
      raise exception 'Only Church Host accounts can create a church.';
    end if;
  end if;

  if exists (
    select 1 from public.church_memberships
    where profile_id = auth.uid() and role in ('host', 'admin')
  ) then
    if p_entity_type = 'organization' then
      raise exception 'You already manage an organization.';
    else
      raise exception 'You already manage a church.';
    end if;
  end if;

  if p_name is null or length(btrim(p_name)) = 0 then
    raise exception 'Name is required.';
  end if;
  if length(p_name) > 200 then
    raise exception 'Name must be 200 characters or fewer.';
  end if;
  if length(coalesce(p_city, '')) > 100
     or length(coalesce(p_region, '')) > 100
     or length(coalesce(p_country, '')) > 100 then
    raise exception 'City, region, and country must each be 100 characters or fewer.';
  end if;

  v_fallback_slug := case when p_entity_type = 'organization' then 'organization' else 'church' end;
  v_base_slug := trim(both '-' from regexp_replace(lower(btrim(p_name)), '[^a-z0-9]+', '-', 'g'));
  if v_base_slug = '' then
    v_base_slug := v_fallback_slug;
  end if;
  v_slug := v_base_slug;

  while exists (select 1 from public.churches where slug = v_slug) loop
    v_suffix := v_suffix + 1;
    v_slug := v_base_slug || '-' || v_suffix::text;
  end loop;

  insert into public.churches (name, slug, city, region, country, status, is_demo, created_by, entity_type)
  values (btrim(p_name), v_slug, p_city, p_region, p_country, 'published', false, auth.uid(), p_entity_type)
  returning * into v_church;

  insert into public.church_memberships (church_id, profile_id, role)
  values (v_church.id, auth.uid(), 'host');

  return v_church;
end;
$$;

revoke all on function public.create_church_with_host(text, text, text, text, text) from public;
grant execute on function public.create_church_with_host(text, text, text, text, text) to authenticated;

-- Forces PostgREST to pick up the new function signature and the new churches column immediately,
-- rather than waiting for its own periodic schema-cache refresh -- otherwise a client calling
-- create_church_with_host with p_entity_type right after this migration runs could transiently hit
-- a stale "function not found" until PostgREST's cache catches up on its own. Not a pattern used
-- elsewhere in this migration history (no prior migration needed it, since Supabase's hosted
-- PostgREST already reloads on DDL in the common case) -- included here defensively, since this is
-- the first migration in this codebase that changes an RPC's signature the client calls immediately
-- after a fresh deploy.
notify pgrst, 'reload schema';

commit;

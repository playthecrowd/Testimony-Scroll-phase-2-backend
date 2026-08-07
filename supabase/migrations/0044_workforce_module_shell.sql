-- Plotabl Workforce, Phase 1: module shell. Adds the minimum org-scoped schema needed for a
-- guarded /workforce route to exist and know who may enter it -- no decisions, sessions, or
-- experiences yet (those are Phase 2+). See docs/PLOTABL_WORKFORCE_BUILD_TRACKER.md for the
-- scope decision this follows: Workforce is a self-contained, namespaced feature (wf_* tables,
-- organization-as-tenant) rather than a generalized multi-module platform layer -- there is no
-- `organizations`/`modules`/`role_assignments` table in this codebase to build on, and building
-- one was explicitly deferred. Every table here is additive and touches nothing Q4K already
-- depends on.
--
-- Tenant boundary: public.churches rows where entity_type = 'organization' (0041), exactly the
-- same "Organization reuses the Church entity, not a new tenant model" decision that phase already
-- made. A Workforce-enabled row is still an ordinary churches row otherwise -- no new concept of
-- tenant is introduced, only a module-enablement flag scoped to it.
--
-- Role reuse: "platform owner" (spec) is exactly profiles.is_platform_admin, already handled by
-- private.is_church_manager's unconditional bypass -- no new role for it here, same reuse
-- 0038_campaign_lessons.sql relies on for its own admin bypass. "Enterprise/module owner" is
-- exactly church_memberships.role in ('host','admin') for the org, i.e. private.is_church_manager
-- already answers "can this profile administer Workforce for this org" with zero new code. The six
-- roles below (module_owner is intentionally omitted -- see above) are the ones with no existing
-- equivalent in this schema.
--
-- Table/trigger/grant creation happens first for all three tables, then every RLS policy last --
-- wf_departments' own read policy needs to reference wf_role_assignments, which doesn't exist yet
-- at the point wf_departments is created, and CREATE POLICY validates its referenced relations
-- immediately (unlike a deferred FK), so policies can't be interleaved with the table definitions
-- here the way earlier migrations in this file's style would normally do it table-by-table.

begin;

-- ---------------------------------------------------------------------------
-- wf_module_settings -- one row per org that has ever touched Workforce. Absence of a row (or
-- enabled = false) means "not entitled," matching this codebase's existing fail-closed-by-absence
-- convention (e.g. no wallet row until create_member_wallet() is first called).
-- ---------------------------------------------------------------------------
create table public.wf_module_settings (
  church_id uuid primary key references public.churches (id) on delete cascade,
  enabled boolean not null default false,
  enabled_by uuid references public.profiles (id) on delete set null,
  enabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.wf_module_settings is
  'Per-organization Workforce module entitlement. A missing row or enabled = false means the org '
  'has no Workforce access, regardless of the NEXT_PUBLIC_ENABLE_WORKFORCE_MODULE build-wide flag -- '
  'the two gates are independent (build flag = "does this deployment serve /workforce at all," this '
  'row = "is this specific org entitled").';

create trigger wf_module_settings_set_updated_at
  before update on public.wf_module_settings
  for each row execute function public.set_updated_at();

alter table public.wf_module_settings enable row level security;

grant select on public.wf_module_settings to authenticated;
grant insert, update on public.wf_module_settings to authenticated;

-- ---------------------------------------------------------------------------
-- wf_departments -- department scaffolding, created by org managers (spec: "Enterprise/module
-- owner... manages... departments"). Department leadership is granted via wf_role_assignments
-- below, not by creating the department itself.
-- ---------------------------------------------------------------------------
create table public.wf_departments (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  name text not null check (char_length(btrim(name)) > 0),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index wf_departments_church_name_normalized_key
  on public.wf_departments (church_id, lower(btrim(name)));

create trigger wf_departments_set_updated_at
  before update on public.wf_departments
  for each row execute function public.set_updated_at();

alter table public.wf_departments enable row level security;

grant select on public.wf_departments to authenticated;
grant insert, update, delete on public.wf_departments to authenticated;

-- ---------------------------------------------------------------------------
-- wf_role_assignments -- the six Workforce roles with no existing equivalent (spec omits
-- platform_owner/enterprise-module-owner here; see the file header). department_id is required
-- for the two department-scoped roles and forbidden for the three org-scoped ones, enforced below
-- rather than left to application code, since a wrong scope here is a real authorization bug, not
-- just a display bug.
-- ---------------------------------------------------------------------------
create table public.wf_role_assignments (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('stakeholder', 'department_leadership', 'manager', 'employee', 'intern', 'vendor')),
  department_id uuid references public.wf_departments (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint wf_role_assignments_department_scope check (
    (role in ('department_leadership', 'manager', 'employee') and department_id is not null)
    or (role in ('stakeholder', 'intern', 'vendor') and department_id is null)
  ),
  unique (church_id, profile_id, role, department_id)
);

create index wf_role_assignments_church_profile_idx on public.wf_role_assignments (church_id, profile_id);
create index wf_role_assignments_department_idx on public.wf_role_assignments (department_id) where department_id is not null;

-- A department's church_id must match its role assignment's church_id -- department_id alone
-- doesn't guarantee that without this trigger (a foreign key can't cross-check a second column).
create or replace function private.check_wf_role_assignment_department_church()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_department_church_id uuid;
begin
  if new.department_id is null then
    return new;
  end if;
  select church_id into v_department_church_id from public.wf_departments where id = new.department_id;
  if v_department_church_id is distinct from new.church_id then
    raise exception 'department_id does not belong to church_id' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger wf_role_assignments_check_department_church
  before insert or update on public.wf_role_assignments
  for each row execute function private.check_wf_role_assignment_department_church();

alter table public.wf_role_assignments enable row level security;

grant select on public.wf_role_assignments to authenticated;
grant insert, update, delete on public.wf_role_assignments to authenticated;

-- ---------------------------------------------------------------------------
-- RLS policies -- all three tables' policies live here together, after every table they reference
-- exists (see the file-header note on why this differs from this codebase's usual table-by-table
-- policy placement).
-- ---------------------------------------------------------------------------

-- wf_module_settings: an admin/billing-adjacent switch -- only an org manager (host/admin
-- membership, or platform admin via the same bypass) may see or change it, not every member.
create policy "wf_module_settings_select_managed"
  on public.wf_module_settings for select
  to authenticated
  using ((select private.is_church_manager(church_id)));

create policy "wf_module_settings_insert_managed"
  on public.wf_module_settings for insert
  to authenticated
  with check ((select private.is_church_manager(church_id)));

create policy "wf_module_settings_update_managed"
  on public.wf_module_settings for update
  to authenticated
  using ((select private.is_church_manager(church_id)))
  with check ((select private.is_church_manager(church_id)));

-- wf_departments: read is any profile with a Workforce role in this org (needed to render
-- "which department" pickers for stakeholders/managers alike, not just managers); write is org
-- managers only.
create policy "wf_departments_select_role_holder"
  on public.wf_departments for select
  to authenticated
  using (
    (select private.is_church_manager(church_id))
    or exists (
      select 1 from public.wf_role_assignments ra
      where ra.church_id = wf_departments.church_id
        and ra.profile_id = (select auth.uid())
    )
  );

create policy "wf_departments_insert_managed"
  on public.wf_departments for insert
  to authenticated
  with check ((select private.is_church_manager(church_id)));

create policy "wf_departments_update_managed"
  on public.wf_departments for update
  to authenticated
  using ((select private.is_church_manager(church_id)))
  with check ((select private.is_church_manager(church_id)));

create policy "wf_departments_delete_managed"
  on public.wf_departments for delete
  to authenticated
  using ((select private.is_church_manager(church_id)));

-- wf_role_assignments: org managers see every assignment for their org; any profile may see its
-- own row (so the app can answer "what is my role here" without needing manager access). Writes
-- are org managers only for Phase 1 -- the spec's fuller chain-of-command (department leadership
-- inviting managers, managers inviting employees) is deliberately deferred until Phase 2/3 add the
-- decision/session context those invitations are actually scoped to; granting it now against an
-- empty department would be authorization surface with nothing yet to test it against.
create policy "wf_role_assignments_select_managed_or_self"
  on public.wf_role_assignments for select
  to authenticated
  using ((select private.is_church_manager(church_id)) or profile_id = (select auth.uid()));

create policy "wf_role_assignments_insert_managed"
  on public.wf_role_assignments for insert
  to authenticated
  with check ((select private.is_church_manager(church_id)));

create policy "wf_role_assignments_update_managed"
  on public.wf_role_assignments for update
  to authenticated
  using ((select private.is_church_manager(church_id)))
  with check ((select private.is_church_manager(church_id)));

create policy "wf_role_assignments_delete_managed"
  on public.wf_role_assignments for delete
  to authenticated
  using ((select private.is_church_manager(church_id)));

commit;

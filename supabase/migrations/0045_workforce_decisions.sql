-- Plotabl Workforce, Phase 2: Decision Pool catalog + expanded decision preview. Adds decisions
-- themselves, per-decision participants (needed for card avatars, "Assigned to Me", and RLS
-- visibility), and a lightweight invitation-request record for the three WF-02 invite actions.
-- Still additive-only, still scoped to organizations per docs/PLOTABL_WORKFORCE_BUILD_TRACKER.md.
--
-- Deliberately deferred out of this phase (see tracker for why): the Pathway/stage-engine (the
-- 7-stage tracking UI, stage transition history, feedback, approvals) is Phase 3's job, not
-- Phase 2's -- wf_decisions.status below is the flat 11-value status shown on a Decision Pool
-- card, not the stage-engine's own state machine, which will layer on top of it later without
-- needing this column to change shape. Files and a full audit trail are also Phase 3+; the
-- preview screen shows an empty state for both until then. Full chain-of-command invitation
-- approval (a request routing to the target's own manager, not an org manager) is deferred the
-- same way Phase 1 deferred delegated role-assignment writes -- org managers approve every
-- invitation request in this phase.

begin;

-- ---------------------------------------------------------------------------
-- wf_module_settings: per-org atomic counter for human-readable decision numbers ("D-2048"),
-- avoiding a dedicated sequence object per org. Allocated only through
-- wf_allocate_decision_number() below, never incremented directly by app code.
-- ---------------------------------------------------------------------------
alter table public.wf_module_settings add column if not exists next_decision_seq integer not null default 2000;

create or replace function public.wf_allocate_decision_number(p_church_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seq integer;
begin
  if not (select private.is_church_manager(p_church_id)) and not exists (
    select 1 from public.wf_role_assignments
    where church_id = p_church_id and profile_id = auth.uid() and role = 'stakeholder'
  ) then
    raise exception 'Not authorized to create a decision for this organization' using errcode = '42501';
  end if;

  update public.wf_module_settings
    set next_decision_seq = next_decision_seq + 1
    where church_id = p_church_id
    returning next_decision_seq into v_seq;

  if v_seq is null then
    insert into public.wf_module_settings (church_id, next_decision_seq)
    values (p_church_id, 2001)
    returning next_decision_seq into v_seq;
  end if;

  return 'D-' || v_seq::text;
end;
$$;

revoke all on function public.wf_allocate_decision_number(uuid) from public;
grant execute on function public.wf_allocate_decision_number(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- wf_decisions
-- ---------------------------------------------------------------------------
create table public.wf_decisions (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  decision_number text not null,
  title text not null check (char_length(btrim(title)) > 0),
  status text not null default 'draft' check (status in (
    'draft', 'stakeholder_review', 'awaiting_leadership_approval', 'department_translation',
    'management_planning', 'employee_activation', 'in_implementation', 'measuring_outcomes',
    'completed', 'on_hold', 'archived'
  )),
  priority text not null default 'standard' check (priority in ('standard', 'elevated', 'strategic', 'critical')),
  security text not null default 'internal' check (security in ('public', 'internal', 'restricted', 'confidential')),
  department_id uuid references public.wf_departments (id) on delete set null,
  -- Free text for Phase 2 -- a dedicated wf_stakeholder_groups table (spec 13) is deferred until
  -- group-based invitation logic actually needs it as a real relation, not just a display label.
  controlling_stakeholder_group text,
  decision_owner uuid references public.profiles (id) on delete set null,
  executive_intent text,
  desired_outcome text,
  target_date date,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (church_id, decision_number)
);

create index wf_decisions_church_id_idx on public.wf_decisions (church_id);
create index wf_decisions_department_id_idx on public.wf_decisions (department_id) where department_id is not null;
create index wf_decisions_status_idx on public.wf_decisions (church_id, status);

create trigger wf_decisions_set_updated_at
  before update on public.wf_decisions
  for each row execute function public.set_updated_at();

alter table public.wf_decisions enable row level security;

grant select on public.wf_decisions to authenticated;
grant insert, update on public.wf_decisions to authenticated;

-- ---------------------------------------------------------------------------
-- wf_decision_participants -- who is on a specific decision's team, and in what capacity. Distinct
-- from wf_role_assignments (an org-wide or department-wide grant): a profile can hold the
-- `stakeholder` role for the org yet not be on this particular decision, and vice versa a manager
-- can be pulled onto one decision's team without a standing department-wide assignment.
-- ---------------------------------------------------------------------------
create table public.wf_decision_participants (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.wf_decisions (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('stakeholder', 'department_leadership', 'manager', 'employee', 'intern', 'vendor')),
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (decision_id, profile_id, role)
);

create index wf_decision_participants_decision_id_idx on public.wf_decision_participants (decision_id);
create index wf_decision_participants_profile_id_idx on public.wf_decision_participants (profile_id);

alter table public.wf_decision_participants enable row level security;

grant select on public.wf_decision_participants to authenticated;
grant insert, delete on public.wf_decision_participants to authenticated;

-- ---------------------------------------------------------------------------
-- wf_decision_invitation_requests -- backs WF-02's three invite actions. "Invite Departments" /
-- "Invite Department Leadership" go straight to accepted-equivalent (the requester already has
-- the authority; see the RLS/insert note below) -- "Request a Specific Person" starts pending and
-- needs an org manager to approve it in this phase (spec's fuller "routes to the target's own
-- manager" chain is deferred to Phase 3, same reasoning as wf_allocate_decision_number's
-- authorization check above).
-- ---------------------------------------------------------------------------
create table public.wf_decision_invitation_requests (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.wf_decisions (id) on delete cascade,
  church_id uuid not null references public.churches (id) on delete cascade,
  target_scope text not null check (target_scope in ('department', 'department_leadership', 'specific_person')),
  department_id uuid references public.wf_departments (id) on delete cascade,
  target_profile_id uuid references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  requested_by uuid references public.profiles (id) on delete set null,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint wf_decision_invitation_requests_scope_check check (
    (target_scope = 'specific_person' and target_profile_id is not null and department_id is null)
    or (target_scope in ('department', 'department_leadership') and department_id is not null and target_profile_id is null)
  )
);

create index wf_decision_invitation_requests_decision_id_idx on public.wf_decision_invitation_requests (decision_id);

alter table public.wf_decision_invitation_requests enable row level security;

grant select on public.wf_decision_invitation_requests to authenticated;
grant insert, update on public.wf_decision_invitation_requests to authenticated;

-- ---------------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------------

-- wf_decisions: visible to org managers, anyone already on the decision's participant list,
-- anyone holding the org-wide `stakeholder` role (stakeholders direct decisions org-wide per spec
-- section 5, not department-scoped), and anyone with a role assignment in the decision's own
-- department.
create policy "wf_decisions_select_visible"
  on public.wf_decisions for select
  to authenticated
  using (
    (select private.is_church_manager(church_id))
    or exists (select 1 from public.wf_decision_participants dp where dp.decision_id = wf_decisions.id and dp.profile_id = (select auth.uid()))
    or exists (select 1 from public.wf_role_assignments ra where ra.church_id = wf_decisions.church_id and ra.profile_id = (select auth.uid()) and ra.role = 'stakeholder')
    or (
      wf_decisions.department_id is not null
      and exists (select 1 from public.wf_role_assignments ra where ra.church_id = wf_decisions.church_id and ra.profile_id = (select auth.uid()) and ra.department_id = wf_decisions.department_id)
    )
  );

-- Insert: org managers, or a profile holding the org-wide `stakeholder` role (spec: "Stakeholder:
-- Creates and controls decisions"). church_id/created_by are trusted from the row itself since
-- there's no separate SECURITY DEFINER creation path here (unlike decision_number allocation,
-- which is deliberately gated separately -- see that function's own check).
create policy "wf_decisions_insert_stakeholder_or_managed"
  on public.wf_decisions for insert
  to authenticated
  with check (
    (select private.is_church_manager(church_id))
    or exists (select 1 from public.wf_role_assignments ra where ra.church_id = wf_decisions.church_id and ra.profile_id = (select auth.uid()) and ra.role = 'stakeholder')
  );

-- Update: org managers or the decision's own creator. Broader delegated edit rights (department
-- leadership editing their own department's decision, etc.) are Phase 3 Decision Workspace scope.
create policy "wf_decisions_update_managed_or_owner"
  on public.wf_decisions for update
  to authenticated
  using ((select private.is_church_manager(church_id)) or created_by = (select auth.uid()))
  with check ((select private.is_church_manager(church_id)) or created_by = (select auth.uid()));

-- wf_decision_participants: visible to anyone who can see the parent decision; writable by org
-- managers and the decision's own creator (mirrors wf_decisions' own update policy -- adding a
-- participant is a decision-management action).
create policy "wf_decision_participants_select_via_decision"
  on public.wf_decision_participants for select
  to authenticated
  using (
    exists (
      select 1 from public.wf_decisions d
      where d.id = wf_decision_participants.decision_id
        and (
          (select private.is_church_manager(d.church_id))
          or exists (select 1 from public.wf_decision_participants dp2 where dp2.decision_id = d.id and dp2.profile_id = (select auth.uid()))
          or exists (select 1 from public.wf_role_assignments ra where ra.church_id = d.church_id and ra.profile_id = (select auth.uid()) and ra.role = 'stakeholder')
          or (d.department_id is not null and exists (select 1 from public.wf_role_assignments ra where ra.church_id = d.church_id and ra.profile_id = (select auth.uid()) and ra.department_id = d.department_id))
        )
    )
  );

create policy "wf_decision_participants_insert_managed_or_owner"
  on public.wf_decision_participants for insert
  to authenticated
  with check (
    exists (
      select 1 from public.wf_decisions d
      where d.id = wf_decision_participants.decision_id
        and ((select private.is_church_manager(d.church_id)) or d.created_by = (select auth.uid()))
    )
  );

create policy "wf_decision_participants_delete_managed_or_owner"
  on public.wf_decision_participants for delete
  to authenticated
  using (
    exists (
      select 1 from public.wf_decisions d
      where d.id = wf_decision_participants.decision_id
        and ((select private.is_church_manager(d.church_id)) or d.created_by = (select auth.uid()))
    )
  );

-- wf_decision_invitation_requests: visible to org managers, the requester, and the specific
-- person being requested (so they know a request names them, per the spec's own "leadership is
-- notified of the request and resulting action" -- the target seeing it is the minimum version of
-- that). Insert: anyone who could see the decision in the first place (matches "invite" being
-- available to any decision participant, not only its creator). Approve/decline (update): org
-- managers only in this phase -- see file header.
create policy "wf_decision_invitation_requests_select_involved"
  on public.wf_decision_invitation_requests for select
  to authenticated
  using (
    (select private.is_church_manager(church_id))
    or requested_by = (select auth.uid())
    or target_profile_id = (select auth.uid())
  );

create policy "wf_decision_invitation_requests_insert_visible_decision"
  on public.wf_decision_invitation_requests for insert
  to authenticated
  with check (
    exists (
      select 1 from public.wf_decisions d
      where d.id = wf_decision_invitation_requests.decision_id
        and (
          (select private.is_church_manager(d.church_id))
          or exists (select 1 from public.wf_decision_participants dp where dp.decision_id = d.id and dp.profile_id = (select auth.uid()))
          or exists (select 1 from public.wf_role_assignments ra where ra.church_id = d.church_id and ra.profile_id = (select auth.uid()) and ra.role = 'stakeholder')
        )
    )
  );

create policy "wf_decision_invitation_requests_update_managed"
  on public.wf_decision_invitation_requests for update
  to authenticated
  using ((select private.is_church_manager(church_id)))
  with check ((select private.is_church_manager(church_id)));

-- profiles: public.profiles only ships "profiles_select_own" (0004_rls.sql) and
-- "profiles_select_managed_church_members" (0012, managers only) -- neither lets an ordinary
-- Workforce participant (an employee, a department leader with no church_memberships host/admin
-- row) resolve a decision owner's or fellow participant's display name, which the Decision Pool
-- card and preview screen both need. This adds the minimum additional visibility: any profile
-- holding a wf_role_assignments row in org X can read the profile of any member of org X (church
-- membership, any role) -- bounded to the same org, same shape as 0012's own church-scoped
-- reasoning, just keyed off Workforce participation instead of manager status.
create policy "profiles_select_workforce_org_peers"
  on public.profiles for select
  to authenticated
  using (
    exists (
      select 1 from public.church_memberships cm
      where cm.profile_id = profiles.id
        and exists (
          select 1 from public.wf_role_assignments ra
          where ra.church_id = cm.church_id and ra.profile_id = (select auth.uid())
        )
    )
  );

commit;

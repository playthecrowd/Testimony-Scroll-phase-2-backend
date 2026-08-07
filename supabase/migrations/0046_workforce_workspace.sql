-- Plotabl Workforce, Phase 3: Decision Workspace tracking + Department Breakout. Adds the Pathway
-- stage engine, feedback, and the Future Factory experience catalog + per-decision assignment.
--
-- Stage keys are deliberately the same 7 strings as 7 of wf_decisions.status's 11 values
-- (stakeholder_review, awaiting_leadership_approval, department_translation, management_planning,
-- employee_activation, in_implementation, measuring_outcomes) -- the UI content guide's WF-03
-- Pathway names map 1:1 onto them (Stakeholder Intent, Leadership Approval, Department
-- Translation, Management Planning, Employee Activation, Implementation, Outcomes & Lessons), so
-- reusing the vocabulary avoids a second, parallel enum that could drift out of sync with the
-- first. draft/completed/on_hold/archived are decision-level meta-statuses outside this sequence,
-- not stages of their own -- spec section 7's stages 9-10 (Intern/Apprentice Transfer, Community/
-- STEM Pathway) are explicitly "when approved" branches off the main pathway and are deferred to a
-- later phase rather than half-modeled here.
--
-- Session proposals (spec's "Propose Session"/"Review Proposal"/"Approve Proposal" WF-03 actions)
-- are Phase 4 scope per docs/PLOTABL_WORKFORCE_BUILD_TRACKER.md's own phase breakdown -- nothing
-- here creates or references a session table yet.

begin;

-- ---------------------------------------------------------------------------
-- wf_decision_stages -- one row per decision per pathway stage. Lazily created (see
-- ensureDecisionStages in services/supabase/workforceStages.ts) rather than seeded at decision-
-- creation time, so a decision's stage rows always reflect the stage-key set this migration ships
-- with even if that set is ever extended later.
-- ---------------------------------------------------------------------------
create table public.wf_decision_stages (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.wf_decisions (id) on delete cascade,
  stage_key text not null check (stage_key in (
    'stakeholder_review', 'awaiting_leadership_approval', 'department_translation',
    'management_planning', 'employee_activation', 'in_implementation', 'measuring_outcomes'
  )),
  sort_order smallint not null,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'complete')),
  owner_profile_id uuid references public.profiles (id) on delete set null,
  objective text,
  deliverables text,
  due_date date,
  -- Only the Leadership Approval stage sets this true (app-enforced, not a DB constraint -- no
  -- other stage in this phase needs a gate before the pathway can move past it). A decision cannot
  -- advance past a requires_approval stage until approved_at is set.
  requires_approval boolean not null default false,
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (decision_id, stage_key)
);

create index wf_decision_stages_decision_id_idx on public.wf_decision_stages (decision_id);

create trigger wf_decision_stages_set_updated_at
  before update on public.wf_decision_stages
  for each row execute function public.set_updated_at();

alter table public.wf_decision_stages enable row level security;

grant select on public.wf_decision_stages to authenticated;
grant insert on public.wf_decision_stages to authenticated;
-- This project's public schema has a default privilege (ALTER DEFAULT PRIVILEGES, set outside
-- migration files at the Supabase project level) that grants authenticated full arwdDxtm on every
-- newly created table automatically -- a plain GRANT only ever *adds* privileges on top of that,
-- it can't narrow what's already there. The unconditional REVOKE below is required, not
-- decorative, for the column-scoped GRANT that follows to mean anything -- exactly the shape
-- migration 0043 already uses for lesson_question_choices.is_correct (revoke first, then grant
-- back only the safe column list). approved_by/approved_at are excluded from that column list: a
-- plain client UPDATE can never touch them, regardless of what the RLS write policy below allows
-- for the row as a whole. Only wf_approve_decision_stage(), below, can set them, since it runs as
-- the function owner and isn't subject to this grant at all.
revoke update on public.wf_decision_stages from authenticated;
grant update (
  stage_key, sort_order, status, owner_profile_id, objective, deliverables, due_date, requires_approval, started_at, completed_at
) on public.wf_decision_stages to authenticated;

-- Approval is deliberately narrower than the general stage-write policy below (which also allows
-- the decision's own creator, matching wf_decisions_update_managed_or_owner's scope) -- matches
-- Phase 2's own established rule that approval authority stays with org managers only in this
-- phase (wf_decision_invitation_requests_update_managed, 0045). The column-level grant above
-- already blocks a plain client update from touching approved_by/approved_at at all; this function
-- is the only path that can set them, and it enforces the manager-only check itself.
create or replace function public.wf_approve_decision_stage(p_stage_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_church_id uuid;
begin
  select d.church_id into v_church_id
  from public.wf_decision_stages s
  join public.wf_decisions d on d.id = s.decision_id
  where s.id = p_stage_id;

  if v_church_id is null then
    raise exception 'Stage not found' using errcode = '22023';
  end if;

  if not (select private.is_church_manager(v_church_id)) then
    raise exception 'Only an organization manager may approve this stage' using errcode = '42501';
  end if;

  update public.wf_decision_stages
    set approved_by = auth.uid(), approved_at = now()
    where id = p_stage_id;
end;
$$;

revoke all on function public.wf_approve_decision_stage(uuid) from public;
grant execute on function public.wf_approve_decision_stage(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- wf_decision_stage_transitions -- append-only history of stage advances, backing the Pathway's
-- own transition record (not the full cross-feature Audit Trail nav item, which also needs
-- invitation/session/evidence events this phase doesn't have yet).
-- ---------------------------------------------------------------------------
create table public.wf_decision_stage_transitions (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.wf_decisions (id) on delete cascade,
  from_stage_key text,
  to_stage_key text not null,
  changed_by uuid references public.profiles (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index wf_decision_stage_transitions_decision_id_idx on public.wf_decision_stage_transitions (decision_id);

alter table public.wf_decision_stage_transitions enable row level security;

grant select on public.wf_decision_stage_transitions to authenticated;
grant insert on public.wf_decision_stage_transitions to authenticated;

-- ---------------------------------------------------------------------------
-- wf_decision_feedback -- immutable feedback entries (no update/delete grant -- a correction is a
-- new entry, not an edit, same reasoning testimonies and lesson_journeys already apply elsewhere
-- in this codebase to anything treated as a record rather than a draft).
-- ---------------------------------------------------------------------------
create table public.wf_decision_feedback (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.wf_decisions (id) on delete cascade,
  stage_key text,
  author_profile_id uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(btrim(body)) > 0),
  created_at timestamptz not null default now()
);

create index wf_decision_feedback_decision_id_idx on public.wf_decision_feedback (decision_id);

alter table public.wf_decision_feedback enable row level security;

grant select, insert on public.wf_decision_feedback to authenticated;

-- ---------------------------------------------------------------------------
-- wf_experience_templates -- the 8 Plotabl attraction capabilities / Future Factory experience use
-- cases (spec section 9), seeded below. Platform-wide, not org-scoped -- this is Plotabl's own
-- capability catalog, the same shape as campaign lessons being platform-owned content
-- (0038_campaign_lessons.sql) rather than per-church. No write policy: managed by migration/future
-- admin tooling, not by any Workforce role in this phase.
-- ---------------------------------------------------------------------------
create table public.wf_experience_templates (
  id uuid primary key default gen_random_uuid(),
  capability_key text not null unique,
  title text not null,
  communication_focus text not null,
  description text not null,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

alter table public.wf_experience_templates enable row level security;

grant select on public.wf_experience_templates to authenticated;

create policy "wf_experience_templates_select_all"
  on public.wf_experience_templates for select
  to authenticated
  using (true);

insert into public.wf_experience_templates (capability_key, title, communication_focus, description, sort_order) values
  ('real_time_motion_to_3d', 'Workforce Skills Mirror', 'demonstration', 'Capture expert movement and convert it into repeatable role training.', 1),
  ('volumetric_environments', 'Future Factory Leadership Stage', 'vision_and_conversation', 'Deliver leadership intent through a spatial briefing and guided conversation.', 2),
  ('interactive_gaming_consoles', 'Mission Skills Challenge', 'morale_and_rewards', 'Build proficiency through collaborative scoring, recognition, and rewards.', 3),
  ('immersive_360_viewer', 'Factory Process Walkthrough', 'visual_orientation', 'Introduce spaces, workflows, stations, and safety zones before deployment.', 4),
  ('live_capture_and_distribution', 'Expert Knowledge Network', 'knowledge_transfer', 'Preserve demonstrations, frames, commentary, and expert guidance.', 5),
  ('content_to_gameplay', 'Real Event Decision Lab', 'decision_practice', 'Turn approved real-world lessons into branching judgment scenarios.', 6),
  ('screen_ride_and_simulator', 'Future Factory Readiness Simulator', 'skills_training', 'Practice workflow, equipment, sequencing, and responses before activation.', 7),
  ('multiplayer_vr_shared_pov', 'Mentor Shadow Network', 'collaborative_coaching', 'Observe, coach, and compare participant viewpoints in real time.', 8);

-- ---------------------------------------------------------------------------
-- wf_experience_assignments -- Department Leadership's "Select & Assign" on WF-04. customization_notes
-- folds in the spec's separate "Customize with Plotabl" action as an optional note on the same
-- assignment rather than a second record type -- a customization request with nothing to attach it
-- to isn't meaningfully different from an assignment with notes, for this phase's scope.
-- ---------------------------------------------------------------------------
create table public.wf_experience_assignments (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.wf_decisions (id) on delete cascade,
  experience_template_id uuid not null references public.wf_experience_templates (id) on delete restrict,
  customization_notes text,
  assigned_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index wf_experience_assignments_decision_id_idx on public.wf_experience_assignments (decision_id);

alter table public.wf_experience_assignments enable row level security;

grant select on public.wf_experience_assignments to authenticated;
grant insert, delete on public.wf_experience_assignments to authenticated;

-- ---------------------------------------------------------------------------
-- wf_experience_assignment_managers -- which manager(s) Department Leadership assigned to run a
-- given experience assignment.
-- ---------------------------------------------------------------------------
create table public.wf_experience_assignment_managers (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.wf_experience_assignments (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  assigned_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (assignment_id, profile_id)
);

alter table public.wf_experience_assignment_managers enable row level security;

grant select on public.wf_experience_assignment_managers to authenticated;
grant insert, delete on public.wf_experience_assignment_managers to authenticated;

-- ---------------------------------------------------------------------------
-- RLS policies. A shared visibility shape recurs throughout (org manager, decision participant,
-- org-wide stakeholder, or role-holder in the decision's own department) -- this is the exact
-- expression wf_decisions_select_visible (0045) already uses; every table below that hangs off a
-- decision_id reuses it via a join to wf_decisions rather than duplicating wf_decisions' own logic
-- a second time.
-- ---------------------------------------------------------------------------

create policy "wf_decision_stages_select_via_decision"
  on public.wf_decision_stages for select
  to authenticated
  using (
    exists (
      select 1 from public.wf_decisions d
      where d.id = wf_decision_stages.decision_id
        and (
          (select private.is_church_manager(d.church_id))
          or exists (select 1 from public.wf_decision_participants dp where dp.decision_id = d.id and dp.profile_id = (select auth.uid()))
          or exists (select 1 from public.wf_role_assignments ra where ra.church_id = d.church_id and ra.profile_id = (select auth.uid()) and ra.role = 'stakeholder')
          or (d.department_id is not null and exists (select 1 from public.wf_role_assignments ra where ra.church_id = d.church_id and ra.profile_id = (select auth.uid()) and ra.department_id = d.department_id))
        )
    )
  );

-- Write: org managers, the decision's own creator, or the stage's assigned owner -- matches
-- wf_decisions_update_managed_or_owner's own scope, plus the one stage-specific case (an owner
-- updating their own stage) that decision-level update doesn't cover.
create policy "wf_decision_stages_write_managed_owner_or_stage_owner"
  on public.wf_decision_stages for all
  to authenticated
  using (
    owner_profile_id = (select auth.uid())
    or exists (
      select 1 from public.wf_decisions d
      where d.id = wf_decision_stages.decision_id
        and ((select private.is_church_manager(d.church_id)) or d.created_by = (select auth.uid()))
    )
  )
  with check (
    owner_profile_id = (select auth.uid())
    or exists (
      select 1 from public.wf_decisions d
      where d.id = wf_decision_stages.decision_id
        and ((select private.is_church_manager(d.church_id)) or d.created_by = (select auth.uid()))
    )
  );

create policy "wf_decision_stage_transitions_select_via_decision"
  on public.wf_decision_stage_transitions for select
  to authenticated
  using (
    exists (
      select 1 from public.wf_decisions d
      where d.id = wf_decision_stage_transitions.decision_id
        and (
          (select private.is_church_manager(d.church_id))
          or exists (select 1 from public.wf_decision_participants dp where dp.decision_id = d.id and dp.profile_id = (select auth.uid()))
          or exists (select 1 from public.wf_role_assignments ra where ra.church_id = d.church_id and ra.profile_id = (select auth.uid()) and ra.role = 'stakeholder')
          or (d.department_id is not null and exists (select 1 from public.wf_role_assignments ra where ra.church_id = d.church_id and ra.profile_id = (select auth.uid()) and ra.department_id = d.department_id))
        )
    )
  );

create policy "wf_decision_stage_transitions_insert_managed_or_owner"
  on public.wf_decision_stage_transitions for insert
  to authenticated
  with check (
    exists (
      select 1 from public.wf_decisions d
      where d.id = wf_decision_stage_transitions.decision_id
        and ((select private.is_church_manager(d.church_id)) or d.created_by = (select auth.uid()))
    )
  );

create policy "wf_decision_feedback_select_via_decision"
  on public.wf_decision_feedback for select
  to authenticated
  using (
    exists (
      select 1 from public.wf_decisions d
      where d.id = wf_decision_feedback.decision_id
        and (
          (select private.is_church_manager(d.church_id))
          or exists (select 1 from public.wf_decision_participants dp where dp.decision_id = d.id and dp.profile_id = (select auth.uid()))
          or exists (select 1 from public.wf_role_assignments ra where ra.church_id = d.church_id and ra.profile_id = (select auth.uid()) and ra.role = 'stakeholder')
          or (d.department_id is not null and exists (select 1 from public.wf_role_assignments ra where ra.church_id = d.church_id and ra.profile_id = (select auth.uid()) and ra.department_id = d.department_id))
        )
    )
  );

-- Insert: anyone who can see the decision -- feedback is meant to be collected broadly (spec:
-- feedback is a first-class nav item every stage surfaces), not restricted to managers/creator the
-- way stage edits and assignments are.
create policy "wf_decision_feedback_insert_visible_decision"
  on public.wf_decision_feedback for insert
  to authenticated
  with check (
    author_profile_id = (select auth.uid())
    and exists (
      select 1 from public.wf_decisions d
      where d.id = wf_decision_feedback.decision_id
        and (
          (select private.is_church_manager(d.church_id))
          or exists (select 1 from public.wf_decision_participants dp where dp.decision_id = d.id and dp.profile_id = (select auth.uid()))
          or exists (select 1 from public.wf_role_assignments ra where ra.church_id = d.church_id and ra.profile_id = (select auth.uid()) and ra.role = 'stakeholder')
          or (d.department_id is not null and exists (select 1 from public.wf_role_assignments ra where ra.church_id = d.church_id and ra.profile_id = (select auth.uid()) and ra.department_id = d.department_id))
        )
    )
  );

create policy "wf_experience_assignments_select_via_decision"
  on public.wf_experience_assignments for select
  to authenticated
  using (
    exists (
      select 1 from public.wf_decisions d
      where d.id = wf_experience_assignments.decision_id
        and (
          (select private.is_church_manager(d.church_id))
          or exists (select 1 from public.wf_decision_participants dp where dp.decision_id = d.id and dp.profile_id = (select auth.uid()))
          or exists (select 1 from public.wf_role_assignments ra where ra.church_id = d.church_id and ra.profile_id = (select auth.uid()) and ra.role = 'stakeholder')
          or (d.department_id is not null and exists (select 1 from public.wf_role_assignments ra where ra.church_id = d.church_id and ra.profile_id = (select auth.uid()) and ra.department_id = d.department_id))
        )
    )
  );

-- Write: org managers, the decision's creator, or a department_leadership role-holder in the
-- decision's own department -- the one place in Phase 3 that actually grants a non-manager,
-- non-creator role a write (spec: department leadership is who selects experiences), narrowly
-- scoped to exactly the department the decision belongs to.
create policy "wf_experience_assignments_write_managed_owner_or_dept_lead"
  on public.wf_experience_assignments for all
  to authenticated
  using (
    exists (
      select 1 from public.wf_decisions d
      where d.id = wf_experience_assignments.decision_id
        and (
          (select private.is_church_manager(d.church_id))
          or d.created_by = (select auth.uid())
          or (d.department_id is not null and exists (
            select 1 from public.wf_role_assignments ra
            where ra.church_id = d.church_id and ra.profile_id = (select auth.uid())
              and ra.role = 'department_leadership' and ra.department_id = d.department_id
          ))
        )
    )
  )
  with check (
    exists (
      select 1 from public.wf_decisions d
      where d.id = wf_experience_assignments.decision_id
        and (
          (select private.is_church_manager(d.church_id))
          or d.created_by = (select auth.uid())
          or (d.department_id is not null and exists (
            select 1 from public.wf_role_assignments ra
            where ra.church_id = d.church_id and ra.profile_id = (select auth.uid())
              and ra.role = 'department_leadership' and ra.department_id = d.department_id
          ))
        )
    )
  );

create policy "wf_experience_assignment_managers_select_via_assignment"
  on public.wf_experience_assignment_managers for select
  to authenticated
  using (
    exists (
      select 1 from public.wf_experience_assignments a
      join public.wf_decisions d on d.id = a.decision_id
      where a.id = wf_experience_assignment_managers.assignment_id
        and (
          (select private.is_church_manager(d.church_id))
          or exists (select 1 from public.wf_decision_participants dp where dp.decision_id = d.id and dp.profile_id = (select auth.uid()))
          or exists (select 1 from public.wf_role_assignments ra where ra.church_id = d.church_id and ra.profile_id = (select auth.uid()) and ra.role = 'stakeholder')
          or (d.department_id is not null and exists (select 1 from public.wf_role_assignments ra where ra.church_id = d.church_id and ra.profile_id = (select auth.uid()) and ra.department_id = d.department_id))
        )
    )
  );

create policy "wf_experience_assignment_managers_write_managed_owner_or_dept_lead"
  on public.wf_experience_assignment_managers for all
  to authenticated
  using (
    exists (
      select 1 from public.wf_experience_assignments a
      join public.wf_decisions d on d.id = a.decision_id
      where a.id = wf_experience_assignment_managers.assignment_id
        and (
          (select private.is_church_manager(d.church_id))
          or d.created_by = (select auth.uid())
          or (d.department_id is not null and exists (
            select 1 from public.wf_role_assignments ra
            where ra.church_id = d.church_id and ra.profile_id = (select auth.uid())
              and ra.role = 'department_leadership' and ra.department_id = d.department_id
          ))
        )
    )
  )
  with check (
    exists (
      select 1 from public.wf_experience_assignments a
      join public.wf_decisions d on d.id = a.decision_id
      where a.id = wf_experience_assignment_managers.assignment_id
        and (
          (select private.is_church_manager(d.church_id))
          or d.created_by = (select auth.uid())
          or (d.department_id is not null and exists (
            select 1 from public.wf_role_assignments ra
            where ra.church_id = d.church_id and ra.profile_id = (select auth.uid())
              and ra.role = 'department_leadership' and ra.department_id = d.department_id
          ))
        )
    )
  );

commit;

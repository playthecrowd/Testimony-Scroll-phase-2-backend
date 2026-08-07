-- Plotabl Workforce, Phase 4: session proposal, approval, scheduling, invitations, and the
-- employee onboarding/waiting-room flow. Still additive-only, still organization-scoped.
--
-- Out of scope for this phase (deferred to Phase 5 per docs/PLOTABL_WORKFORCE_BUILD_TRACKER.md):
-- the actual live session -- start/pause/end controls, the 3D/VR world, assessments, leadership
-- clips, POV streams. wf_sessions/wf_session_participants exist here only far enough to support
-- proposing, approving, scheduling, inviting, and an employee confirming + waiting -- their status
-- vocabularies intentionally already include the later live-session values (spec's own UI content
-- guide vocabulary) so Phase 5 extends behavior on the same columns rather than needing new ones.
--
-- Credits: a session's admission credits are tracked in a dedicated, namespaced
-- wf_session_credit_ledger -- deliberately NOT the existing Q4K public.credit_ledger/wallet
-- tables. Those are Q4K's own member-facing spiritual-growth economy (Kingdom Economy phases); an
-- enterprise session's admission "credits" (spec section 11) are a different currency with
-- different semantics, and folding them into Q4K's financial tables would violate this module's
-- own isolation boundary (docs/PLOTABL_WORKFORCE_BUILD_TRACKER.md's non-negotiable safety
-- boundary) for no real benefit. Append-only, idempotent, exactly as spec section 11 requires --
-- and this time the "no update/delete grant" pattern is paired with an explicit revoke first
-- (see migration 0047's finding: a bare narrower grant does not override this project's default
-- table-creation privilege, so it must be revoked, not just left ungranted).
--
-- private.can_view_wf_decision/can_view_wf_session are new SECURITY DEFINER helpers -- the same
-- decision-visibility expression has now been inlined four times across 0045/0046; introducing the
-- helper here (rather than retroactively editing those already-applied, already-committed
-- migrations) avoids a fifth and sixth copy, and keeps every new policy in this file provably
-- consistent with the earlier ones instead of hand-copying the join again.

begin;

create or replace function private.can_view_wf_decision(p_decision_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.wf_decisions d
    where d.id = p_decision_id
      and (
        private.is_church_manager(d.church_id)
        or exists (select 1 from public.wf_decision_participants dp where dp.decision_id = d.id and dp.profile_id = auth.uid())
        or exists (select 1 from public.wf_role_assignments ra where ra.church_id = d.church_id and ra.profile_id = auth.uid() and ra.role = 'stakeholder')
        or (d.department_id is not null and exists (select 1 from public.wf_role_assignments ra where ra.church_id = d.church_id and ra.profile_id = auth.uid() and ra.department_id = d.department_id))
      )
  );
$$;

revoke all on function private.can_view_wf_decision(uuid) from public;
grant execute on function private.can_view_wf_decision(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- wf_session_proposals -- one per experience assignment attempt at scheduling a session. A
-- rejected/changes-requested proposal is not deleted -- a manager either edits it back to 'draft'
-- and resubmits, or a fresh proposal is created; keeping the row preserves the review history.
-- ---------------------------------------------------------------------------
create table public.wf_session_proposals (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.wf_decisions (id) on delete cascade,
  church_id uuid not null references public.churches (id) on delete cascade,
  experience_assignment_id uuid not null references public.wf_experience_assignments (id) on delete cascade,
  title text not null check (char_length(btrim(title)) > 0),
  objective text,
  audience_description text,
  starts_at timestamptz,
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  capacity integer check (capacity is null or capacity > 0),
  admission_model text not null default 'host_covered' check (admission_model in ('host_covered', 'participant_paid', 'free')),
  credit_pool integer check (credit_pool is null or credit_pool >= 0),
  credit_price integer check (credit_price is null or credit_price >= 0),
  requires_admission_approval boolean not null default false,
  content_classification text not null default 'internal' check (content_classification in ('public', 'internal', 'restricted', 'confidential')),
  evidence_requirements text,
  recording_master boolean not null default false,
  recording_mobile_world boolean not null default false,
  recording_vr_pov boolean not null default false,
  recording_leadership_stream boolean not null default false,
  status text not null default 'draft' check (status in (
    'draft', 'submitted', 'department_review', 'awaiting_leadership_approval',
    'changes_requested', 'approved', 'rejected', 'scheduled', 'cancelled'
  )),
  proposed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index wf_session_proposals_decision_id_idx on public.wf_session_proposals (decision_id);
create index wf_session_proposals_assignment_id_idx on public.wf_session_proposals (experience_assignment_id);

create trigger wf_session_proposals_set_updated_at
  before update on public.wf_session_proposals
  for each row execute function public.set_updated_at();

alter table public.wf_session_proposals enable row level security;

-- revoke all first: this project's default table-creation privilege (see file header) grants
-- authenticated the full set on every new table, so every grant below has to be treated as
-- narrowing a starting point of "everything," not adding to a starting point of "nothing." This
-- table also deliberately gets no delete grant at all (proposals are kept for review history, per
-- the comment above) -- revoking here removes doubt rather than depending solely on "no delete
-- policy exists" to block it.
revoke all on public.wf_session_proposals from authenticated;
grant select on public.wf_session_proposals to authenticated;
-- status excluded from BOTH insert and update (not just update) -- a bare unrestricted INSERT
-- grant would otherwise let the proposer create a brand-new row with status already set to
-- 'approved' directly, bypassing wf_approve_session_proposal() entirely (same shape as the
-- wf_decision_stages forged-approval gap fixed in 0049 -- caught here before ever being applied,
-- since this table was still uncommitted at the time). status defaults to 'draft' via the column
-- default, which the insert grant doesn't need to include explicitly.
grant insert (
  decision_id, church_id, experience_assignment_id, title, objective, audience_description, starts_at,
  duration_minutes, capacity, admission_model, credit_pool, credit_price, requires_admission_approval,
  content_classification, evidence_requirements, recording_master, recording_mobile_world,
  recording_vr_pov, recording_leadership_stream, proposed_by
) on public.wf_session_proposals to authenticated;
-- status excluded entirely from this general grant (learned from 0047: a plain grant, even a
-- column-scoped one, cannot express "writable, but only to these specific values" -- excluding the
-- column is the only reliable way to stop a client setting it straight to 'approved'/'scheduled',
-- which must only ever happen inside wf_approve_session_proposal()'s own authorization check and
-- session-creation side effects). Moving draft/changes_requested -> submitted is a separate,
-- narrower SECURITY DEFINER function below (wf_submit_session_proposal) for the same reason --
-- not because submitting needs manager-only authority (the proposer themselves does this), but
-- because a bare column grant still can't restrict which specific transition is allowed.
grant update (
  title, objective, audience_description, starts_at, duration_minutes, capacity, admission_model,
  credit_pool, credit_price, requires_admission_approval, content_classification, evidence_requirements,
  recording_master, recording_mobile_world, recording_vr_pov, recording_leadership_stream
) on public.wf_session_proposals to authenticated;

-- ---------------------------------------------------------------------------
-- wf_session_proposal_approvals -- append-only review history (Review Proposal / Approve
-- Proposal). Written only by wf_approve_session_proposal(), never directly.
-- ---------------------------------------------------------------------------
create table public.wf_session_proposal_approvals (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.wf_session_proposals (id) on delete cascade,
  reviewed_by uuid references public.profiles (id) on delete set null,
  decision text not null check (decision in ('approved', 'rejected', 'changes_requested')),
  note text,
  created_at timestamptz not null default now()
);

create index wf_session_proposal_approvals_proposal_id_idx on public.wf_session_proposal_approvals (proposal_id);

alter table public.wf_session_proposal_approvals enable row level security;

revoke all on public.wf_session_proposal_approvals from authenticated;
grant select on public.wf_session_proposal_approvals to authenticated;
-- No insert/update/delete grant at all -- every row is written by wf_approve_session_proposal(),
-- which runs as the function owner and is not subject to this grant.

-- ---------------------------------------------------------------------------
-- wf_sessions -- created only by wf_approve_session_proposal() on approval. join_token is a
-- unique, unguessable identifier for the eventual "unique join URL" (spec section 10 step 7) --
-- not used as a bare-token public entry point in this phase (every participant is an authenticated
-- Plotabl Workforce user per the spec's own role hierarchy, not an anonymous webinar guest), but
-- the column exists now so a future single-click email link doesn't need a schema change to add it.
-- ---------------------------------------------------------------------------
create table public.wf_sessions (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null unique references public.wf_session_proposals (id) on delete cascade,
  decision_id uuid not null references public.wf_decisions (id) on delete cascade,
  church_id uuid not null references public.churches (id) on delete cascade,
  title text not null,
  join_token uuid not null default gen_random_uuid(),
  status text not null default 'preparing' check (status in (
    'preparing', 'ready_to_start', 'live', 'paused', 'completed', 'cancelled', 'archived'
  )),
  host_profile_id uuid references public.profiles (id) on delete set null,
  starts_at timestamptz,
  duration_minutes integer,
  capacity integer,
  admission_model text not null,
  credit_pool integer,
  credit_price integer,
  requires_admission_approval boolean not null default false,
  recording_master boolean not null default false,
  recording_mobile_world boolean not null default false,
  recording_vr_pov boolean not null default false,
  recording_leadership_stream boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index wf_sessions_join_token_idx on public.wf_sessions (join_token);
create index wf_sessions_decision_id_idx on public.wf_sessions (decision_id);

create trigger wf_sessions_set_updated_at
  before update on public.wf_sessions
  for each row execute function public.set_updated_at();

alter table public.wf_sessions enable row level security;

-- No insert grant at all -- every row is created by wf_approve_session_proposal(). No delete
-- grant either -- a session record needs to persist for evidence/audit purposes even once
-- cancelled/completed (status carries that state, the row itself is never removed).
revoke all on public.wf_sessions from authenticated;
grant select on public.wf_sessions to authenticated;
-- status/host_profile_id excluded from this phase's grant -- start/pause/end control is Phase 5
-- scope and will get its own SECURITY DEFINER path then, same reasoning as approved_at in 0046.
grant update (title, starts_at, duration_minutes, capacity, requires_admission_approval) on public.wf_sessions to authenticated;

-- ---------------------------------------------------------------------------
-- wf_session_invitations -- a manager invites a specific profile. Distinct from
-- wf_session_participants (below): an invitation can be declined and never becomes a participant
-- row at all.
-- ---------------------------------------------------------------------------
create table public.wf_session_invitations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.wf_sessions (id) on delete cascade,
  invited_profile_id uuid not null references public.profiles (id) on delete cascade,
  invited_by uuid references public.profiles (id) on delete set null,
  status text not null default 'invited' check (status in ('invited', 'confirmed', 'declined')),
  created_at timestamptz not null default now(),
  unique (session_id, invited_profile_id)
);

create index wf_session_invitations_session_id_idx on public.wf_session_invitations (session_id);
create index wf_session_invitations_invited_profile_id_idx on public.wf_session_invitations (invited_profile_id);

alter table public.wf_session_invitations enable row level security;

-- No update or delete grant at all -- status changes only via wf_confirm_session_invitation()/
-- wf_decline_session_invitation() (which also handle the resulting participant row and, for
-- confirm, the credit charge, atomically), and invitations are kept even once declined rather than
-- removed, matching wf_session_proposals' own history-keeping reasoning.
revoke all on public.wf_session_invitations from authenticated;
grant select on public.wf_session_invitations to authenticated;
-- status excluded from insert too, same reasoning as wf_session_proposals above -- an inviting
-- manager should not be able to create an invitation that is already 'confirmed' (defaults to
-- 'invited' via the column default).
grant insert (session_id, invited_profile_id, invited_by) on public.wf_session_invitations to authenticated;

-- ---------------------------------------------------------------------------
-- wf_session_participants -- the invitee's actual onboarding/waiting-room state. Status
-- vocabulary matches the UI content guide's full "Participant statuses" list even though this
-- phase only ever writes up through 'waiting' -- checked_in/in_3d_world/vr_live/etc. are Phase 5's
-- to set, on the same column.
-- ---------------------------------------------------------------------------
create table public.wf_session_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.wf_sessions (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'confirmed' check (status in (
    'invited', 'confirmed', 'checked_in', 'avatar_ready', 'waiting', 'in_3d_world', 'vr_live',
    'viewing_pov', 'disconnected', 'completed', 'follow_up_assigned'
  )),
  admission_confirmed boolean not null default false,
  device_check_completed boolean not null default false,
  avatar_ready boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, profile_id)
);

create index wf_session_participants_session_id_idx on public.wf_session_participants (session_id);

create trigger wf_session_participants_set_updated_at
  before update on public.wf_session_participants
  for each row execute function public.set_updated_at();

alter table public.wf_session_participants enable row level security;

-- No insert or delete grant at all -- every row is created by wf_confirm_session_invitation();
-- a participant's history in a session is never removed.
revoke all on public.wf_session_participants from authenticated;
grant select on public.wf_session_participants to authenticated;
-- Self-service progress toggles only -- status/admission_confirmed excluded (status changes only
-- via wf_confirm_session_invitation() for the invited->confirmed step in this phase; later steps
-- and admission approval are Phase 5). A participant may mark their own device/avatar checklist
-- items complete directly; a manager approving admission is also excluded here since that is a
-- credit/approval-sensitive action, not a self-service one.
grant update (device_check_completed, avatar_ready) on public.wf_session_participants to authenticated;

-- ---------------------------------------------------------------------------
-- wf_session_credit_ledger -- append-only, idempotent (spec section 11). See file header for why
-- this is a separate, namespaced ledger rather than reusing Q4K's own credit_ledger/wallets.
-- ---------------------------------------------------------------------------
create table public.wf_session_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.wf_sessions (id) on delete cascade,
  church_id uuid not null references public.churches (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete set null,
  entry_type text not null check (entry_type in ('host_pool_commit', 'participant_charge', 'reversal')),
  delta integer not null,
  reason text,
  idempotency_key text not null unique,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index wf_session_credit_ledger_session_id_idx on public.wf_session_credit_ledger (session_id);

alter table public.wf_session_credit_ledger enable row level security;

revoke all on public.wf_session_credit_ledger from authenticated;
grant select on public.wf_session_credit_ledger to authenticated;
-- No insert/update/delete grant at all -- every row is written by wf_approve_session_proposal()
-- (host_pool_commit) or wf_confirm_session_invitation() (participant_charge), both SECURITY
-- DEFINER and not subject to this grant.

-- ---------------------------------------------------------------------------
-- wf_approve_session_proposal -- Review/Approve/Reject Proposal (WF-03). Org managers only, same
-- authority scope as every other approval action in this build (wf_approve_decision_stage, 0046;
-- wf_decision_invitation_requests review, 0045). On approval: creates the wf_sessions row and, for
-- a host_covered proposal with a credit pool, commits it as a single ledger entry -- both in the
-- same transaction as the status change, so a session can never exist without its approval record,
-- and a host-covered session can never exist without its pool being recorded.
-- ---------------------------------------------------------------------------
create or replace function public.wf_approve_session_proposal(p_proposal_id uuid, p_decision text, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_proposal public.wf_session_proposals;
  v_session_id uuid;
begin
  if p_decision not in ('approved', 'rejected', 'changes_requested') then
    raise exception 'Invalid decision' using errcode = '22023';
  end if;

  select * into v_proposal from public.wf_session_proposals where id = p_proposal_id;
  if v_proposal is null then
    raise exception 'Proposal not found' using errcode = '22023';
  end if;

  if not (select private.is_church_manager(v_proposal.church_id)) then
    raise exception 'Only an organization manager may review this proposal' using errcode = '42501';
  end if;

  insert into public.wf_session_proposal_approvals (proposal_id, reviewed_by, decision, note)
  values (p_proposal_id, auth.uid(), p_decision, p_note);

  update public.wf_session_proposals
    set status = case p_decision when 'approved' then 'scheduled' when 'rejected' then 'rejected' else 'changes_requested' end
    where id = p_proposal_id;

  if p_decision <> 'approved' then
    return null;
  end if;

  insert into public.wf_sessions (
    proposal_id, decision_id, church_id, title, host_profile_id, starts_at, duration_minutes, capacity,
    admission_model, credit_pool, credit_price, requires_admission_approval,
    recording_master, recording_mobile_world, recording_vr_pov, recording_leadership_stream
  ) values (
    v_proposal.id, v_proposal.decision_id, v_proposal.church_id, v_proposal.title, v_proposal.proposed_by,
    v_proposal.starts_at, v_proposal.duration_minutes, v_proposal.capacity,
    v_proposal.admission_model, v_proposal.credit_pool, v_proposal.credit_price, v_proposal.requires_admission_approval,
    v_proposal.recording_master, v_proposal.recording_mobile_world, v_proposal.recording_vr_pov, v_proposal.recording_leadership_stream
  )
  returning id into v_session_id;

  if v_proposal.admission_model = 'host_covered' and coalesce(v_proposal.credit_pool, 0) > 0 then
    insert into public.wf_session_credit_ledger (session_id, church_id, profile_id, entry_type, delta, reason, idempotency_key, created_by)
    values (
      v_session_id, v_proposal.church_id, null, 'host_pool_commit', -v_proposal.credit_pool, 'Host credit pool committed on approval',
      'host_pool_commit:' || v_session_id::text, auth.uid()
    );
  end if;

  return v_session_id;
end;
$$;

revoke all on function public.wf_approve_session_proposal(uuid, text, text) from public;
grant execute on function public.wf_approve_session_proposal(uuid, text, text) to authenticated;

-- wf_submit_session_proposal -- moves a proposal the caller can already edit (same authorization
-- as wf_session_proposals_write_managed_owner_or_assigned_manager) from draft/changes_requested to
-- submitted. Narrow on purpose: this function only ever writes exactly that one transition, so it
-- can't be used to reach any of the review-outcome statuses that require org-manager approval.
create or replace function public.wf_submit_session_proposal(p_proposal_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_proposal public.wf_session_proposals;
  v_can_edit boolean;
begin
  select * into v_proposal from public.wf_session_proposals where id = p_proposal_id;
  if v_proposal is null then
    raise exception 'Proposal not found' using errcode = '22023';
  end if;

  select
    (select private.is_church_manager(d.church_id))
    or d.created_by = auth.uid()
    or exists (
      select 1 from public.wf_experience_assignment_managers m
      where m.assignment_id = v_proposal.experience_assignment_id and m.profile_id = auth.uid()
    )
  into v_can_edit
  from public.wf_decisions d
  where d.id = v_proposal.decision_id;

  if not coalesce(v_can_edit, false) then
    raise exception 'Not authorized to submit this proposal' using errcode = '42501';
  end if;

  if v_proposal.status not in ('draft', 'changes_requested') then
    raise exception 'Only a draft or changes-requested proposal can be submitted' using errcode = '22023';
  end if;

  update public.wf_session_proposals set status = 'submitted' where id = p_proposal_id;
end;
$$;

revoke all on function public.wf_submit_session_proposal(uuid) from public;
grant execute on function public.wf_submit_session_proposal(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- wf_confirm_session_invitation -- an invitee accepting (WF-08 "Confirm Invitation"). Creates the
-- participant row and, for a participant_paid session, charges the ledger -- idempotency_key is
-- derived from (session_id, profile_id), so a retried/duplicate client call is a safe no-op rather
-- than a double charge (the unique constraint on idempotency_key enforces this at the database
-- level, not just in application logic).
-- ---------------------------------------------------------------------------
create or replace function public.wf_confirm_session_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invitation public.wf_session_invitations;
  v_session public.wf_sessions;
begin
  select * into v_invitation from public.wf_session_invitations where id = p_invitation_id;
  if v_invitation is null then
    raise exception 'Invitation not found' using errcode = '22023';
  end if;
  if v_invitation.invited_profile_id <> auth.uid() then
    raise exception 'This invitation does not belong to you' using errcode = '42501';
  end if;

  select * into v_session from public.wf_sessions where id = v_invitation.session_id;

  update public.wf_session_invitations set status = 'confirmed' where id = p_invitation_id;

  insert into public.wf_session_participants (session_id, profile_id, status, admission_confirmed)
  values (v_invitation.session_id, auth.uid(), 'confirmed', v_session.admission_model <> 'participant_paid' and not v_session.requires_admission_approval)
  on conflict (session_id, profile_id) do nothing;

  if v_session.admission_model = 'participant_paid' and coalesce(v_session.credit_price, 0) > 0 then
    insert into public.wf_session_credit_ledger (session_id, church_id, profile_id, entry_type, delta, reason, idempotency_key, created_by)
    values (
      v_session.id, v_session.church_id, auth.uid(), 'participant_charge', -v_session.credit_price, 'Participant admission charge',
      'participant_charge:' || v_session.id::text || ':' || auth.uid()::text, auth.uid()
    )
    on conflict (idempotency_key) do nothing;
  end if;
end;
$$;

revoke all on function public.wf_confirm_session_invitation(uuid) from public;
grant execute on function public.wf_confirm_session_invitation(uuid) to authenticated;

-- wf_decline_session_invitation -- the invitee's other option at WF-08. No participant row or
-- ledger entry is ever created for a decline -- there is nothing to reverse.
create or replace function public.wf_decline_session_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invited_profile_id uuid;
begin
  select invited_profile_id into v_invited_profile_id from public.wf_session_invitations where id = p_invitation_id;
  if v_invited_profile_id is null then
    raise exception 'Invitation not found' using errcode = '22023';
  end if;
  if v_invited_profile_id <> auth.uid() then
    raise exception 'This invitation does not belong to you' using errcode = '42501';
  end if;

  update public.wf_session_invitations set status = 'declined' where id = p_invitation_id;
end;
$$;

revoke all on function public.wf_decline_session_invitation(uuid) from public;
grant execute on function public.wf_decline_session_invitation(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------------

create policy "wf_session_proposals_select_via_decision"
  on public.wf_session_proposals for select
  to authenticated
  using ((select private.can_view_wf_decision(decision_id)));

-- Insert/general-field update: org managers, the decision's creator, or a manager assigned to the
-- underlying experience assignment (wf_experience_assignment_managers) -- the proposing manager
-- per spec's session lifecycle step 4. Deliberately two separate policies (insert, update), not a
-- single `for all` -- `for all` would also cover delete, and this table's own grant above has no
-- delete privilege at all (proposals are kept for review history). A `for all` policy here would
-- have been harmless only by accident (relying on the revoked grant, not on the policy itself,
-- to block deletion) -- keeping delete entirely out of both layers removes that accident.
create policy "wf_session_proposals_insert_managed_owner_or_assigned_manager"
  on public.wf_session_proposals for insert
  to authenticated
  with check (
    exists (
      select 1 from public.wf_decisions d
      where d.id = wf_session_proposals.decision_id
        and (
          (select private.is_church_manager(d.church_id))
          or d.created_by = (select auth.uid())
          or exists (
            select 1 from public.wf_experience_assignment_managers m
            where m.assignment_id = wf_session_proposals.experience_assignment_id and m.profile_id = (select auth.uid())
          )
        )
    )
  );

create policy "wf_session_proposals_update_managed_owner_or_assigned_manager"
  on public.wf_session_proposals for update
  to authenticated
  using (
    exists (
      select 1 from public.wf_decisions d
      where d.id = wf_session_proposals.decision_id
        and (
          (select private.is_church_manager(d.church_id))
          or d.created_by = (select auth.uid())
          or exists (
            select 1 from public.wf_experience_assignment_managers m
            where m.assignment_id = wf_session_proposals.experience_assignment_id and m.profile_id = (select auth.uid())
          )
        )
    )
  )
  with check (
    exists (
      select 1 from public.wf_decisions d
      where d.id = wf_session_proposals.decision_id
        and (
          (select private.is_church_manager(d.church_id))
          or d.created_by = (select auth.uid())
          or exists (
            select 1 from public.wf_experience_assignment_managers m
            where m.assignment_id = wf_session_proposals.experience_assignment_id and m.profile_id = (select auth.uid())
          )
        )
    )
  );

create policy "wf_session_proposal_approvals_select_via_decision"
  on public.wf_session_proposal_approvals for select
  to authenticated
  using (
    exists (
      select 1 from public.wf_session_proposals p
      where p.id = wf_session_proposal_approvals.proposal_id and (select private.can_view_wf_decision(p.decision_id))
    )
  );

create or replace function private.can_view_wf_session(p_session_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.wf_sessions s
    where s.id = p_session_id
      and (
        private.can_view_wf_decision(s.decision_id)
        or s.host_profile_id = auth.uid()
        or exists (select 1 from public.wf_session_invitations i where i.session_id = s.id and i.invited_profile_id = auth.uid())
        or exists (select 1 from public.wf_session_participants sp where sp.session_id = s.id and sp.profile_id = auth.uid())
      )
  );
$$;

revoke all on function private.can_view_wf_session(uuid) from public;
grant execute on function private.can_view_wf_session(uuid) to authenticated;

create policy "wf_sessions_select_visible"
  on public.wf_sessions for select
  to authenticated
  using ((select private.can_view_wf_session(id)));

create policy "wf_sessions_update_managed_or_host"
  on public.wf_sessions for update
  to authenticated
  using ((select private.is_church_manager(church_id)) or host_profile_id = (select auth.uid()))
  with check ((select private.is_church_manager(church_id)) or host_profile_id = (select auth.uid()));

create policy "wf_session_invitations_select_visible"
  on public.wf_session_invitations for select
  to authenticated
  using ((select private.can_view_wf_session(session_id)) or invited_profile_id = (select auth.uid()));

-- Insert: org managers or the session's own host (the manager running it) -- matches spec's
-- "Manager invites employees" (session lifecycle step 8).
create policy "wf_session_invitations_insert_managed_or_host"
  on public.wf_session_invitations for insert
  to authenticated
  with check (
    exists (
      select 1 from public.wf_sessions s
      where s.id = wf_session_invitations.session_id
        and ((select private.is_church_manager(s.church_id)) or s.host_profile_id = (select auth.uid()))
    )
  );

create policy "wf_session_participants_select_visible"
  on public.wf_session_participants for select
  to authenticated
  using ((select private.can_view_wf_session(session_id)) or profile_id = (select auth.uid()));

-- Update (device_check_completed/avatar_ready only, per the column grant above): the participant
-- themselves, self-reporting their own onboarding progress.
create policy "wf_session_participants_update_self"
  on public.wf_session_participants for update
  to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

create policy "wf_session_credit_ledger_select_visible"
  on public.wf_session_credit_ledger for select
  to authenticated
  using ((select private.can_view_wf_session(session_id)));

commit;

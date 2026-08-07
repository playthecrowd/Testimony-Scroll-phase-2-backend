-- Fixes three problems in migration 0046_workforce_workspace.sql's write policies, discovered
-- while auditing every `for all` policy across the Workforce migrations for the same
-- default-privilege class of gap that 0047 already fixed on profiles/churches: an unexamined
-- `for all` policy silently inherits whatever this project's default table-creation privilege
-- grants (full arwdDxtm), not just the commands this migration's own explicit `grant` statements
-- intended.
--
-- 1. Unintended DELETE exposure: wf_decision_stages_write_managed_owner_or_stage_owner used
-- `for all`, which also covers DELETE. No `grant delete` was ever issued for this table, but this
-- project's default table-creation privilege (see 0047's finding) grants it anyway -- and unlike
-- the tables where that was harmless (no permissive DELETE policy at all, so RLS blocks the
-- command regardless of the grant), this table's `for all` policy DOES supply a permissive
-- using-clause for DELETE, so deletion was actually possible for an org manager or the decision's
-- creator. Nothing in the app does this, and the stage-tracking model assumes exactly 7 rows
-- always exist per decision -- deleting one would corrupt it.
--
-- 2. Insert-authorization mismatch: ensureDecisionStages() (services/supabase/workforceStages.ts)
-- lazily seeds all 7 stage rows for ANY profile who opens the Workspace page, including a plain
-- department employee with decision visibility but no manager/creator/owner standing. The old
-- policy's WITH CHECK only allowed org managers, the decision's creator, or a row whose
-- owner_profile_id already equals the caller -- a freshly-seeded row has owner_profile_id null, so
-- that branch never applies either. Net effect: the first non-manager, non-creator viewer to open
-- a decision's Workspace before anyone else had would hit an RLS insert failure. Seeding a stage
-- row is not sensitive (it only materializes default status derived from wf_decisions.status,
-- already visible to this profile) -- insert authorization is widened to decision-visibility,
-- matching the read policy, while update stays restricted to owner/manager/creator as before.
--
-- 3. Unintended UPDATE exposure on wf_experience_assignments and wf_experience_assignment_managers:
-- both also use `for all` policies, and both had an explicit `grant insert, delete` but no `grant
-- update` statement at all -- the app itself never updates either table (only inserts and
-- deletes, per services/supabase/workforceExperiences.ts), so no update grant was ever meant to
-- exist. But `for all`'s using/with-check clauses apply to UPDATE too, and the un-revoked default
-- privilege still grants it -- meaning a department leader or manager could currently update an
-- existing assignment's decision_id or experience_template_id in place (reassigning it to an
-- unrelated decision) instead of the intended insert-a-new-row/delete-the-old-row shape. Revoking
-- update removes a capability the app never offered and never needed, not a real feature.
--
-- 4. INSERT was never column-restricted on wf_decision_stages -- widening insert authorization to
-- decision-visibility (point 2 above) makes this a real, not just theoretical, problem: any
-- decision-visible profile could INSERT a stage row directly with approved_at/approved_by already
-- set, before ensureDecisionStages() ever seeds it. Because ensureDecisionStages only inserts
-- stage keys that don't already exist, that forged row would silently stand in as "already
-- approved" from then on -- a genuine bypass of the Leadership Approval gate, not merely a data
-- cleanliness issue. Column-restricting INSERT the same way UPDATE already is closes this.

begin;

drop policy if exists "wf_decision_stages_write_managed_owner_or_stage_owner" on public.wf_decision_stages;

revoke insert, delete on public.wf_decision_stages from authenticated;
grant insert (
  decision_id, stage_key, sort_order, status, owner_profile_id, objective, deliverables, due_date, requires_approval, started_at, completed_at
) on public.wf_decision_stages to authenticated;

create policy "wf_decision_stages_insert_decision_visible"
  on public.wf_decision_stages for insert
  to authenticated
  with check ((select private.can_view_wf_decision(decision_id)));

create policy "wf_decision_stages_update_managed_owner_or_stage_owner"
  on public.wf_decision_stages for update
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

revoke update on public.wf_experience_assignments from authenticated;
revoke update on public.wf_experience_assignment_managers from authenticated;

commit;

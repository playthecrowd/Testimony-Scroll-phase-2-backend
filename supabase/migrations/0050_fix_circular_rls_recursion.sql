-- Fixes a genuine, severe bug in migration 0045_workforce_decisions.sql, discovered while testing
-- Phase 4 with a real impersonated-role query (not just a policy-count check, which is all the
-- earlier phases were verified with -- that check confirms policies exist, not that they actually
-- execute without error): wf_decisions_select_visible and wf_decision_participants_select_via_decision
-- reference each other directly via raw subqueries. Postgres has to fully expand both policies to
-- answer either one, detects the cycle, and refuses with "infinite recursion detected in policy
-- for relation wf_decision_participants" (SQLSTATE 42P17) -- on a PLAIN, unfiltered
-- `select * from wf_decisions` as any ordinary authenticated user. This has been live and broken
-- since Phase 2 was applied; Phase 3 and Phase 4 both build directly on top of it.
--
-- Root cause and fix: a raw `exists (select 1 from other_rls_table ...)` inside a policy forces
-- Postgres to apply that OTHER table's own RLS policy to evaluate the subquery. If that other
-- policy references back to the first table, the cycle is real, not just theoretical --
-- `private.is_church_manager` (0003) already avoided this by being a SECURITY DEFINER function,
-- whose internal queries run as the function owner and bypass RLS entirely (the owner is exempt
-- from RLS by default, same as any table owner). `private.can_view_wf_decision` (0048) already
-- exists for exactly this purpose but wasn't used to fix 0045's own two policies, since 0048 was
-- written after 0045 was already applied. This migration routes both policies through it,
-- replacing the raw cross-table subqueries with a single self-contained SECURITY DEFINER call that
-- cannot recurse.

begin;

drop policy if exists "wf_decisions_select_visible" on public.wf_decisions;

create policy "wf_decisions_select_visible"
  on public.wf_decisions for select
  to authenticated
  using ((select private.can_view_wf_decision(id)));

drop policy if exists "wf_decision_participants_select_via_decision" on public.wf_decision_participants;

create policy "wf_decision_participants_select_via_decision"
  on public.wf_decision_participants for select
  to authenticated
  using ((select private.can_view_wf_decision(decision_id)));

commit;

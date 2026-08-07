-- Fixes a real, live bug found during manual browser smoke-testing (not caught by any earlier
-- SQL-level verification, including the impersonation tests in this same checkpoint): creating a
-- decision through the actual UI failed every time with "new row violates row-level security
-- policy for table wf_decisions" (PostgREST 403), even for an org manager who unambiguously has
-- insert authorization.
--
-- Root cause, isolated empirically: `services/supabase/workforceDecisions.ts`'s createDecision
-- does `.insert({...}).select("*").single()`, which PostgREST translates to
-- `INSERT ... RETURNING *`. A RETURNING clause must also satisfy the table's own SELECT policy for
-- each returned row. wf_decisions_select_visible (fixed in 0050 to close the circular-RLS bug)
-- now reads `using ((select private.can_view_wf_decision(id)))` -- and that function's own body
-- re-queries `public.wf_decisions` itself to answer "is this id visible." Confirmed by direct
-- testing: a bare `insert ... returning id` reproduces the 403 every time, while the exact same
-- insert without RETURNING, or a plain SELECT on the row from a *separate* statement immediately
-- afterward (same transaction), both succeed without error. This is a genuine Postgres RLS
-- interaction -- a SECURITY DEFINER function's own internal self-referential re-query of the table
-- currently being inserted into does not reliably see that statement's own not-yet-returned row
-- during RETURNING evaluation, even though it does see it as of the very next statement.
--
-- This narrow bug shape (a SELECT policy's SECURITY DEFINER helper re-querying the SAME table an
-- insert targets) does not recur anywhere else in this build: every other policy using
-- can_view_wf_decision/can_view_wf_session checks a DIFFERENT table than the one being written to
-- (e.g. wf_session_proposals' own policy calls can_view_wf_decision, which queries wf_decisions,
-- not wf_session_proposals) -- confirmed by inspection, not just assumption, before concluding
-- this is the only fix needed.
--
-- Fix: add a direct, function-free fast path (`created_by = auth.uid()`) ahead of the function
-- call. A simple column comparison against the row literally being returned has no re-query to
-- fail on, and "the decision's own creator can always see it" is true regardless of any other
-- visibility rule anyway -- this isn't a workaround bolted on for its own sake, it's a real,
-- independently-correct rule that also happens to sidestep the Postgres quirk entirely for the
-- one case that actually needs it (a freshly created row, in the same statement, before any
-- participant/role-assignment row could exist for it).

begin;

drop policy if exists "wf_decisions_select_visible" on public.wf_decisions;

create policy "wf_decisions_select_visible"
  on public.wf_decisions for select
  to authenticated
  using (
    created_by = (select auth.uid())
    or (select private.can_view_wf_decision(id))
  );

commit;

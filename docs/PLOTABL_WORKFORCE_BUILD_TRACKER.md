# Plotabl Workforce — Build Tracker

Source handoff: `plotabl-workforce-complete-claude-handoff.zip` (received 2026-08-07), containing
`PLOTABL_WORKFORCE_MODULE_BUILD_SPEC.md`, `PLOTABL_WORKFORCE_UI_CONTENT_AND_SCREEN_GUIDE.md`,
`plotabl-workforce-mock-data.json`, and a concept-screenshot package. This tracker is the
checkpoint log the build spec's own §24 ("Claude execution instructions") requires — one approved
checkpoint at a time, nothing marked "approved" by me, only "Ready for Review."

## Scope decision (confirmed with user, 2026-08-07)

The build spec assumes a "Plotabl Central" shared identity/tenant/module layer already exists
(§4, §13 "Shared platform tables": `organizations`, `modules`, `module_entitlements`,
`role_assignments`). **It doesn't** — this repo (`qftk` / Quest for the Kingdom) is single-tenant:
one Supabase project, one `churches` table serving as the entity table for both Church and
Organization accounts (`account_type: 'host' | 'member' | 'organization'`, added in migration
0041), no multi-tenant or module-entitlement concept, no existing feature-flag convention.

Given that gap, two paths were possible: build the generalized platform layer first (matches the
spec literally, large scope, touches how every account authenticates), or build Workforce as a
self-contained, namespaced feature that approximates tenancy without becoming general platform
infrastructure. **User chose the self-contained build.** Concretely:

- **Organization accounts are the tenant boundary** — reusing the existing
  `churches` (`entity_type = 'organization'`) + `account_type` pattern, the same way Organization
  parity was bolted onto the existing Church model rather than requiring a schema rebuild.
- All new tables are namespaced `wf_*`, scoped to one organization (`churches.id`) each, RLS
  deny-by-default, following this repo's `private.is_church_manager`-style established pattern
  rather than inventing new authorization primitives.
- No generalized `modules`/`module_entitlements`/`role_assignments` platform layer gets built.
  Module access is a Workforce-specific check (organization has Workforce enabled), not a
  reusable multi-module entitlement system. If a second module is ever commissioned, it gets its
  own equivalent scoping — that's an explicit, accepted tradeoff of this decision, not an oversight.
- Everything else in the spec (role hierarchy, decision lifecycle, session lifecycle, UI content
  guide, terminology) is followed as written — the scope reduction is specifically about *platform
  identity/tenancy infrastructure*, not about cutting Workforce's own functionality.

## Non-negotiable safety boundary (from spec §2, restated)

Quest for the Kingdom stays live and untouched throughout this build. No modification to Q4K's
production deployment, domain, database data, storage, auth config, migrations, environment
variables, or production branch. No reuse of the Q4K production schema as a dev sandbox. No
destructive/broad migrations against a shared database. No renaming/removing existing Q4K tables,
columns, policies, buckets, routes, or env vars. No merge to `main`/`Production` during this build
without going through the same explicit-approval process the rest of this codebase's work does.

## Phase 0 — Audit and isolation: **Ready for Review**

Completed 2026-08-07:

- Confirmed target platform match (QA email domain `@qa.quest4thekingdom.com` in the handoff's
  mock data matches this repo exactly).
- Read-only audit: no existing `organizations`/`modules`/`role_assignments`/tenant tables, no
  existing feature-flag convention, single Supabase project (one `NEXT_PUBLIC_SUPABASE_URL` /
  service role key pair in `.env.example`), migrations run through `0043`.
- Rollback baseline recorded:
  - `main` @ `84dd59a4695fbe88db35504b7356f935190cf74f` ("Merge pull request #2 from
    Plotabl-Development/feature/kingdom-scrolls-world")
  - `Production` @ `d67824690f59d9b1cbcc5a1d1533e046da69ce4e` (merge of `main` into `Production`)
  - Both branches include everything through migration `0043` — confirmed via
    `git ls-tree origin/main -- supabase/migrations`.
- Created isolated branch `feature/plotabl-workforce-module` from `origin/main` (not from any
  in-progress Q4K feature branch, so this work carries zero unrelated Q4K diff).
- Scope decision recorded above.

**Not yet done, deliberately deferred to avoid unapproved scope creep**: an actual
build/lint/test health-check run on this baseline, and inspection of the concept-screenshot ZIP's
image contents. Neither blocks Phase 1 planning; both are cheap to run when Phase 1 starts.

## Phase 1 — Module shell: **Ready for Review**

Built 2026-08-07, not yet applied to any database and not yet committed:

- `NEXT_PUBLIC_ENABLE_WORKFORCE_MODULE` feature flag, documented in `.env.example`. `/workforce`
  calls `notFound()` unless it's exactly `"true"` — the route doesn't exist for a deployment that
  hasn't set it, same as any other unreleased route in this codebase.
- `supabase/migrations/0044_workforce_module_shell.sql` (new, additive only): three tables --
  `wf_module_settings` (per-org enablement flag), `wf_departments` (org-scoped, org-manager-only
  writes), `wf_role_assignments` (the six Workforce roles with no existing equivalent --
  `stakeholder`, `department_leadership`, `manager`, `employee`, `intern`, `vendor`; a check
  constraint enforces `department_id` is required for the two department-scoped roles and
  forbidden for the three org-scoped ones). `platform_owner`/`enterprise_owner` are deliberately
  **not** new roles — they reuse `profiles.is_platform_admin` and `private.is_church_manager`
  respectively, exactly the reuse `0038_campaign_lessons.sql` already established for its own admin
  bypass. RLS is deny-by-default on all three tables: reads are org-manager-or-self, writes are
  org-manager-only for this phase (the spec's fuller chain-of-command delegation is deferred to
  Phase 2/3, once there's an actual decision/session for an invitation to be scoped to).
- `services/supabase/workforce.ts`: `getWorkforceAccess` (is this profile entitled for this org --
  combines the module flag, `is_church_manager`, and any `wf_role_assignments` rows) and
  `getMyWorkforceOrganizations` (every org the signed-in profile can reach a Workforce screen for).
- `app/workforce/page.tsx`: the shell page itself — signed out → `/login` (also edge-guarded via
  `proxy.ts`'s `PROTECTED_PATHS`, now including `/workforce`), signed in with no entitled org →
  a plain not-yet-available state, entitled → a bare list of reachable orgs. This is scaffolding
  to prove the plumbing, not the Decision Pool (Phase 2).
- Types added to `types/index.ts`: `WorkforceModuleSettings`, `WorkforceDepartment`,
  `WorkforceRole`, `WorkforceRoleAssignment`, `WorkforceAccess`.
- Verified: `npx tsc --noEmit` clean, `npm run lint` clean (15 pre-existing `<img>` warnings
  elsewhere, nothing from new files), `npm test` 566/566 passing, `npm run build` succeeds with
  `/workforce` listed as a dynamic (`ƒ`) route alongside every other guarded route.

Migration applied to the linked Supabase project 2026-08-07 (verified: all 3 tables exist, policy
counts match the file exactly — 4/3/4). Committed as `d4c64dd`.

QA identity seeding remains deferred to a later phase (once there's an actual
decision/org worth seeding QA data against), and the spec's suggested alias format
(`maya.chen@qa.quest4thekingdom.com`) still doesn't match this repo's actual established
convention (`qa.<label>@qa.quest4thekingdom.com`, confirmed in `scripts/qaSeed.ts`) — worth
reconciling when the seed script is actually extended, not now.

## Phase 2 — Decision Pool + expanded preview: **Ready for Review**

Built 2026-08-07:

- `supabase/migrations/0045_workforce_decisions.sql` (new, additive): `wf_decisions` (11-value
  flat `status`, distinct from the future stage-engine's own state -- see the migration's file
  header), `wf_decision_participants` (decision-scoped team membership, separate from Phase 1's
  org/department-scoped `wf_role_assignments`), `wf_decision_invitation_requests` (backs the three
  WF-02 invite actions). `wf_allocate_decision_number()` (SECURITY DEFINER) issues human-readable
  `D-XXXX` numbers from a new `wf_module_settings.next_decision_seq` counter and doubles as the
  creation-time authorization check (manager or org-wide `stakeholder` role).
  A real gap found and fixed in the same migration: `public.profiles` only ships
  `profiles_select_own` and `profiles_select_managed_church_members` (managers only) — neither let
  an ordinary Workforce participant resolve another participant's or a decision owner's display
  name. Added `profiles_select_workforce_org_peers` (any `wf_role_assignments` holder in org X can
  read profiles of org X's members), the minimum fix, same bounded-by-org shape as the existing
  manager policy.
- `services/supabase/workforceDecisions.ts`: `listDecisions`/`getDecision`/`createDecision`,
  `getDecisionParticipants`/`trackDecision`, `listInvitationRequests`/`createInvitationRequest`/
  `reviewInvitationRequest`, `findOrgMemberByEmail` (org-scoped, backs "Request a Specific
  Person").
- `services/supabase/workforce.ts`: added `listDepartments`.
- UI: `/workforce/decisions` (WF-01 catalog — search/status/department/scope filters, "New
  Decision"), `/workforce/decisions/new` (create form), `/workforce/decisions/[decisionId]` (WF-02
  preview — intent/outcome/owner/stakeholder/priority/target date/security, "Track This Decision",
  the three invite actions, participant list, manager approve/decline for pending requests, other-
  decisions rail). `components/workforce/`: `DecisionCard`, `WorkforceDecisionStatusBadge` (labels
  match the UI content guide's approved status vocabulary exactly), `DecisionPoolClient`,
  `NewDecisionForm`, `DecisionPreviewClient`.
- Verified: `tsc` clean, `lint` clean (one real `react-hooks/set-state-in-effect` error caught and
  fixed by switching to this codebase's own established cancelled-flag/async-IIFE effect pattern
  from `app/lessons/page.tsx`, rather than a `useCallback`-wrapped loader), `test` 566/566, `build`
  succeeds with all four new routes listed as guarded dynamic routes. Migration applied to the
  linked Supabase project, verified (policy counts match: profiles 4, wf_decisions 3,
  wf_decision_participants 3, wf_decision_invitation_requests 3). Committed.

**Deliberately deferred, not oversights** (see migration 0045's file header for the full
reasoning): the Pathway/stage-engine (7-stage tracking UI, transition history) is Phase 3's job —
`wf_decisions.status` is the flat card-facing status, not that state machine. Files and a real
audit trail are static empty states for now. Full chain-of-command invitation approval (a request
routing to the target's *own* manager, not an org manager) is deferred the same way Phase 1
deferred delegated role-assignment writes — org managers approve every invitation request in this
phase. Visual treatment follows the UI content guide's copy/terminology exactly but not yet its
"3D land tiles, glowing roots" visual direction (§1 of the UI guide) — that's a design pass, not
Phase 2 plumbing.

## Phase 3 — Decision Workspace tracking + Department Breakout: **Ready for Review**

Built 2026-08-07:

- `supabase/migrations/0046_workforce_workspace.sql` (new, additive): `wf_decision_stages` (7
  pathway stages per decision, same status vocabulary as `wf_decisions.status` -- see the
  migration's file header), `wf_decision_stage_transitions` (append-only history),
  `wf_decision_feedback` (immutable, open to anyone who can see the decision),
  `wf_experience_templates` (the 8 Future Factory experience use cases, seeded platform-wide),
  `wf_experience_assignments` + `wf_experience_assignment_managers` (Department Leadership's
  "Select & Assign" + manager assignment). `wf_approve_decision_stage()` RPC keeps Leadership
  Approval authority with org managers only, via a column-level `revoke`/`grant` on
  `approved_by`/`approved_at` (see the security note below for why the revoke matters).
- `services/supabase/workforceStages.ts`, `services/supabase/workforceExperiences.ts`.
- UI: `/workforce/decisions/[decisionId]/workspace` -- Pathway (stage tracker, Advance/Approve
  actions, transition history, feedback thread) + Department Breakout (role track, experience
  catalog, Select & Assign, manager assignment) on one page. Linked from the Decision Preview via
  a new "Open Decision Workspace" button.
- Verified: `tsc`/`lint`/`test` (566/566)/`build` all clean. Migration applied and verified (policy
  counts match exactly: 2/2/2/1/2/2 across the six new tables).

**Deferred**: Session proposals (WF-03's "Propose Session"/"Review Proposal"/"Approve Proposal")
are Phase 4 scope -- nothing here creates a session. Spec stages 9-10 (Intern/Apprentice Transfer,
Community/STEM Pathway) are "when approved" branches off the main pathway, not modeled yet.
"Customize with Plotabl" is folded into Select & Assign's optional notes field rather than a
separate record type.

### Security finding made while verifying this phase (unrelated to Workforce itself)

While confirming the column-level grant restriction on `wf_decision_stages.approved_at`/
`approved_by` actually worked, discovered it silently didn't -- and that the same gap was live on
two pre-existing Q4K tables. Root cause: this Supabase project carries a default privilege
(`ALTER DEFAULT PRIVILEGES`, set outside any migration file) that grants `authenticated` full
`arwdDxtm` on every new table automatically; a plain `grant update (cols)` only ever *adds*
privileges, it can't narrow what the default already granted -- an unconditional `revoke` first is
required, exactly the shape migration 0043 already uses for `lesson_question_choices.is_correct`.

Confirmed live and fixed in `supabase/migrations/0047_restore_column_grant_lockdowns.sql`:

- **`public.profiles`** -- `authenticated` had UPDATE on every column, including
  `is_platform_admin`, `email`, `account_type`. Practical risk was fully mitigated by an
  independent trigger (`protect_profile_columns`, 0003) that already blocked those specific
  columns for every role but `postgres`/`service_role` -- so this was defense-in-depth restoration,
  not an open exploit. Restored to the originally-intended `full_name, avatar_url` only.
- **`public.churches`** -- `authenticated` had UPDATE on every column, including `slug`,
  `member_count`, `status`, `is_demo`, `created_by`, `entity_type`, `timezone`. No comprehensive
  trigger covers these (only `entity_type` has one, `protect_church_entity_type`, 0041) --
  **this one was a real, live, exploitable gap**: any church/org manager could directly update
  their own church's slug, status, member count, or demo flag via a plain client call, bypassing
  every app-level control. Restored to the originally-intended 13-column list from
  `0004_rls.sql`/`0010_church_profile_fields.sql`.
- Verified with a genuine `SET LOCAL ROLE authenticated` + `request.jwt.claims` impersonation test
  (wrapped in a rolled-back transaction, no data touched): legitimate columns
  (`profiles.full_name`, `churches.description`) still update successfully; the previously-exposed
  columns (`profiles.is_platform_admin`, `churches.slug`) now correctly return
  "permission denied."
- **Explicitly not touched**: `public.lessons` and `public.testimonies` were also flagged by the
  same audit pattern but turned out to be false positives -- both carry an *unrestricted*
  `grant insert, update on ... to authenticated` from their very first migration (0004, 0018),
  meaning full column access there was always deliberate, with RLS as the only intended gate. Their
  later `grant update (featured)`-style statements are redundant, not narrowing attempts.
- **Separately observed, deliberately not fixed here** (different bug class): `churches.verified`
  is correctly in the restored grant list by original design, but `churches_update_managed` RLS
  doesn't distinguish a platform admin from an ordinary host/manager of their own church -- so any
  host can currently self-verify their own church directly, bypassing the admin-only
  `updateChurchVerified()` action path. This is an RLS/app-authorization-scope question, not a
  default-privilege grant bug, and needs its own decision before touching it.

### Critical fix found while building Phase 4: Phase 2's Decision Pool was live-broken

While testing Phase 4 with a **genuine impersonated-role query** (not just the policy-count check
every earlier phase's verification relied on -- that only confirms policies exist, not that they
execute without error), discovered that `wf_decisions_select_visible` and
`wf_decision_participants_select_via_decision` (both `0045_workforce_decisions.sql`, applied since
Phase 2) reference each other directly via raw subqueries. Postgres detects the cycle and refuses
with `infinite recursion detected in policy for relation "wf_decision_participants"` (SQLSTATE
42P17) on a **plain, unfiltered `select * from wf_decisions`** as any ordinary authenticated user.
This has been live and broken since Phase 2 was applied -- the Decision Pool, Decision Preview, and
everything Phase 3/4 build on top of them were never actually functional for a real signed-in user,
only for the service-role-backed verification queries used to check schema/policy shape.

Fixed in `supabase/migrations/0050_fix_circular_rls_recursion.sql`: both policies now route through
`private.can_view_wf_decision()` (the SECURITY DEFINER helper introduced in 0048) instead of a raw
cross-table subquery -- a SECURITY DEFINER function's internal queries bypass RLS entirely (it runs
as the function owner, exempt from RLS the same way any table owner is), which is exactly why
`private.is_church_manager` (0003) never had this problem despite doing conceptually the same kind
of cross-table check. Verified with a real impersonation smoke test hitting a plain `select` against
all 18 Workforce tables -- confirmed the fix resolves it and confirmed no other table has the same
latent cycle.

**Lesson for every migration from here on**: a policy that needs to check another RLS-enabled
table's condition must go through a SECURITY DEFINER helper, never a raw subquery on that table --
the two-way case is exactly what breaks, and it will not surface in a policy-count check, only in
an actual query.

### Other fixes bundled into this checkpoint (0049)

Auditing every `for all` policy across the Workforce migrations for the same default-privilege
class of gap 0047 already found (see Phase 3's own section above) turned up three more real issues
in already-applied `0046_workforce_workspace.sql`, all fixed in
`supabase/migrations/0049_fix_wf_decision_stages_write_policy.sql`:

- `wf_decision_stages` allowed DELETE (never intended -- the pathway model assumes exactly 7 rows
  always exist per decision) purely because its `for all` policy inherited the un-revoked default
  DELETE grant.
- `wf_decision_stages`' INSERT authorization only allowed managers/creator/the row's own owner --
  but `ensureDecisionStages()` seeds all 7 rows for **any** decision-visible viewer, including a
  plain department employee opening the Workspace before anyone else had. Widened INSERT to
  decision-visibility (seeding a default-derived row isn't sensitive).
- `wf_experience_assignments`/`wf_experience_assignment_managers` allowed UPDATE (e.g. reassigning
  an existing assignment's `decision_id` in place) despite the app only ever inserting/deleting --
  no `grant update` was ever issued, but the un-revoked default privilege supplied it anyway via
  the same `for all` shape.

A fourth, more serious variant of the same pattern was caught and fixed **before** ever being
applied (both `0048` and the `wf_decision_stages` fix in `0049` were still uncommitted at the
time): none of `wf_decision_stages`, `wf_session_proposals`, or `wf_session_invitations` had their
**INSERT** grant column-restricted, only UPDATE -- meaning a client could INSERT a brand-new row
with a sensitive column already forged (`approved_at`/`approved_by` on a stage, `status: 'approved'`
on a proposal), bypassing the SECURITY DEFINER function meant to be the only path to those values.
For `wf_decision_stages` specifically this was a real, not just theoretical, bypass of the
Leadership Approval gate: `ensureDecisionStages()` only seeds a stage key that doesn't already
exist, so a pre-forged row would silently stand in as "already approved" forever after. All three
now column-restrict INSERT the same way UPDATE already does. Verified with a targeted impersonation
test confirming each forged insert is rejected and a legitimate insert (allowed columns only)
is not.

## Phase 4 — Session proposal, approval, scheduling, and onboarding: in progress

Schema built and verified 2026-08-07 (`supabase/migrations/0048_workforce_sessions.sql`):
`wf_session_proposals` (WF-03's proposal fields -- audience, capacity, admission model, credits,
recording flags, content classification), `wf_session_proposal_approvals` (append-only review
history), `wf_sessions` (created only on approval, carries a `join_token` for a future single-click
email link -- not used as a bare public entry point this phase, since every participant is an
authenticated Plotabl Workforce user per the spec's own role hierarchy), `wf_session_invitations`,
`wf_session_participants` (status vocabulary already includes the later live-session values Phase 5
will set), and `wf_session_credit_ledger` -- a **separate, namespaced** append-only ledger, not
Q4K's own `credit_ledger`/wallet tables (different currency, different product -- folding them
together would violate this module's own isolation boundary for no benefit). Four RPCs:
`wf_approve_session_proposal` (review outcome + atomically creates the session and, for a
host-covered pool, its ledger commit), `wf_submit_session_proposal`, `wf_confirm_session_invitation`
(idempotent participant creation + admission charge), `wf_decline_session_invitation`.

UI (proposal creation from an assigned experience, proposal list/detail with approve/reject,
invitation management, employee-facing confirm/waiting-room screen) not yet built -- picking up
next.

## Phases 5–8

Tracked as tasks #80–#83 in the session task list; unstarted. Each depends on the prior phase's
approval. Full detail for each is in `PLOTABL_WORKFORCE_MODULE_BUILD_SPEC.md` §21 and won't be
duplicated here until that phase is actually being scoped, to avoid this tracker drifting out of
sync with a plan written before its own schema exists.

## Source files

Extracted to
`%LOCALAPPDATA%\Temp\claude\...\scratchpad\plotabl-workforce-handoff\` this session (not committed
to the repo — scratch-space only). If this build continues in a future session, re-extract from
`C:\Users\cotye\Downloads\plotabl-workforce-complete-claude-handoff.zip` or ask the user for the
package again if it's no longer in Downloads.

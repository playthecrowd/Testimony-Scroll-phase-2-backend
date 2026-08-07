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

**Not yet done, deliberately**: the migration has not been applied to the shared Supabase project
(this repo has no separate isolated QA project — `scripts/qaSeed.ts`'s own header confirms
Production/main/QA all share one database pre-launch — so applying it is a real, if additive,
change to a live shared system and gets the same one-time-confirm-before-applying treatment every
migration in this codebase's history has gotten). QA identity seeding is deferred to Phase 2:
seeding Workforce roles/departments has no test value until there's an actual decision/org to seed
them against, and the spec's suggested alias format (`maya.chen@qa.quest4thekingdom.com`) doesn't
match this repo's actual established convention (`qa.<label>@qa.quest4thekingdom.com`, confirmed
in `scripts/qaSeed.ts`) — worth reconciling when the seed script is actually extended, not now.
Nothing has been committed yet.

## Phases 2–8

Tracked as tasks #77–#83 in the session task list; unstarted. Each depends on the prior phase's
approval. Full detail for each is in `PLOTABL_WORKFORCE_MODULE_BUILD_SPEC.md` §21 and won't be
duplicated here until that phase is actually being scoped, to avoid this tracker drifting out of
sync with a plan written before Phase 1's actual schema exists.

## Source files

Extracted to
`%LOCALAPPDATA%\Temp\claude\...\scratchpad\plotabl-workforce-handoff\` this session (not committed
to the repo — scratch-space only). If this build continues in a future session, re-extract from
`C:\Users\cotye\Downloads\plotabl-workforce-complete-claude-handoff.zip` or ask the user for the
package again if it's no longer in Downloads.

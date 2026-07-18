import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

// Multi-tenant isolation regression guard for PHASE 1 (docs/PHASE1_AUDIT.md).
//
// This repo has no Supabase project/credentials wired into `npm test` in this environment, so a
// true "sign in as Host A, assert Host B's church is invisible" integration test can't run here
// -- see the manual QA checklist in docs/PHASE1_AUDIT.md for that verification instead. This is
// the automated substitute available without a live database: it statically reads every RLS
// policy defined across supabase/migrations/*.sql and fails if a church-scoped table ever gets a
// bare `using (true)` policy (the exact shape a cross-church leak would take), or if the
// church-manager read policy the real Host Dashboard now depends on (0009) goes missing.

const MIGRATIONS_DIR = path.join(__dirname, "..", "supabase", "migrations");

function readAllMigrations(): string {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(path.join(MIGRATIONS_DIR, f), "utf8"))
    .join("\n");
}

const sql = readAllMigrations();

// One chunk per `create policy` statement, truncated at that statement's own terminating
// semicolon -- so each check only ever looks at that one policy's USING/WITH CHECK clause, never
// bleeding into whatever unrelated table/grant/comment happens to follow it in the file before
// the next `create policy` keyword appears (a table definition sitting between two policies would
// otherwise get folded into the first policy's chunk and could false-match its table name).
const policyChunks = sql
  .split(/(?=create policy)/gi)
  .filter((c) => c.trim().toLowerCase().startsWith("create policy"))
  .map((c) => {
    const semiIdx = c.indexOf(";");
    return semiIdx === -1 ? c : c.slice(0, semiIdx + 1);
  });

function policiesOn(table: string): string[] {
  const re = new RegExp(`on public\\.${table}\\b`, "i");
  return policyChunks.filter((c) => re.test(c));
}

// Every table that stores per-church data. speakers/ministries/experiences are deliberately
// excluded: they're public lookup data by design, not a leak (see docs/PHASE1_AUDIT.md section 3,
// docs/PHASE3_AUDIT.md section 3c). church_invites is Phase 2 (docs/PHASE2_AUDIT.md) -- per-email
// invitations, manager-only by design. lesson_questions/lesson_experiences are Phase 3
// (docs/PHASE3_AUDIT.md) -- follow the same published-or-managed shape as lesson_media.
// church_experiences/church_experience_occurrences/church_experience_lessons are Phase 10.1
// (docs/PHASE10_EXPERIENCE_PLATFORM_SPEC.md) -- same published-or-managed shape.
// church_experience_registrations is deliberately excluded here and gets dedicated tests below,
// same reason lesson_requests/testimonies/events do: it has a distinct own-row-or-managed shape,
// not the generic published-or-managed one this array's loop checks for.
const CHURCH_SCOPED_TABLES = [
  "churches",
  "church_memberships",
  "lessons",
  "lesson_media",
  "lesson_hosts",
  "lesson_ministries",
  "church_invites",
  "lesson_questions",
  "lesson_experiences",
  "church_experiences",
  "church_experience_occurrences",
  "church_experience_lessons",
];

test("every church-scoped table has at least one RLS policy", () => {
  for (const table of CHURCH_SCOPED_TABLES) {
    assert.ok(policiesOn(table).length > 0, `Expected at least one policy on public.${table}`);
  }
});

test("no church-scoped table has a bare using(true) policy", () => {
  for (const table of CHURCH_SCOPED_TABLES) {
    for (const chunk of policiesOn(table)) {
      assert.doesNotMatch(
        chunk,
        /using\s*\(\s*true\s*\)/i,
        `A policy on public.${table} uses using(true) -- this would expose every church's rows to any authenticated user`
      );
    }
  }
});

test("every church-scoped table has at least one policy gated by private.is_church_manager", () => {
  for (const table of CHURCH_SCOPED_TABLES) {
    const managerGated = policiesOn(table).some((c) => /private\.is_church_manager/.test(c));
    assert.ok(managerGated, `Expected at least one policy on public.${table} to reference private.is_church_manager`);
  }
});

test("church_memberships allows a church manager to read the full roster (real Host Dashboard member counts)", () => {
  const managerRead = policiesOn("church_memberships")
    .filter((c) => /for select/i.test(c))
    .some((c) => /private\.is_church_manager/.test(c));
  assert.ok(managerRead, "Expected a SELECT policy on church_memberships gated by private.is_church_manager");
});

test("church_memberships still restricts self-service inserts to the caller's own member-only row", () => {
  const selfInsert = policiesOn("church_memberships").find((c) => /for insert/i.test(c));
  assert.ok(selfInsert, "Expected an INSERT policy on church_memberships");
  assert.match(selfInsert!, /profile_id\s*=\s*auth\.uid\(\)/);
  assert.match(selfInsert!, /role\s*=\s*'member'/);
});

// Phase 2 (docs/PHASE2_AUDIT.md): a real Church Member Management list needs member
// names/emails, which requires profiles to be readable beyond just the caller's own row.
test("profiles has no bare using(true) policy (member names/emails stay church-manager-gated)", () => {
  for (const chunk of policiesOn("profiles")) {
    assert.doesNotMatch(chunk, /using\s*\(\s*true\s*\)/i, "A policy on public.profiles uses using(true) -- this would expose every user's profile to anyone");
  }
});

test("profiles allows a church manager to read their own church's members' profiles", () => {
  const managerRead = policiesOn("profiles")
    .filter((c) => /for select/i.test(c))
    .some((c) => /private\.is_church_manager/.test(c));
  assert.ok(managerRead, "Expected a SELECT policy on profiles gated by private.is_church_manager");
});

test("profiles still restricts self-service updates to the caller's own row", () => {
  const selfUpdate = policiesOn("profiles").find((c) => /for update/i.test(c));
  assert.ok(selfUpdate, "Expected an UPDATE policy on profiles");
  assert.match(selfUpdate!, /id\s*=\s*auth\.uid\(\)/);
});

test("church_invites acceptance only happens through accept_church_invite, not a direct policy", () => {
  // The invitee has no UPDATE grant on church_invites at all -- only a church manager does
  // (church_invites_update_managed). Acceptance is exclusively the SECURITY DEFINER RPC's job.
  const functionMatch = sql.match(/create or replace function public\.accept_church_invite\([\s\S]*?\$\$;/);
  assert.ok(functionMatch, "Expected public.accept_church_invite to be defined");
  assert.match(functionMatch![0], /security definer/i, "accept_church_invite must be SECURITY DEFINER to redeem an invite on the caller's behalf");

  const updatePolicies = policiesOn("church_invites").filter((c) => /for update/i.test(c));
  assert.ok(updatePolicies.length > 0, "Expected an UPDATE policy on church_invites");
  for (const chunk of updatePolicies) {
    assert.match(chunk, /private\.is_church_manager/, "Every UPDATE policy on church_invites must still be manager-gated");
  }
});

// Phase 3 (docs/PHASE3_AUDIT.md section 3c): experiences is intentionally public/cross-church --
// same shape as speakers/ministries -- so it's deliberately excluded from CHURCH_SCOPED_TABLES
// above rather than accidentally caught by the using(true) check.
test("experiences is intentionally public-read, with no authenticated write policy yet", () => {
  const selectPolicies = policiesOn("experiences").filter((c) => /for select/i.test(c));
  assert.ok(selectPolicies.length > 0, "Expected a SELECT policy on experiences");
  assert.ok(
    selectPolicies.some((c) => /using\s*\(\s*true\s*\)/i.test(c)),
    "Expected experiences' SELECT policy to be public (using(true)) -- it's shared platform content, not church-owned"
  );
  const writePolicies = policiesOn("experiences").filter((c) => /for (insert|update|delete)/i.test(c));
  assert.equal(writePolicies.length, 0, "experiences should have no write policy yet -- catalog management is Phase 9, not this phase");
});

test("lesson_experiences and lesson_questions support edit-time removal (update+delete), unlike lesson_ministries", () => {
  for (const table of ["lesson_experiences", "lesson_questions"]) {
    const deletePolicies = policiesOn(table).filter((c) => /for delete/i.test(c));
    assert.ok(deletePolicies.length > 0, `Expected a DELETE policy on ${table}`);
    for (const chunk of deletePolicies) {
      assert.match(chunk, /private\.is_church_manager/, `DELETE policy on ${table} must be manager-gated`);
    }
  }
});

// Phase 5 (docs/PHASE5_AUDIT.md): lesson_requests has a distinct shape from the tables above (own-
// row + manager + a narrowly-scoped public-once-approved policy), so it gets its own dedicated
// checks rather than being folded into CHURCH_SCOPED_TABLES' generic loop.
test("lesson_requests has no bare using(true) policy -- public visibility is scoped to approved rows only", () => {
  for (const chunk of policiesOn("lesson_requests")) {
    assert.doesNotMatch(
      chunk,
      /using\s*\(\s*true\s*\)/i,
      "A policy on public.lesson_requests uses using(true) -- pending/church-directed requests must never be broadcast"
    );
  }
});

test("lesson_requests' public SELECT policy is narrowed to scope='public' and status='approved'", () => {
  const publicPolicy = policiesOn("lesson_requests").find((c) => /lesson_requests_select_public_approved/i.test(c));
  assert.ok(publicPolicy, "Expected a lesson_requests_select_public_approved policy");
  assert.match(publicPolicy!, /scope\s*=\s*'public'/);
  assert.match(publicPolicy!, /status\s*=\s*'approved'/);
});

test("lesson_requests' manager policy reuses private.is_church_manager for both church-directed and public (admin) access", () => {
  const managedPolicies = policiesOn("lesson_requests").filter((c) => /private\.is_church_manager/.test(c));
  assert.ok(managedPolicies.length > 0, "Expected at least one lesson_requests policy gated by private.is_church_manager");
});

test("lesson_requests self-service insert always starts at status='submitted'", () => {
  const insertPolicy = policiesOn("lesson_requests").find((c) => /for insert/i.test(c));
  assert.ok(insertPolicy, "Expected an INSERT policy on lesson_requests");
  assert.match(insertPolicy!, /requested_by\s*=\s*auth\.uid\(\)/);
  assert.match(insertPolicy!, /status\s*=\s*'submitted'/);
});

// Phase 6 (docs/PHASE6_AUDIT.md): testimonies has a two-stage status shape (church_status +
// platform_status) -- the real mechanism behind "a testimony must not become publicly visible
// immediately."
test("testimonies has no bare using(true) policy -- public visibility requires both statuses approved", () => {
  for (const chunk of policiesOn("testimonies")) {
    assert.doesNotMatch(
      chunk,
      /using\s*\(\s*true\s*\)/i,
      "A policy on public.testimonies uses using(true) -- pending/unapproved testimonies must never be broadcast"
    );
  }
});

test("testimonies' public SELECT policy requires visibility='public' AND both statuses='approved'", () => {
  const publicPolicy = policiesOn("testimonies").find((c) => /testimonies_select_public_approved/i.test(c));
  assert.ok(publicPolicy, "Expected a testimonies_select_public_approved policy");
  assert.match(publicPolicy!, /visibility\s*=\s*'public'/);
  assert.match(publicPolicy!, /church_status\s*=\s*'approved'/);
  assert.match(publicPolicy!, /platform_status\s*=\s*'approved'/);
});

test("testimonies' manager policy reuses private.is_church_manager for both church review and platform (admin) moderation", () => {
  const managedPolicies = policiesOn("testimonies").filter((c) => /private\.is_church_manager/.test(c));
  assert.ok(managedPolicies.length > 0, "Expected at least one testimonies policy gated by private.is_church_manager");
});

test("testimonies' status columns are protected: a church manager can't set platform_status and vice versa", () => {
  const functionMatch = sql.match(/create or replace function public\.protect_testimony_status_columns\(\)[\s\S]*?\$\$;/);
  assert.ok(functionMatch, "Expected public.protect_testimony_status_columns to be defined");
  const body = functionMatch![0];
  assert.match(body, /platform_status is distinct from old\.platform_status/);
  assert.match(body, /church_status is distinct from old\.church_status/);

  const updateTrigger = sql.match(/create trigger protect_testimony_status_columns_trigger[\s\S]*?;/);
  assert.ok(updateTrigger, "Expected protect_testimony_status_columns_trigger to be attached to testimonies");
});

test("testimonies_before_insert enforces lesson completion and derives church_id/display_name server-side", () => {
  const functionMatch = sql.match(/create or replace function public\.testimonies_before_insert\(\)[\s\S]*?\$\$;/);
  assert.ok(functionMatch, "Expected public.testimonies_before_insert to be defined");
  const body = functionMatch![0];
  assert.match(body, /security definer/i);
  assert.match(body, /studied_completed_at is not null/, "Must check the real lesson_journeys completion state, not trust client input");
  assert.match(body, /new\.church_id\s*:=/, "church_id must be derived server-side from the lesson, never trusted from the client");
});

test("testimony_likes can only be inserted for an already fully-approved public testimony", () => {
  const insertPolicy = policiesOn("testimony_likes").find((c) => /for insert/i.test(c));
  assert.ok(insertPolicy, "Expected an INSERT policy on testimony_likes");
  assert.match(insertPolicy!, /profile_id\s*=\s*auth\.uid\(\)/);
  assert.match(insertPolicy!, /visibility\s*=\s*'public'/);
  assert.match(insertPolicy!, /church_status\s*=\s*'approved'/);
  assert.match(insertPolicy!, /platform_status\s*=\s*'approved'/);
});

// Phase 7 (docs/PHASE7_AUDIT.md): characters/episodes are the first platform-wide,
// church-independent tables -- write access is a direct profiles.is_platform_admin check, not
// private.is_church_manager (there's no church dimension here to reuse it against).
const PLATFORM_ADMIN_WRITE_TABLES = ["characters", "episodes", "episode_characters", "episode_lessons", "character_testimonies"];

test("characters is intentionally public-read (using(true)), same as speakers/ministries/experiences", () => {
  const selectPolicies = policiesOn("characters").filter((c) => /for select/i.test(c));
  assert.ok(selectPolicies.length > 0, "Expected a SELECT policy on characters");
  assert.ok(selectPolicies.some((c) => /using\s*\(\s*true\s*\)/i.test(c)), "Expected characters' SELECT policy to be public");
});

test("episodes has no bare using(true) policy -- draft episodes are admin-only, published are public", () => {
  for (const chunk of policiesOn("episodes")) {
    assert.doesNotMatch(chunk, /using\s*\(\s*true\s*\)/i, "A policy on public.episodes uses using(true) -- drafts must never be broadcast");
  }
});

test("episodes' SELECT policy requires status='published' or a direct is_platform_admin check", () => {
  const selectPolicy = policiesOn("episodes").find((c) => /episodes_select_published_or_admin/i.test(c));
  assert.ok(selectPolicy, "Expected an episodes_select_published_or_admin policy");
  assert.match(selectPolicy!, /status\s*=\s*'published'/);
  assert.match(selectPolicy!, /is_platform_admin/);
});

test("every platform-admin-only table's write policy checks profiles.is_platform_admin directly", () => {
  for (const table of PLATFORM_ADMIN_WRITE_TABLES) {
    const writePolicies = policiesOn(table).filter((c) => /for all/i.test(c));
    assert.ok(writePolicies.length > 0, `Expected an admin write policy on public.${table}`);
    for (const chunk of writePolicies) {
      assert.match(chunk, /is_platform_admin/, `Write policy on ${table} must check is_platform_admin`);
      assert.doesNotMatch(chunk, /using\s*\(\s*true\s*\)/i, `Write policy on ${table} must not be using(true)`);
    }
  }
});

test("episode_characters and episode_lessons SELECT policies follow their parent episode's visibility", () => {
  for (const table of ["episode_characters", "episode_lessons"]) {
    const selectPolicy = policiesOn(table).find((c) => /for select/i.test(c));
    assert.ok(selectPolicy, `Expected a SELECT policy on ${table}`);
    assert.match(selectPolicy!, /status\s*=\s*'published'/, `${table}'s SELECT policy must check the parent episode's published status`);
    assert.doesNotMatch(selectPolicy!, /using\s*\(\s*true\s*\)/i);
  }
});

test("character_testimonies only surfaces a testimony that is still fully approved at read time", () => {
  const selectPolicy = policiesOn("character_testimonies").find((c) => /for select/i.test(c));
  assert.ok(selectPolicy, "Expected a SELECT policy on character_testimonies");
  assert.match(selectPolicy!, /visibility\s*=\s*'public'/);
  assert.match(selectPolicy!, /church_status\s*=\s*'approved'/);
  assert.match(selectPolicy!, /platform_status\s*=\s*'approved'/);
});

// Phase 8 (docs/PHASE8_AUDIT.md): events reuses the private.is_church_manager pattern for
// church-directed requests + platform-wide admin access (same shape as lesson_requests/
// testimonies), but status changes are admin-only (not is_church_manager) -- a church cannot
// self-approve or self-publish its own event request; only a platform admin can.
test("events has no bare using(true) policy -- public visibility is published-only", () => {
  for (const chunk of policiesOn("events")) {
    assert.doesNotMatch(chunk, /using\s*\(\s*true\s*\)/i, "A policy on public.events uses using(true) -- unpublished events must never be broadcast");
  }
});

test("events' public SELECT policy requires status='published'", () => {
  const publicPolicy = policiesOn("events").find((c) => /events_select_published/i.test(c));
  assert.ok(publicPolicy, "Expected an events_select_published policy");
  assert.match(publicPolicy!, /status\s*=\s*'published'/);
});

test("events' manager policy reuses private.is_church_manager for both church-directed and platform-wide (admin) read access", () => {
  const managedPolicies = policiesOn("events").filter((c) => /private\.is_church_manager/.test(c));
  assert.ok(managedPolicies.length > 0, "Expected at least one events policy gated by private.is_church_manager");
});

test("events' UPDATE policy is admin-only, not private.is_church_manager -- a church cannot self-approve its own event", () => {
  const updatePolicy = policiesOn("events").find((c) => /for update/i.test(c));
  assert.ok(updatePolicy, "Expected an UPDATE policy on events");
  assert.doesNotMatch(updatePolicy!, /private\.is_church_manager/, "events UPDATE must not let a church self-approve/self-publish its own request");
  assert.match(updatePolicy!, /is_platform_admin/);
});

test("events self-service insert always starts at status='submitted' with an honest payment_status", () => {
  const insertPolicy = policiesOn("events").find((c) => /for insert/i.test(c));
  assert.ok(insertPolicy, "Expected an INSERT policy on events");
  assert.match(insertPolicy!, /requested_by\s*=\s*auth\.uid\(\)/);
  assert.match(insertPolicy!, /status\s*=\s*'submitted'/);
  assert.match(insertPolicy!, /payment_status in \('not_applicable', 'pending'\)/);
});

test("events.payment_status can never be 'paid' -- no Square integration exists to ever set it", () => {
  const tableMatch = sql.match(/create table public\.events \([\s\S]*?\);/);
  assert.ok(tableMatch, "Expected the events table definition");
  assert.match(tableMatch![0], /payment_status text not null default 'not_applicable' check \(payment_status in \('not_applicable', 'pending'\)\)/);
});

// Phase 10.1 (docs/PHASE10_EXPERIENCE_PLATFORM_SPEC.md, docs/PHASE10_IMPLEMENTATION_PLAN.md):
// church_experiences/church_experience_occurrences/church_experience_lessons already get the
// generic published-or-managed battery of tests via CHURCH_SCOPED_TABLES above.
// church_experience_registrations gets its own dedicated tests below, same shape as
// lesson_requests/testimonies/events' own dedicated sections.

test("church_experiences requires a custom_type_label when type='custom'", () => {
  const tableMatch = sql.match(/create table public\.church_experiences \([\s\S]*?\);/);
  assert.ok(tableMatch, "Expected the church_experiences table definition");
  assert.match(tableMatch![0], /check \(type <> 'custom' or custom_type_label is not null\)/);
});

test("church_experience_lessons enforces one link per (experience, lesson) pair", () => {
  const tableMatch = sql.match(/create table public\.church_experience_lessons \([\s\S]*?\);/);
  assert.ok(tableMatch, "Expected the church_experience_lessons table definition");
  assert.match(tableMatch![0], /unique \(experience_id, lesson_id\)/);
});

test("church_experience_registrations has no bare using(true) policy", () => {
  for (const chunk of policiesOn("church_experience_registrations")) {
    assert.doesNotMatch(
      chunk,
      /using\s*\(\s*true\s*\)/i,
      "A policy on public.church_experience_registrations uses using(true) -- registrations must stay scoped to their own registrant or that occurrence's church manager"
    );
  }
});

test("church_experience_registrations' SELECT policies cover both the registrant's own row and the managing church", () => {
  const selectPolicies = policiesOn("church_experience_registrations").filter((c) => /for select/i.test(c));
  assert.ok(
    selectPolicies.some((c) => /profile_id\s*=\s*auth\.uid\(\)/.test(c)),
    "Expected a SELECT policy scoped to profile_id = auth.uid()"
  );
  assert.ok(
    selectPolicies.some((c) => /private\.is_church_manager/.test(c)),
    "Expected a SELECT policy gated by private.is_church_manager for the occurrence's church"
  );
});

test("church_experience_registrations' only write policy is UPDATE, gated by private.is_church_manager -- no direct INSERT policy exists", () => {
  const registrationPolicies = policyChunks.filter((c) => /on public\.church_experience_registrations\b/i.test(c));
  const insertPolicies = registrationPolicies.filter((c) => /for insert/i.test(c));
  assert.equal(insertPolicies.length, 0, "church_experience_registrations must have no INSERT policy -- every insert goes through a SECURITY DEFINER RPC");

  const updatePolicies = registrationPolicies.filter((c) => /for update/i.test(c));
  assert.ok(updatePolicies.length > 0, "Expected an UPDATE policy on church_experience_registrations");
  for (const chunk of updatePolicies) {
    assert.match(chunk, /private\.is_church_manager/, "UPDATE policy on church_experience_registrations must be manager-gated");
  }
});

test("church_experience_registrations has no INSERT grant to authenticated -- registration only happens via RPC", () => {
  const grantMatch = sql.match(/grant select, update on public\.church_experience_registrations to authenticated;/);
  assert.ok(grantMatch, "Expected a select+update-only grant on church_experience_registrations (no insert, no delete)");
  assert.doesNotMatch(sql, /grant[^;]*insert[^;]*on public\.church_experience_registrations/i);
});

test("register_for_experience_occurrence is SECURITY DEFINER, requires auth, checks membership, occurrence status, and duplicate registration", () => {
  const fnMatch = sql.match(/create or replace function public\.register_for_experience_occurrence\(p_occurrence_id uuid\)[\s\S]*?\$\$;/);
  assert.ok(fnMatch, "Expected public.register_for_experience_occurrence to be defined");
  const body = fnMatch![0];
  assert.match(body, /security definer/i);
  assert.match(body, /auth\.uid\(\) is null/, "Must require a signed-in caller");
  assert.match(body, /for update/i, "Must lock the occurrence row to prevent a capacity race");
  assert.match(body, /church_memberships/, "Must verify the caller is a member of the occurrence's church");
  assert.match(body, /already registered/i, "Must reject a duplicate registration with a clear error");
  assert.match(body, /approval_required/, "Must respect the Experience's approval_required flag");
  assert.match(body, /waitlisted/, "Must waitlist when at capacity, not silently overbook");
});

test("register_for_experience_occurrence is granted to authenticated only, never public", () => {
  assert.match(sql, /revoke all on function public\.register_for_experience_occurrence\(uuid\) from public;/);
  assert.match(sql, /grant execute on function public\.register_for_experience_occurrence\(uuid\) to authenticated;/);
});

test("cancel_experience_registration is SECURITY DEFINER, authorizes the registrant or a church manager, and atomically promotes the waitlist", () => {
  const fnMatch = sql.match(/create or replace function public\.cancel_experience_registration\(p_registration_id uuid\)[\s\S]*?\$\$;/);
  assert.ok(fnMatch, "Expected public.cancel_experience_registration to be defined");
  const body = fnMatch![0];
  assert.match(body, /security definer/i);
  assert.match(body, /for update/i, "Must lock the registration row");
  assert.match(body, /profile_id\s*<>\s*auth\.uid\(\)\s+and\s+not\s+private\.is_church_manager/, "Must authorize either the registrant themselves or that church's manager");
  assert.match(body, /already cancelled/i, "Must reject cancelling an already-cancelled registration");
  assert.match(body, /promote_next_waitlisted/, "Must call the shared waitlist-promotion helper when a confirmed registration is cancelled");
});

test("promote_waitlist_registration requires church-manager authorization and delegates to the shared private helper", () => {
  const fnMatch = sql.match(/create or replace function public\.promote_waitlist_registration\(p_occurrence_id uuid\)[\s\S]*?\$\$;/);
  assert.ok(fnMatch, "Expected public.promote_waitlist_registration to be defined");
  const body = fnMatch![0];
  assert.match(body, /security definer/i);
  assert.match(body, /private\.is_church_manager/, "Must be church-manager-gated -- only a host/admin may explicitly promote from the waitlist");
  assert.match(body, /private\.promote_next_waitlisted/, "Must delegate to the shared helper, not duplicate its logic");
});

test("private.promote_next_waitlisted is never granted to authenticated or anon -- only reachable from another SECURITY DEFINER function", () => {
  const fnMatch = sql.match(/create or replace function private\.promote_next_waitlisted\(p_occurrence_id uuid\)[\s\S]*?\$\$;/);
  assert.ok(fnMatch, "Expected private.promote_next_waitlisted to be defined");
  assert.match(fnMatch![0], /security definer/i);
  assert.match(fnMatch![0], /for update/i, "Must lock the occurrence row before counting confirmed registrations");
  assert.match(sql, /revoke all on function private\.promote_next_waitlisted\(uuid\) from public;/);
  assert.doesNotMatch(sql, /grant execute on function private\.promote_next_waitlisted/i, "Must never be directly grantable -- it trusts its caller to have already authorized the action");
});

test("record_experience_walk_in is host/admin-only, requires real church membership, prevents duplicate registrations, and enforces capacity unless explicitly overridden", () => {
  const fnMatch = sql.match(/create or replace function public\.record_experience_walk_in\([\s\S]*?\$\$;/);
  assert.ok(fnMatch, "Expected public.record_experience_walk_in to be defined");
  const body = fnMatch![0];
  assert.match(body, /security definer/i);
  assert.match(body, /for update/i, "Must lock the occurrence row to prevent a capacity race");
  assert.match(body, /private\.is_church_manager/, "Must be church-manager-gated -- walk-ins are host/admin only");
  assert.match(body, /not a member of this church/i, "Must verify the walked-in profile actually belongs to this church -- no anonymous attendees");
  assert.match(body, /already has a registration/i, "Must reject recording a walk-in for someone already registered");
  assert.match(body, /p_override_capacity/, "Capacity must be enforced by default with an explicit override parameter, never silently bypassed");
  assert.match(body, /registration_source', 'host_walk_in'|'host_walk_in'/, "Must mark the created row's registration_source as host_walk_in");
});

test("record_experience_walk_in is granted to authenticated only, never public", () => {
  assert.match(sql, /revoke all on function public\.record_experience_walk_in\(uuid, uuid, text, boolean\) from public;/);
  assert.match(sql, /grant execute on function public\.record_experience_walk_in\(uuid, uuid, text, boolean\) to authenticated;/);
});

test("church_experience_registrations.capacity_override defaults to false and registration_source defaults to 'self'", () => {
  const tableMatch = sql.match(/create table public\.church_experience_registrations \([\s\S]*?\);/);
  assert.ok(tableMatch, "Expected the church_experience_registrations table definition");
  assert.match(tableMatch![0], /registration_source text not null default 'self' check \(registration_source in \('self', 'host_walk_in'\)\)/);
  assert.match(tableMatch![0], /capacity_override boolean not null default false/);
});

test("church_experience_registrations enforces one registration per (occurrence, member)", () => {
  const tableMatch = sql.match(/create table public\.church_experience_registrations \([\s\S]*?\);/);
  assert.ok(tableMatch, "Expected the church_experience_registrations table definition");
  assert.match(tableMatch![0], /unique \(occurrence_id, profile_id\)/);
});

// Phase 10.3: resolves the ownership-reassignment edge case flagged in docs/PHASE10_2_AUDIT.md.
test("church_experiences ownership fields (church_id, created_by) are protected from reassignment by a dedicated trigger", () => {
  const fnMatch = sql.match(/create or replace function public\.protect_church_experience_ownership\(\)[\s\S]*?\$\$;/);
  assert.ok(fnMatch, "Expected public.protect_church_experience_ownership to be defined");
  const body = fnMatch![0];
  assert.match(body, /security definer/i);
  assert.match(body, /new\.church_id is distinct from old\.church_id/);
  assert.match(body, /new\.created_by is distinct from old\.created_by/);

  const triggerMatch = sql.match(/create trigger protect_church_experience_ownership_trigger\s+before update on public\.church_experiences[\s\S]*?;/);
  assert.ok(triggerMatch, "Expected protect_church_experience_ownership_trigger to be attached to church_experiences");
});

// Phase 10.3, checkpoint 9: the one narrow, idempotent Journey integration point. See the
// migration's own header comment for the corrected understanding of markStudiedComplete's
// existing behavior that this design is based on.
test("sync_journey_on_experience_completion only fires on the not_started -> completed transition and is SECURITY DEFINER", () => {
  const fnMatch = sql.match(/create or replace function public\.sync_journey_on_experience_completion\(\)[\s\S]*?\$\$;/);
  assert.ok(fnMatch, "Expected public.sync_journey_on_experience_completion to be defined");
  const body = fnMatch![0];
  assert.match(body, /security definer/i);
  assert.match(body, /new\.completion_status <> 'completed' or old\.completion_status is not distinct from 'completed'/, "Must guard against re-firing on a repeated 'completed' save -- this is what makes it idempotent");
  assert.match(body, /relationship = 'required'/, "Must only advance the journey for required lesson links, not merely recommended ones");
  assert.match(body, /current_stage = 'experienced'/, "Must only advance a journey sitting exactly at 'experienced', never skip stages");
  assert.match(body, /studied_completed_at is not null/, "Must require a real studied completion already on record");
  assert.match(body, /set current_stage = 'applied'/, "Must advance to 'applied', not re-derive 'experienced' (already handled by markStudiedComplete)");

  const triggerMatch = sql.match(/create trigger sync_journey_on_experience_completion_trigger\s+after update on public\.church_experience_registrations[\s\S]*?;/);
  assert.ok(triggerMatch, "Expected sync_journey_on_experience_completion_trigger to be attached to church_experience_registrations");
});

// Phase 10.4: the generic CHURCH_SCOPED_TABLES loop above only confirms these three tables have
// *some* is_church_manager-gated policy -- it doesn't confirm a member (non-manager) can actually
// see a published Experience at their own church, or is blocked from a draft/other-church one.
// These three tests pin down that specific "published-or-managed" SELECT shape directly.
test("church_experiences' SELECT policy allows a member to see only published Experiences at their own church, in addition to a manager seeing all", () => {
  const selectPolicy = policiesOn("church_experiences").find((c) => /for select|^create policy [^\s]+\s+on public\.church_experiences\s*$/im.test(c) || /using/i.test(c));
  assert.ok(selectPolicy, "Expected a SELECT-capable policy on church_experiences");
  assert.match(selectPolicy!, /status = 'published'/, "Must require published status for the non-manager branch");
  assert.match(selectPolicy!, /church_memberships/, "Must require real church membership for the non-manager branch");
  assert.match(selectPolicy!, /private\.is_church_manager/, "Must still let a manager see all statuses");
});

test("church_experience_occurrences' SELECT policy follows the parent Experience's published-or-managed visibility", () => {
  const selectPolicy = policiesOn("church_experience_occurrences").find((c) => /select_follows_experience/i.test(c));
  assert.ok(selectPolicy, "Expected church_experience_occurrences_select_follows_experience");
  assert.match(selectPolicy!, /status = 'published'/);
  assert.match(selectPolicy!, /church_memberships/);
  assert.match(selectPolicy!, /private\.is_church_manager/);
});

test("church_experience_lessons' SELECT policy follows the parent Experience's published-or-managed visibility, or a separately-published lesson", () => {
  const selectPolicy = policiesOn("church_experience_lessons").find((c) => /select_follows_parents/i.test(c));
  assert.ok(selectPolicy, "Expected church_experience_lessons_select_follows_parents");
  assert.match(selectPolicy!, /status = 'published'/);
  assert.match(selectPolicy!, /private\.is_church_manager/);
  assert.match(selectPolicy!, /l\.status = 'published'/, "Must also allow visibility via the linked lesson itself being published (e.g. from the public lesson catalog)");
});

// Phase 9 (docs/PHASE9_AUDIT.md): admin_moderation_log is a new, entirely admin-only table -- no
// church dimension, no public visibility, ever. It's written by lib/adminAuditLog.ts's
// logAdminAction() from every existing status-changing admin action.
test("admin_moderation_log has no bare using(true) policy", () => {
  for (const chunk of policiesOn("admin_moderation_log")) {
    assert.doesNotMatch(
      chunk,
      /using\s*\(\s*true\s*\)/i,
      "A policy on public.admin_moderation_log uses using(true) -- this is an internal audit trail and must never be broadcast"
    );
  }
});

test("admin_moderation_log's SELECT and INSERT policies both check profiles.is_platform_admin directly", () => {
  const selectPolicy = policiesOn("admin_moderation_log").find((c) => /for select/i.test(c));
  const insertPolicy = policiesOn("admin_moderation_log").find((c) => /for insert/i.test(c));
  assert.ok(selectPolicy, "Expected a SELECT policy on admin_moderation_log");
  assert.ok(insertPolicy, "Expected an INSERT policy on admin_moderation_log");
  assert.match(selectPolicy!, /is_platform_admin/);
  assert.match(insertPolicy!, /is_platform_admin/);
});

test("admin_moderation_log's INSERT policy pins actor_id to the caller, not arbitrary client input", () => {
  const insertPolicy = policiesOn("admin_moderation_log").find((c) => /for insert/i.test(c));
  assert.ok(insertPolicy, "Expected an INSERT policy on admin_moderation_log");
  assert.match(insertPolicy!, /actor_id\s*=\s*auth\.uid\(\)/);
});

// Phase 9: lessons.featured / testimonies.featured are new columns on already church-scoped
// tables -- the row-level policy (private.is_church_manager, tested above via
// CHURCH_SCOPED_TABLES/the dedicated testimonies tests) still governs who can write them; this
// just confirms the column-level grant exists so an admin's UPDATE isn't blocked at the column
// privilege layer before RLS is even evaluated.
test("lessons.featured and testimonies.featured columns exist with a column-level UPDATE grant to authenticated", () => {
  const lessonsTable = sql.match(/alter table public\.lessons add column if not exists featured boolean/);
  const testimoniesTable = sql.match(/alter table public\.testimonies add column if not exists featured boolean/);
  assert.ok(lessonsTable, "Expected lessons.featured column to be added");
  assert.ok(testimoniesTable, "Expected testimonies.featured column to be added");
  assert.match(sql, /grant update \(featured\) on public\.lessons to authenticated/);
  assert.match(sql, /grant update \(featured\) on public\.testimonies to authenticated/);
});

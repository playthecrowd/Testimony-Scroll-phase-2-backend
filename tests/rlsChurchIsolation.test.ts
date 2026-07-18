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

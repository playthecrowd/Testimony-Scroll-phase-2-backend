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

// One chunk per `create policy` statement, so each check only ever looks at that policy's own
// USING/WITH CHECK clause -- never a different, unrelated policy later in the file.
const policyChunks = sql.split(/(?=create policy)/gi).filter((c) => c.trim().toLowerCase().startsWith("create policy"));

function policiesOn(table: string): string[] {
  const re = new RegExp(`on public\\.${table}\\b`, "i");
  return policyChunks.filter((c) => re.test(c));
}

// Every table that stores per-church data. speakers/ministries are deliberately excluded: they're
// public lookup data by design, not a leak (see docs/PHASE1_AUDIT.md section 3). church_invites
// is Phase 2 (docs/PHASE2_AUDIT.md) -- per-email invitations, manager-only by design.
const CHURCH_SCOPED_TABLES = [
  "churches",
  "church_memberships",
  "lessons",
  "lesson_media",
  "lesson_hosts",
  "lesson_ministries",
  "church_invites",
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

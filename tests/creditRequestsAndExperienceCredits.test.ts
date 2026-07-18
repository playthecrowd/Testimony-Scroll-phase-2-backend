import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

// Phase 11.2 (docs/PHASE11_ECONOMY_PROGRESSION_SPEC.md, docs/PHASE11_2_AUDIT.md): structural
// regression guards for the credit request workflow (migrations 0029/0030) and the Experience
// credit-cost/charging/refund wiring (migration 0031). Same no-live-database-in-`npm test`
// limitation as every prior phase's tests -- these read the actual migration SQL and application
// source directly.

const MIGRATIONS_DIR = path.join(__dirname, "..", "supabase", "migrations");
const REPO_ROOT = path.join(__dirname, "..");

function readAllMigrations(): string {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(path.join(MIGRATIONS_DIR, f), "utf8"))
    .join("\n");
}

const sql = readAllMigrations();

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

// Returns the LAST definition of a function in migration order -- several functions in this repo
// are legitimately redefined by a later migration via `create or replace function` (e.g.
// cancel_experience_registration: 0023 then 0031; refund_credits: 0028 then 0030), and it's always
// the final, currently-live definition that matters for these tests, never an earlier superseded
// one. A plain non-global match() would silently return the FIRST occurrence instead.
function functionBody(name: string, args: string, schema = "public"): string {
  const re = new RegExp(`create or replace function ${schema}\\.${name}\\(${args}\\)[\\s\\S]*?\\$\\$;`, "g");
  const matches = sql.match(re);
  assert.ok(matches && matches.length > 0, `Expected ${schema}.${name}(${args}) to be defined`);
  return matches![matches!.length - 1];
}

// ---------------------------------------------------------------------------
// credit_requests schema, statuses, RLS
// ---------------------------------------------------------------------------

test("credit_requests: requested_amount must be positive, status is a fixed enum including every brief-required value", () => {
  const tableMatch = sql.match(/create table public\.credit_requests \([\s\S]*?\n\);/);
  assert.ok(tableMatch, "Expected the credit_requests table definition");
  assert.match(tableMatch![0], /requested_amount integer not null check \(requested_amount > 0\)/);
  for (const status of ["submitted", "under_review", "approved", "declined", "cancelled", "fulfilled"]) {
    assert.match(tableMatch![0], new RegExp(`'${status}'`));
  }
});

test("credit_requests has no INSERT/UPDATE/DELETE grant or policy -- every status transition is RPC-only", () => {
  const grantMatch = sql.match(/grant [\w, ]+ on public\.credit_requests to authenticated;/);
  assert.ok(grantMatch, "Expected a grant statement for credit_requests");
  assert.doesNotMatch(grantMatch![0], /insert|update|delete/i);

  const chunks = policiesOn("credit_requests");
  assert.ok(chunks.length > 0, "Expected at least one policy on credit_requests");
  for (const chunk of chunks) {
    assert.doesNotMatch(chunk, /for insert|for update|for delete/i);
    assert.doesNotMatch(chunk, /using\s*\(\s*true\s*\)/i);
  }
});

test("credit_requests SELECT policies scope a member to their own requests and a church manager to their own church's requests", () => {
  const chunks = policiesOn("credit_requests");
  assert.ok(chunks.some((c) => /requested_by = auth\.uid\(\)/.test(c)));
  assert.ok(chunks.some((c) => /private\.is_church_manager\(church_id\)/.test(c)));
});

// ---------------------------------------------------------------------------
// Credit request RPCs
// ---------------------------------------------------------------------------

test("submit_credit_request requires auth, a positive amount, and real membership in the target church", () => {
  const body = functionBody("submit_credit_request", "[\\s\\S]*?");
  assert.match(body, /security definer/i);
  assert.match(body, /set search_path = ''/);
  assert.match(body, /auth\.uid\(\) is null/);
  assert.match(body, /p_requested_amount <= 0/);
  assert.match(body, /church_memberships/);
});

test("cancel_credit_request only allows the original requester to cancel their own not-yet-resolved request", () => {
  const body = functionBody("cancel_credit_request", "p_request_id uuid");
  assert.match(body, /where id = p_request_id for update/, "Must lock the request row");
  assert.match(body, /v_request\.requested_by <> auth\.uid\(\)/);
  assert.match(body, /v_request\.status not in \('submitted', 'under_review'\)/);
});

test("approve_credit_request is church-manager-gated, guards against double-resolution, and delegates the actual balance movement to transfer_credits (no duplicated debit/credit logic)", () => {
  const body = functionBody("approve_credit_request", "p_request_id uuid");
  assert.match(body, /where id = p_request_id for update/);
  assert.match(body, /private\.is_church_manager\(v_request\.church_id\)/);
  assert.match(body, /v_request\.status not in \('submitted', 'under_review'\)/);
  assert.match(body, /perform public\.transfer_credits\(/, "Must reuse transfer_credits rather than reimplementing the lock/balance-check/debit/credit sequence");
  assert.match(body, /set status = 'fulfilled'/);
});

test("decline_credit_request is church-manager-gated and records a decline reason", () => {
  const body = functionBody("decline_credit_request", "p_request_id uuid, p_reason text default null");
  assert.match(body, /private\.is_church_manager\(v_request\.church_id\)/);
  assert.match(body, /set status = 'declined', decline_reason = p_reason/);
});

test("submit_credit_request, cancel_credit_request, approve_credit_request, and decline_credit_request are all granted to authenticated only", () => {
  for (const [name, sig] of [
    ["submit_credit_request", "uuid, integer, uuid, text"],
    ["cancel_credit_request", "uuid"],
    ["approve_credit_request", "uuid"],
    ["decline_credit_request", "uuid, text"],
  ]) {
    assert.match(sql, new RegExp(`revoke all on function public\\.${name}\\(${sig}\\) from public;`));
    assert.match(sql, new RegExp(`grant execute on function public\\.${name}\\(${sig}\\) to authenticated;`));
  }
});

test("no application code directly inserts/updates/deletes credit_requests -- every mutation goes through services/supabase/wallets.ts's RPC wrappers", () => {
  function listTsFiles(dir: string): string[] {
    const entries = readdirSync(dir, { withFileTypes: true });
    let files: string[] = [];
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files = files.concat(listTsFiles(fullPath));
      } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
        files.push(fullPath);
      }
    }
    return files;
  }
  const dirs = ["app", "components", "lib"].map((d) => path.join(REPO_ROOT, d));
  const files = dirs.flatMap((d) => listTsFiles(d));
  const offending = files.filter((f) => {
    const content = readFileSync(f, "utf8");
    return /\.from\(\s*["']credit_requests["']\s*\)\s*\.(insert|update|delete)\(/.test(content);
  });
  assert.deepEqual(offending.map((f) => path.relative(REPO_ROOT, f)), []);
});

// ---------------------------------------------------------------------------
// private.apply_refund -- shared, unexposed refund helper
// ---------------------------------------------------------------------------

test("private.apply_refund is never granted to authenticated/anon -- only reachable from another SECURITY DEFINER function", () => {
  assert.match(sql, /revoke all on function private\.apply_refund\(uuid, text\) from public;/);
  assert.doesNotMatch(sql, /grant execute on function private\.apply_refund/);
});

test("refund_credits (redefined in 0030) delegates to private.apply_refund after its own authorization check, rather than duplicating the refund math", () => {
  const body = functionBody("refund_credits", "p_ledger_entry_id uuid, p_description text default null");
  assert.match(body, /is_platform_admin/);
  assert.match(body, /private\.is_church_manager\(v_original\.related_church_id\)/);
  assert.match(body, /return private\.apply_refund\(/);
});

// ---------------------------------------------------------------------------
// Experience credit costs
// ---------------------------------------------------------------------------

test("church_experiences.default_credit_cost and church_experience_occurrences.credit_cost are nullable and positive-when-set (null means free)", () => {
  assert.match(sql, /alter table public\.church_experiences add column default_credit_cost integer check \(default_credit_cost > 0\);/);
  assert.match(sql, /alter table public\.church_experience_occurrences add column credit_cost integer check \(credit_cost > 0\);/);
});

// ---------------------------------------------------------------------------
// Charging trigger -- fires only on the transition into 'confirmed', excludes walk-ins, is
// idempotent, locks the wallet, and rejects insufficient balance.
// ---------------------------------------------------------------------------

test("charge_credits_on_registration_confirmation only fires on the transition into 'confirmed', never re-fires on an unrelated update while already confirmed", () => {
  const body = functionBody("charge_credits_on_registration_confirmation", "");
  assert.match(body, /if new\.status <> 'confirmed' then\s*\n\s*return new;/);
  assert.match(body, /if tg_op = 'UPDATE' and old\.status is not distinct from 'confirmed' then/);
});

test("charge_credits_on_registration_confirmation excludes host-recorded walk-ins from automatic charging", () => {
  const body = functionBody("charge_credits_on_registration_confirmation", "");
  assert.match(body, /if new\.registration_source <> 'self' then\s*\n\s*return new;/);
});

test("charge_credits_on_registration_confirmation is free (no-op) when neither the occurrence nor the Experience sets a cost", () => {
  const body = functionBody("charge_credits_on_registration_confirmation", "");
  assert.match(body, /v_cost := coalesce\(v_occurrence\.credit_cost, v_experience\.default_credit_cost\);/);
  assert.match(body, /if v_cost is null or v_cost <= 0 then\s*\n\s*return new;/);
});

test("charge_credits_on_registration_confirmation is idempotent via a deterministic idempotency key derived from the registration id", () => {
  const body = functionBody("charge_credits_on_registration_confirmation", "");
  assert.match(body, /v_idempotency_key := 'experience_spend:' \|\| new\.id;/);
  assert.match(body, /select \* into v_existing from public\.credit_ledger_entries where idempotency_key = v_idempotency_key;/);
});

test("charge_credits_on_registration_confirmation locks the member's wallet before checking balance and rejects (rolling back the whole registration) when insufficient", () => {
  const body = functionBody("charge_credits_on_registration_confirmation", "");
  assert.match(body, /where profile_id = new\.profile_id for update/);
  assert.match(body, /if v_member_wallet\.current_balance < v_cost then/);
  assert.match(body, /raise exception 'You do not have enough credits for this registration\. Request credits from this church to continue\.';/);
});

test("charge_credits_on_registration_confirmation_trigger fires after insert or update on church_experience_registrations", () => {
  assert.match(
    sql,
    /create trigger charge_credits_on_registration_confirmation_trigger\s*\n\s*after insert or update on public\.church_experience_registrations/
  );
});

// ---------------------------------------------------------------------------
// Refund on member cancellation (cancel_experience_registration, redefined in 0031)
// ---------------------------------------------------------------------------

test("cancel_experience_registration (redefined in 0031) refunds only when now() is before registration_closes_at, falling back to starts_at when null", () => {
  const body = functionBody("cancel_experience_registration", "p_registration_id uuid");
  assert.match(body, /v_cutoff := coalesce\(v_occurrence\.registration_closes_at, v_occurrence\.starts_at\);/);
  assert.match(body, /if v_cutoff is not null and now\(\) < v_cutoff then/);
});

test("cancel_experience_registration's refund only refunds an unreversed experience_spend entry tied to this member and occurrence, via the shared private.apply_refund helper", () => {
  const body = functionBody("cancel_experience_registration", "p_registration_id uuid");
  assert.match(body, /transaction_type = 'experience_spend'/);
  assert.match(body, /reversed_by_entry_id is null/);
  assert.match(body, /perform private\.apply_refund\(v_spend_entry_id,/);
});

test("cancel_experience_registration preserves its original 0023 authorization and waitlist-promotion behavior unchanged", () => {
  const body = functionBody("cancel_experience_registration", "p_registration_id uuid");
  assert.match(body, /v_registration\.profile_id <> auth\.uid\(\) and not private\.is_church_manager/);
  assert.match(body, /perform private\.promote_next_waitlisted/);
});

// ---------------------------------------------------------------------------
// Refund on church-initiated occurrence cancellation -- always refunds, no exceptions
// ---------------------------------------------------------------------------

test("refund_registrations_on_occurrence_cancellation fires only on the transition into 'cancelled' and refunds every unrefunded experience_spend for that occurrence", () => {
  const body = functionBody("refund_registrations_on_occurrence_cancellation", "");
  assert.match(body, /if new\.status <> 'cancelled' or old\.status is not distinct from 'cancelled' then/);
  assert.match(body, /related_occurrence_id = new\.id/);
  assert.match(body, /transaction_type = 'experience_spend'/);
  assert.match(body, /reversed_by_entry_id is null/);
  assert.match(body, /perform private\.apply_refund\(/);
});

test("refund_registrations_on_occurrence_cancellation_trigger fires after update on church_experience_occurrences", () => {
  assert.match(
    sql,
    /create trigger refund_registrations_on_occurrence_cancellation_trigger\s*\n\s*after update on public\.church_experience_occurrences/
  );
});

// ---------------------------------------------------------------------------
// Security: cross-church approval, forged IDs, unauthorized grants, direct writes, RPC auth
// ---------------------------------------------------------------------------

test("approve_credit_request/decline_credit_request check is_church_manager against the REQUEST's own church_id, never an assumed or caller-supplied church -- a forged request id belonging to another church is rejected", () => {
  const approve = functionBody("approve_credit_request", "p_request_id uuid");
  const decline = functionBody("decline_credit_request", "p_request_id uuid, p_reason text default null");
  for (const body of [approve, decline]) {
    assert.match(body, /select \* into v_request from public\.credit_requests where id = p_request_id for update;/, "Must derive the church from the request row itself, not a client-supplied churchId");
    assert.match(body, /private\.is_church_manager\(v_request\.church_id\)/);
  }
});

test("no RPC in 0029-0031 grants execute to anyone but authenticated (never a broader public grant)", () => {
  for (const [name, sig] of [
    ["submit_credit_request", "uuid, integer, uuid, text"],
    ["cancel_credit_request", "uuid"],
    ["approve_credit_request", "uuid"],
    ["decline_credit_request", "uuid, text"],
  ]) {
    const grantMatch = sql.match(new RegExp(`grant execute on function public\\.${name}\\(${sig}\\) to (\\w+);`));
    assert.ok(grantMatch, `Expected an execute grant for ${name}`);
    assert.equal(grantMatch![1], "authenticated");
  }
});

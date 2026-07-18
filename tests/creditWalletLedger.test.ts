import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

// Phase 11.1 (docs/PHASE11_ECONOMY_PROGRESSION_SPEC.md, docs/PHASE11_1_AUDIT.md): structural
// regression guards for the wallet/ledger database foundation (migrations 0027/0028). Same
// limitation documented in every prior phase's tests -- this repo has no live Supabase project
// wired into `npm test`, so these read the actual migration SQL and application source directly
// rather than exercising a running database. Real behavioral/live-DB verification happens via
// `supabase db query` against the linked project once these migrations are pushed, exactly as
// every phase since Phase 10 has done.

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

function functionBody(name: string, args: string): string {
  const re = new RegExp(`create or replace function public\\.${name}\\(${args}\\)[\\s\\S]*?\\$\\$;`);
  const m = sql.match(re);
  assert.ok(m, `Expected public.${name}(${args}) to be defined`);
  return m![0];
}

// ---------------------------------------------------------------------------
// Wallet creation
// ---------------------------------------------------------------------------

test("member_wallets: one wallet per member, non-negative balance, no direct client write", () => {
  const tableMatch = sql.match(/create table public\.member_wallets \([\s\S]*?\);/);
  assert.ok(tableMatch, "Expected the member_wallets table definition");
  assert.match(tableMatch![0], /profile_id uuid not null unique references public\.profiles/);
  assert.match(tableMatch![0], /current_balance integer not null default 0 check \(current_balance >= 0\)/);

  const grantMatch = sql.match(/grant [\w, ]+ on public\.member_wallets to authenticated;/);
  assert.ok(grantMatch, "Expected a grant statement for member_wallets");
  assert.doesNotMatch(grantMatch![0], /insert|update|delete/i, "member_wallets must never grant insert/update/delete to authenticated -- balance changes are RPC-only");
});

test("church_wallets: one wallet per church, non-negative balance, no direct client write", () => {
  const tableMatch = sql.match(/create table public\.church_wallets \([\s\S]*?\);/);
  assert.ok(tableMatch, "Expected the church_wallets table definition");
  assert.match(tableMatch![0], /church_id uuid not null unique references public\.churches/);
  assert.match(tableMatch![0], /current_balance integer not null default 0 check \(current_balance >= 0\)/);

  const grantMatch = sql.match(/grant [\w, ]+ on public\.church_wallets to authenticated;/);
  assert.ok(grantMatch, "Expected a grant statement for church_wallets");
  assert.doesNotMatch(grantMatch![0], /insert|update|delete/i, "church_wallets must never grant insert/update/delete to authenticated -- balance changes are RPC-only");
});

test("create_member_wallet is SECURITY DEFINER, requires auth, and is idempotent (returns the existing wallet rather than duplicating)", () => {
  const body = functionBody("create_member_wallet", "");
  assert.match(body, /security definer/i);
  assert.match(body, /set search_path = ''/);
  assert.match(body, /auth\.uid\(\) is null/, "Must require a signed-in caller");
  assert.match(body, /select \* into v_wallet from public\.member_wallets where profile_id = auth\.uid\(\);/);
  assert.match(body, /if v_wallet\.id is not null then\s*\n\s*return v_wallet;/, "Must return the existing wallet instead of inserting a duplicate");
});

test("create_church_wallet is church-manager-gated and idempotent", () => {
  const body = functionBody("create_church_wallet", "p_church_id uuid");
  assert.match(body, /security definer/i);
  assert.match(body, /private\.is_church_manager\(p_church_id\)/);
  assert.match(body, /if v_wallet\.id is not null then\s*\n\s*return v_wallet;/);
});

// ---------------------------------------------------------------------------
// Ledger creation, idempotency, RPC-only mutation
// ---------------------------------------------------------------------------

test("credit_ledger_entries requires exactly one of member_wallet_id/church_wallet_id via a CHECK constraint", () => {
  const tableMatch = sql.match(/create table public\.credit_ledger_entries \([\s\S]*?\n\);/);
  assert.ok(tableMatch, "Expected the credit_ledger_entries table definition");
  assert.match(
    tableMatch![0],
    /constraint credit_ledger_entries_exactly_one_wallet check \(\s*\(member_wallet_id is not null and church_wallet_id is null\)\s*or \(member_wallet_id is null and church_wallet_id is not null\)\s*\)/
  );
});

test("credit_ledger_entries.amount is signed and non-zero, never a bare unsigned magnitude", () => {
  const tableMatch = sql.match(/create table public\.credit_ledger_entries \([\s\S]*?\n\);/);
  assert.ok(tableMatch, "Expected the credit_ledger_entries table definition");
  assert.match(tableMatch![0], /amount integer not null check \(amount <> 0\)/);
});

test("credit_ledger_entries has a unique idempotency-key index preventing duplicate fulfillment at the database level", () => {
  assert.match(
    sql,
    /create unique index credit_ledger_entries_idempotency_key_key\s*\n\s*on public\.credit_ledger_entries \(idempotency_key\)\s*\n\s*where idempotency_key is not null;/
  );
});

test("credit_ledger_entries has no INSERT/UPDATE/DELETE grant to authenticated -- every write is RPC-only", () => {
  const grantMatch = sql.match(/grant [\w, ]+ on public\.credit_ledger_entries to authenticated;/);
  assert.ok(grantMatch, "Expected a grant statement for credit_ledger_entries");
  assert.doesNotMatch(grantMatch![0], /insert|update|delete/i);
});

test("credit_ledger_entries has no INSERT/UPDATE/DELETE policy at all -- RLS denies every such statement outright regardless of role", () => {
  const chunks = policiesOn("credit_ledger_entries");
  assert.ok(chunks.length > 0, "Expected at least one policy on credit_ledger_entries");
  for (const chunk of chunks) {
    assert.doesNotMatch(chunk, /for insert|for update|for delete/i, "credit_ledger_entries must only ever have SELECT policies -- writes happen exclusively through SECURITY DEFINER RPCs");
  }
});

test("member_wallets and church_wallets also have no INSERT/UPDATE/DELETE policy -- creation and balance changes are RPC-only", () => {
  for (const table of ["member_wallets", "church_wallets"]) {
    const chunks = policiesOn(table);
    assert.ok(chunks.length > 0, `Expected at least one policy on ${table}`);
    for (const chunk of chunks) {
      assert.doesNotMatch(chunk, /for insert|for update|for delete/i, `${table} must only ever have SELECT policies`);
    }
  }
});

test("no application code directly inserts/updates/deletes member_wallets, church_wallets, or credit_ledger_entries -- every mutation goes through services/supabase/wallets.ts's RPC wrappers", () => {
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
    return /\.from\(\s*["'](member_wallets|church_wallets|credit_ledger_entries)["']\s*\)\s*\.(insert|update|delete)\(/.test(content);
  });
  assert.deepEqual(
    offending.map((f) => path.relative(REPO_ROOT, f)),
    [],
    "Found a direct insert/update/delete against a wallet or ledger table outside the approved RPC path"
  );
});

// ---------------------------------------------------------------------------
// Row locking / concurrency (race-condition regression)
// ---------------------------------------------------------------------------

test("every wallet-mutating RPC locks the wallet row(s) it touches with for update before checking or changing balance", () => {
  const grant = functionBody("grant_credits", "[\\s\\S]*?");
  assert.match(grant, /where profile_id = p_target_member_id for update/);
  assert.match(grant, /where church_id = p_target_church_id for update/);

  const transfer = functionBody("transfer_credits", "[\\s\\S]*?");
  assert.match(transfer, /where church_id = p_from_church_id for update/, "Must lock the church wallet before checking its balance");
  assert.match(transfer, /where profile_id = p_to_member_id for update/);

  const refund = functionBody("refund_credits", "p_ledger_entry_id uuid, p_description text default null");
  assert.match(refund, /where id = p_ledger_entry_id for update/, "Must lock the original ledger entry to prevent a concurrent double-refund");

  const reverse = functionBody("reverse_credit_transaction", "p_ledger_entry_id uuid, p_reason text");
  assert.match(reverse, /where id = p_ledger_entry_id for update/);
});

test("every wallet-mutating RPC is SECURITY DEFINER with search_path locked", () => {
  for (const [name, args] of [
    ["create_member_wallet", ""],
    ["create_church_wallet", "p_church_id uuid"],
    ["grant_credits", "[\\s\\S]*?"],
    ["transfer_credits", "[\\s\\S]*?"],
    ["refund_credits", "p_ledger_entry_id uuid, p_description text default null"],
    ["reverse_credit_transaction", "p_ledger_entry_id uuid, p_reason text"],
    ["get_wallet_balance", "[\\s\\S]*?"],
    ["get_wallet_history", "[\\s\\S]*?"],
  ] as const) {
    const body = functionBody(name, args);
    assert.match(body, /security definer/i, `${name} must be SECURITY DEFINER`);
    assert.match(body, /set search_path = ''/, `${name} must lock search_path`);
  }
});

// ---------------------------------------------------------------------------
// Insufficient balance / church grant limits (owner decision SS34.6 -- no exceptions)
// ---------------------------------------------------------------------------

test("transfer_credits rejects a grant that would exceed the church wallet's real current balance, with zero exceptions", () => {
  const body = functionBody("transfer_credits", "[\\s\\S]*?");
  assert.match(body, /if v_church_wallet\.current_balance < p_amount then/, "Must check the real, current balance before debiting");
  assert.match(body, /raise exception 'This church wallet does not have enough balance/);
});

test("member_wallets/church_wallets current_balance CHECK constraint prevents a negative balance at the database level, not just in application logic", () => {
  assert.match(sql, /current_balance integer not null default 0 check \(current_balance >= 0\)/g);
});

// ---------------------------------------------------------------------------
// Refunds and reversals
// ---------------------------------------------------------------------------

test("refund_credits credits back the exact opposite of the original entry's amount and links the two rows bidirectionally", () => {
  const body = functionBody("refund_credits", "p_ledger_entry_id uuid, p_description text default null");
  assert.match(body, /v_refund_amount := -v_original\.amount;/);
  assert.match(body, /reverses_entry_id/, "The new refund row must record which entry it reverses");
  assert.match(body, /update public\.credit_ledger_entries set reversed_by_entry_id = v_entry\.id where id = v_original\.id;/, "The original entry must be updated to point forward at the new refund row");
});

test("refund_credits refuses to act twice on the same original entry -- a retry is a safe no-op returning the existing refund", () => {
  const body = functionBody("refund_credits", "p_ledger_entry_id uuid, p_description text default null");
  assert.match(body, /if v_original\.reversed_by_entry_id is not null then/);
});

test("reverse_credit_transaction is platform-admin-only and requires a reason", () => {
  const body = functionBody("reverse_credit_transaction", "p_ledger_entry_id uuid, p_reason text");
  assert.match(body, /is_platform_admin/);
  assert.match(body, /if p_reason is null or btrim\(p_reason\) = '' then/);
  assert.match(body, /if v_original\.reversed_by_entry_id is not null then/, "Must also refuse to double-reverse the same entry");
});

// ---------------------------------------------------------------------------
// Authorization: church-manager gating, cross-church isolation, unauthorized callers
// ---------------------------------------------------------------------------

test("grant_credits is platform-admin-only and rejects transaction types reserved for the other RPCs", () => {
  const body = functionBody("grant_credits", "[\\s\\S]*?");
  assert.match(body, /if auth\.uid\(\) is null then/);
  assert.match(body, /is_platform_admin/);
  assert.match(body, /if p_transaction_type not in \('platform_grant', 'promotional_credit', 'administrator_adjustment'\) then/);
});

test("transfer_credits is church-manager-gated for the specific source church and requires the recipient to actually be a member of that church", () => {
  const body = functionBody("transfer_credits", "[\\s\\S]*?");
  assert.match(body, /private\.is_church_manager\(p_from_church_id\)/, "Must check the caller manages this specific church, never assume 'their only church'");
  assert.match(body, /church_memberships/, "Must verify the recipient belongs to this church -- no cross-church credit transfer to a stranger");
});

test("refund_credits authorization is limited to a platform admin or the manager of the entry's own related church -- never an unrelated church's host", () => {
  const body = functionBody("refund_credits", "p_ledger_entry_id uuid, p_description text default null");
  assert.match(body, /v_original\.related_church_id is not null and private\.is_church_manager\(v_original\.related_church_id\)/);
});

test("get_wallet_balance and get_wallet_history reject an unauthorized caller -- a member cannot read another member's wallet, and a host cannot read another church's wallet", () => {
  for (const [name, args] of [
    ["get_wallet_balance", "p_member_wallet_id uuid default null, p_church_wallet_id uuid default null"],
    ["get_wallet_history", "[\\s\\S]*?"],
  ] as const) {
    const body = functionBody(name, args);
    assert.match(body, /v_member_wallet\.profile_id <> auth\.uid\(\) and not v_is_admin/, `${name} must reject a caller who isn't the wallet owner or an admin`);
    assert.match(body, /private\.is_church_manager\(v_church_wallet\.church_id\)/, `${name} must reject a caller who doesn't manage this specific church`);
  }
});

test("credit_ledger_entries SELECT policies isolate a member's own wallet, a church manager's own church wallet, and grant platform admins full visibility -- never a bare using(true)", () => {
  const chunks = policiesOn("credit_ledger_entries");
  for (const chunk of chunks) {
    assert.doesNotMatch(chunk, /using\s*\(\s*true\s*\)/i);
  }
  assert.ok(chunks.some((c) => /mw\.profile_id = auth\.uid\(\)/.test(c)), "Expected a policy scoping a member to their own wallet's entries");
  assert.ok(chunks.some((c) => /private\.is_church_manager\(cw\.church_id\)/.test(c)), "Expected a policy scoping a church manager to their own church wallet's entries");
  assert.ok(chunks.some((c) => /is_platform_admin/.test(c)), "Expected a policy granting platform admins full visibility");
});

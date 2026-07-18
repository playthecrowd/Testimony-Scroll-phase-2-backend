import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

// Phase 11.5 (docs/PHASE11_5_AUDIT.md): structural regression guards added during the final
// stabilization pass -- the wallet/ledger reconciliation diagnostic (0035) and a permanent
// regression guard confirming Credits/Points/XP remain fully independent systems (spec SS4:
// Points determines rank, XP determines level, Credits determines neither), verified directly
// against the actual migration SQL rather than assumed.

const MIGRATIONS_DIR = path.join(__dirname, "..", "supabase", "migrations");

function readAllMigrations(): string {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(path.join(MIGRATIONS_DIR, f), "utf8"))
    .join("\n");
}

const sql = readAllMigrations();

function fileContent(name: string): string {
  return readFileSync(path.join(MIGRATIONS_DIR, name), "utf8");
}

// ---------------------------------------------------------------------------
// Reconciliation diagnostic (Step 3: financial integrity audit)
// ---------------------------------------------------------------------------

test("private.diagnose_wallet_balance_drift is read-only (no insert/update/delete), SECURITY DEFINER, search_path locked, and never granted to any client role", () => {
  const content = fileContent("0035_wallet_reconciliation_diagnostic.sql");
  assert.match(content, /security definer/i);
  assert.match(content, /set search_path = ''/);
  assert.match(content, /^\s*stable\s*$/m, "Must be marked stable -- a pure read, never a mutation");
  assert.doesNotMatch(content, /\binsert into\b|\bupdate\b\s+public\.|\bdelete from\b/i, "Must never mutate a wallet or ledger row -- diagnostic only");
  assert.match(content, /revoke all on function private\.diagnose_wallet_balance_drift\(\) from public;/);
  assert.doesNotMatch(content, /grant execute on function private\.diagnose_wallet_balance_drift/, "Must never be granted to authenticated or anon -- an internal ops diagnostic only");
});

test("private.diagnose_wallet_balance_drift compares each wallet's stored current_balance against the real sum of its own ledger entries, for both member and church wallets", () => {
  const content = fileContent("0035_wallet_reconciliation_diagnostic.sql");
  assert.match(content, /from public\.member_wallets mw\s*\n\s*left join public\.credit_ledger_entries cle on cle\.member_wallet_id = mw\.id/);
  assert.match(content, /from public\.church_wallets cw\s*\n\s*left join public\.credit_ledger_entries cle on cle\.church_wallet_id = cw\.id/);
  assert.match(content, /having mw\.current_balance <> coalesce\(sum\(cle\.amount\), 0\)::integer/);
  assert.match(content, /having cw\.current_balance <> coalesce\(sum\(cle\.amount\), 0\)::integer/);
});

// ---------------------------------------------------------------------------
// Credits / Points / XP independence -- permanent regression guard
// ---------------------------------------------------------------------------

test("the progression system (0032/0033) never references wallet balances -- Credits cannot affect Points, XP, or Level", () => {
  const progressionFiles = ["0032_progression_schema.sql", "0033_progression_award_rpcs.sql"];
  for (const file of progressionFiles) {
    const content = fileContent(file);
    assert.doesNotMatch(content, /current_balance/, `${file} must never reference current_balance`);
  }
});

test("the credit/wallet system (0027-0031) never references Points/XP totals -- Credits cannot affect rank or level", () => {
  const creditFiles = [
    "0027_credit_wallets_ledger.sql",
    "0028_credit_wallet_rpcs.sql",
    "0029_credit_requests.sql",
    "0030_credit_request_rpcs.sql",
    "0031_experience_credit_costs.sql",
  ];
  for (const file of creditFiles) {
    const content = fileContent(file);
    assert.doesNotMatch(content, /points_total|xp_total/, `${file} must never reference points_total or xp_total`);
  }
});

test("both leaderboard views rank strictly by points_total -- never xp_total or any wallet balance", () => {
  const globalView = sql.match(/create view public\.leaderboard_global as[\s\S]*?;/);
  const churchView = sql.match(/create view public\.leaderboard_my_church as[\s\S]*?;/);
  assert.ok(globalView && churchView);
  for (const view of [globalView![0], churchView![0]]) {
    assert.match(view, /order by mps\.points_total desc/);
    assert.doesNotMatch(view, /order by[^;]*xp_total/i, "Must never rank by xp_total");
    assert.doesNotMatch(view, /current_balance/i, "Must never reference a wallet balance");
  }
});

test("current_level is always re-derived from progression_level_thresholds by XP, never incremented directly or derived from points_total", () => {
  const body = sql.match(/create or replace function private\.award_progression_event\([\s\S]*?\$\$;/g);
  assert.ok(body && body.length > 0);
  const latest = body![body!.length - 1];
  assert.match(latest, /select level into v_new_level\s*\n\s*from public\.progression_level_thresholds\s*\n\s*where min_xp <= v_new_xp_total/);
  assert.doesNotMatch(latest, /current_level\s*=\s*current_level\s*\+/, "Must never increment current_level directly");
});

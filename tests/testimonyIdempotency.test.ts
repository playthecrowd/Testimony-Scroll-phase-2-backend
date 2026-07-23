import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { isValidUuid } from "../lib/utils";

// Repair Batch 2, D23 (Trello tBiCxvNF): rapid/duplicate testimony submissions created multiple
// records with no server/DB-side protection. Same limitation as every other migration-level test
// in this repo (see tests/creditWalletLedger.test.ts's header) -- there is no live Supabase project
// wired into `npm test`, so the tests below marked SOURCE SCAN read the actual migration SQL and
// application source directly rather than exercising a running database; they verify the correct
// SQL constructs exist, not that Postgres actually enforces them at runtime. Real concurrency
// behavior (two simultaneous requests genuinely racing) can only be verified against a live
// database, which is out of scope for this local commit -- flagged for a live/staging integration
// pass once this migration is applied. Tests marked TRUE TEST exercise real, executable TypeScript
// logic with real assertions, no database or mocking involved.

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

function functionBody(name: string, args: string, schema = "public"): string {
  const re = new RegExp(`create or replace function ${schema}\\.${name}\\(${args}\\)[\\s\\S]*?\\$\\$;`, "g");
  const matches = sql.match(re);
  assert.ok(matches && matches.length > 0, `Expected ${schema}.${name}(${args}) to be defined`);
  return matches![matches!.length - 1];
}

const RPC_ARGS =
  "\\s*p_idempotency_key text,\\s*p_primary_lesson_id uuid,[\\s\\S]*?p_voice_likeness_permission boolean\\s*";

// ---------------------------------------------------------------------------
// SOURCE SCAN: migration structure
// ---------------------------------------------------------------------------

test("[SOURCE SCAN] testimonies.idempotency_key is a nullable uuid column, safe for existing rows", () => {
  assert.match(
    sql,
    /alter table public\.testimonies add column if not exists idempotency_key uuid;/,
    "Expected a nullable uuid idempotency_key column (IF NOT EXISTS makes re-running the migration safe, and no NOT NULL means every pre-existing row is valid as-is)"
  );
});

test("[SOURCE SCAN] unique index is scoped to (submitted_by, idempotency_key), not idempotency_key alone -- so two different users may safely reuse the same key without colliding", () => {
  assert.match(
    sql,
    /create unique index if not exists testimonies_submitted_by_idempotency_key_key\s*\n\s*on public\.testimonies \(submitted_by, idempotency_key\)\s*\n\s*where idempotency_key is not null;/,
    "Expected a composite partial unique index on (submitted_by, idempotency_key)"
  );
});

test("[SOURCE SCAN] submit_testimony_idempotent requires a signed-in caller and never accepts a client-supplied member/profile id parameter", () => {
  const body = functionBody("submit_testimony_idempotent", RPC_ARGS);
  assert.match(body, /security definer/i);
  assert.match(body, /set search_path = ''/);
  assert.match(body, /if auth\.uid\(\) is null then/, "Must require a signed-in caller");
  // No p_member_id / p_profile_id / p_submitted_by parameter anywhere in the signature.
  const signature = body.slice(0, body.indexOf(")"));
  assert.doesNotMatch(signature, /p_member_id|p_profile_id|p_submitted_by/i, "Must never accept a client-supplied owner id");
  assert.match(body, /auth\.uid\(\), p_primary_lesson_id/, "The insert's submitted_by must come from auth.uid(), not a parameter");
});

test("[SOURCE SCAN] submit_testimony_idempotent validates the idempotency key's format before using it", () => {
  const body = functionBody("submit_testimony_idempotent", RPC_ARGS);
  assert.match(body, /if p_idempotency_key is null or btrim\(p_idempotency_key\) = '' then/);
  assert.match(body, /raise exception 'Invalid idempotency key format\.';/);
  assert.match(body, /\^\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{12\}\$/i, "Expected an explicit UUID-shape check, not just an implicit ::uuid cast");
});

test("[SOURCE SCAN] submit_testimony_idempotent returns an already-existing (profile, key) row instead of inserting a second one -- the same-key-retry-returns-same-result guarantee", () => {
  const body = functionBody("submit_testimony_idempotent", RPC_ARGS);
  const preCheckIdx = body.indexOf("select * into v_existing");
  const insertIdx = body.indexOf("insert into public.testimonies");
  assert.ok(preCheckIdx !== -1 && insertIdx !== -1 && preCheckIdx < insertIdx, "Expected a pre-insert existence check before the insert");
  assert.match(body, /where submitted_by = auth\.uid\(\) and idempotency_key = v_key;\s*\n\s*if v_existing\.id is not null then\s*\n\s*return v_existing;/);
});

test("[SOURCE SCAN] submit_testimony_idempotent handles a concurrent-race unique_violation by returning the winning row, not by erroring, but only for the idempotency constraint specifically", () => {
  const body = functionBody("submit_testimony_idempotent", RPC_ARGS);
  assert.match(body, /exception when unique_violation then/);
  assert.match(body, /get stacked diagnostics v_constraint = constraint_name;/, "Must inspect which constraint actually fired");
  assert.match(
    body,
    /if v_constraint = 'testimonies_submitted_by_idempotency_key_key' then[\s\S]*?return v_existing;\s*\n\s*end if;\s*\n\s*raise;/,
    "A unique_violation on any OTHER constraint must be re-raised as a real error, not silently treated as success"
  );
});

test("[SOURCE SCAN] submit_testimony_idempotent never sets church_id/display_name itself -- testimonies_before_insert (0018) still derives and enforces them on every insert this RPC performs", () => {
  const body = functionBody("submit_testimony_idempotent", RPC_ARGS);
  const insertMatch = body.match(/insert into public\.testimonies \(([\s\S]*?)\)\s*values/);
  assert.ok(insertMatch, "Expected to find the insert's column list");
  assert.doesNotMatch(insertMatch![1], /\bchurch_id\b/, "church_id must not be set directly -- it must come from the existing before-insert trigger");
  assert.doesNotMatch(insertMatch![1], /\bdisplay_name\b/, "display_name must not be set directly -- it must come from the existing before-insert trigger");
});

test("[SOURCE SCAN] submit_testimony_idempotent is granted to authenticated only, never public", () => {
  assert.match(sql, /revoke all on function public\.submit_testimony_idempotent\(/);
  assert.match(sql, /grant execute on function public\.submit_testimony_idempotent\([\s\S]*?\) to authenticated;/);
});

test("[SOURCE SCAN] testimonies_before_insert's lesson-completion and church-derivation checks are unmodified by this migration", () => {
  // Confirms the pre-existing enforcement this RPC relies on is still present verbatim in 0018,
  // not accidentally weakened by this migration touching the same table.
  assert.match(sql, /raise exception 'You can only submit a testimony for a lesson you have completed\.';/);
  assert.match(sql, /raise exception 'You can only attach lessons you have completed\.';/);
  assert.match(sql, /new\.church_id := v_church_id;/);
});

// ---------------------------------------------------------------------------
// SOURCE SCAN: application code wiring
// ---------------------------------------------------------------------------

test("[SOURCE SCAN] createTestimony calls the idempotent RPC, not a plain insert, and passes no member/profile id parameter", () => {
  const src = readFileSync(path.join(REPO_ROOT, "services", "supabase", "testimonies.ts"), "utf8");
  const fnMatch = src.match(/export async function createTestimony\([\s\S]*?\n}/);
  assert.ok(fnMatch, "Expected createTestimony's function body");
  assert.match(fnMatch![0], /supabase\.rpc\("submit_testimony_idempotent"/);
  assert.doesNotMatch(fnMatch![0], /p_member_id|p_profile_id|p_submitted_by/i);
  assert.match(fnMatch![0], /p_idempotency_key: input\.idempotencyKey/);
});

test("[SOURCE SCAN] SubmitTestimonyForm generates its idempotency key once per mount (lazy useState initializer), not on every render or every submit", () => {
  const src = readFileSync(path.join(REPO_ROOT, "app", "kingdom-scroll", "submit", "SubmitTestimonyForm.tsx"), "utf8");
  assert.match(
    src,
    /const \[idempotencyKey\] = useState\(\(\) => crypto\.randomUUID\(\)\);/,
    "Expected a lazy useState initializer -- this is what makes every retry of the same submission reuse the same key, while a fresh page load (a genuinely new submission) gets a fresh one"
  );
});

test("[SOURCE SCAN] SubmitTestimonyForm has a synchronous reentrancy guard before any async work, matching the established EditExperienceForm.tsx pattern", () => {
  const src = readFileSync(path.join(REPO_ROOT, "app", "kingdom-scroll", "submit", "SubmitTestimonyForm.tsx"), "utf8");
  const fnStart = src.indexOf("async function handleSubmit");
  const body = src.slice(fnStart, fnStart + 700);
  const guardIdx = body.indexOf("if (submitting) return;");
  const setSubmittingIdx = body.indexOf("setSubmitting(true)");
  const awaitIdx = body.indexOf("await submitTestimonyAction");
  assert.ok(guardIdx !== -1, "Expected a synchronous `if (submitting) return;` guard");
  assert.ok(guardIdx < setSubmittingIdx && setSubmittingIdx < awaitIdx, "Guard must run before setSubmitting and before any await");
});

test("[SOURCE SCAN] the Submit Testimony button is disabled while submitting, covering the mouse-click case", () => {
  const src = readFileSync(path.join(REPO_ROOT, "app", "kingdom-scroll", "submit", "SubmitTestimonyForm.tsx"), "utf8");
  assert.match(src, /<Button type="submit" disabled=\{submitting\}>/);
});

// ---------------------------------------------------------------------------
// TRUE TEST: isValidUuid, the shared client/server-defense-in-depth format check
// ---------------------------------------------------------------------------

test("[TRUE TEST] isValidUuid accepts well-formed UUIDs in any case", () => {
  assert.equal(isValidUuid("3fa85f64-5717-4562-b3fc-2c963f66afa6"), true);
  assert.equal(isValidUuid("3FA85F64-5717-4562-B3FC-2C963F66AFA6"), true);
});

test("[TRUE TEST] isValidUuid rejects a malformed key -- wrong shape, missing segments, extra characters, plain text", () => {
  for (const bad of ["", "not-a-uuid", "3fa85f64571745623fc2c963f66afa6", "3fa85f64-5717-4562-b3fc", "'; drop table testimonies; --", "3fa85f64-5717-4562-b3fc-2c963f66afa6-extra"]) {
    assert.equal(isValidUuid(bad), false, `Expected "${bad}" to be rejected`);
  }
});

test("[TRUE TEST] two calls to crypto.randomUUID() (what the form calls once per mount) produce different keys -- confirms an intentional new submission on a fresh mount naturally gets a different key", () => {
  const a = crypto.randomUUID();
  const b = crypto.randomUUID();
  assert.notEqual(a, b);
  assert.equal(isValidUuid(a), true);
  assert.equal(isValidUuid(b), true);
});

// ---------------------------------------------------------------------------
// SOURCE SCAN: existing reward-duplication protection and the gap this fix closes
// ---------------------------------------------------------------------------

test("[SOURCE SCAN] member_badge_awards' unique(member_id, badge_id) already fully protects badges from duplication, independent of this fix -- 'on conflict do nothing' makes any repeat award attempt a safe no-op regardless of how many source rows exist", () => {
  const tableMatch = sql.match(/create table public\.member_badge_awards \([\s\S]*?\n\);/);
  assert.ok(tableMatch);
  assert.match(tableMatch![0], /unique \(member_id, badge_id\)/);
  const awardBody = functionBody("award_progression_event", "[\\s\\S]*?", "private");
  assert.match(awardBody, /on conflict \(member_id, badge_id\) do nothing;/);
});

test("[SOURCE SCAN] progression_award_log's unique(member_id, event_type, source_row_id) protects a SINGLE row from double-firing the same event, but does NOT by itself protect against duplicate ROWS each independently firing a valid-looking event -- this is the exact gap the idempotency-key index closes by preventing the duplicate rows from ever existing", () => {
  const tableMatch = sql.match(/create table public\.progression_award_log \([\s\S]*?\n\);/);
  assert.ok(tableMatch);
  assert.match(tableMatch![0], /unique \(member_id, event_type, source_row_id\)/);
  // testimony_submitted's source_row_id is the testimony's own id (new.id) -- a distinct value per
  // duplicate testimony row, so this constraint alone does not dedupe across duplicate rows.
  const trigger = sql.match(/create or replace function public\.award_progression_on_testimony_submitted\(\)[\s\S]*?\$\$;/);
  assert.ok(trigger);
  assert.match(trigger![0], /perform private\.award_progression_event\(new\.submitted_by, 'testimony_submitted', new\.id,/);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

// Repair Batch 3, D22 (Trello Hv90Iye0): "First Lesson Completed" badge (and its Points/XP) never
// fired on a real Studied-stage completion, because the trigger checked current_stage transitioning
// into 'studied' -- but a journey is created ALREADY at 'studied' and completion moves it FORWARD
// to 'experienced', so that condition was structurally unreachable. Fixed (0037) by switching to
// studied_completed_at's null -> non-null transition, the same signal already used correctly
// elsewhere on this table (testimonies_before_insert, 0018; church_experience_journey_sync, 0026).
//
// [SOURCE SCAN]: this repo has no live Supabase project wired into `npm test` -- these read the
// actual migration SQL directly rather than exercising a running database (same documented
// limitation as every other migration-level test file here, e.g. tests/creditWalletLedger.test.ts).

const MIGRATIONS_DIR = path.join(__dirname, "..", "supabase", "migrations");

function readAllMigrations(): string {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(path.join(MIGRATIONS_DIR, f), "utf8"))
    .join("\n");
}

const sql = readAllMigrations();

function lastFunctionBody(name: string, schema = "public"): string {
  const re = new RegExp(`create or replace function ${schema}\\.${name}\\(\\)[\\s\\S]*?\\$\\$;`, "g");
  const matches = sql.match(re);
  assert.ok(matches && matches.length > 0, `Expected ${schema}.${name}() to be defined`);
  return matches![matches!.length - 1];
}

test("[SOURCE SCAN] award_progression_on_lesson_studied's LATEST definition (0037) checks studied_completed_at's null->non-null transition, not current_stage", () => {
  const body = lastFunctionBody("award_progression_on_lesson_studied");
  assert.match(
    body,
    /if new\.studied_completed_at is null or old\.studied_completed_at is not null then\s*\n\s*return new;/,
    "Expected the corrected guard using studied_completed_at, matching the signal testimonies_before_insert (0018) already uses correctly for the same 'lesson studied' concept"
  );
  assert.doesNotMatch(
    body,
    /new\.current_stage <> 'studied'/,
    "The old, structurally-unreachable current_stage check must not still be present in the latest definition"
  );
});

test("[SOURCE SCAN] the corrected trigger still calls private.award_progression_event with the same parameters as before (member id, event type, journey row id, lesson id) -- only the guard condition changed", () => {
  const body = lastFunctionBody("award_progression_on_lesson_studied");
  assert.match(
    body,
    /perform private\.award_progression_event\(new\.user_id, 'lesson_studied', new\.id, new\.lesson_id, null, null\);/
  );
});

test("[SOURCE SCAN] the corrected function is still SECURITY DEFINER with search_path locked, matching every other trigger function in this schema", () => {
  const body = lastFunctionBody("award_progression_on_lesson_studied");
  assert.match(body, /security definer/i);
  assert.match(body, /set search_path = ''/);
});

test("[SOURCE SCAN] this fix does not touch the trigger definition itself, only the function body -- award_progression_on_lesson_studied_trigger is not re-created", () => {
  const fixMigration = readFileSync(
    path.join(MIGRATIONS_DIR, "0037_fix_lesson_studied_progression_trigger.sql"),
    "utf8"
  );
  assert.doesNotMatch(fixMigration, /create trigger/i, "0037 must only redefine the function, not re-create the trigger");
  // The original trigger creation (0033) must still be the only place the trigger is created.
  const triggerCreations = sql.match(/create trigger award_progression_on_lesson_studied_trigger/g) ?? [];
  assert.equal(triggerCreations.length, 1, "award_progression_on_lesson_studied_trigger must be created exactly once, in 0033");
});

test("[SOURCE SCAN] no data backfill or existing-row update is included in this migration -- the fix is not retroactive by design", () => {
  const fixMigration = readFileSync(
    path.join(MIGRATIONS_DIR, "0037_fix_lesson_studied_progression_trigger.sql"),
    "utf8"
  );
  assert.doesNotMatch(fixMigration, /\bupdate\s+public\./i, "0037 must not contain any UPDATE statement against application tables");
  assert.doesNotMatch(fixMigration, /\binsert\s+into\s+public\./i, "0037 must not contain any INSERT statement -- no backfill");
});

test("[SOURCE SCAN] the same studied_completed_at signal this fix adopts is already used correctly elsewhere on lesson_journeys, confirming this isn't a new/unproven pattern", () => {
  assert.match(sql, /j\.studied_completed_at is not null/, "testimonies_before_insert (0018) already relies on this exact signal");
  assert.match(sql, /and studied_completed_at is not null;/, "church_experience_journey_sync (0026) already relies on this exact signal");
});

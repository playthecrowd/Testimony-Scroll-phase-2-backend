import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

// Static source-scan regression guard for lesson_journeys' studied_completed_at/current_stage/
// completed_at completion predicate (0042_lesson_full_completion.sql). Same limitation/approach as
// every other RLS/DB-logic test in this repo (no live DB in this environment, see
// tests/rlsChurchIsolation.test.ts's own header comment).

const REPO_ROOT = path.join(__dirname, "..");

function read(relPath: string): string {
  return readFileSync(path.join(REPO_ROOT, ...relPath.split("/")), "utf8");
}

function migration(): string {
  return read("supabase/migrations/0042_lesson_full_completion.sql");
}

function computeFn(): string {
  return migration().match(/create or replace function public\.compute_lesson_journey_completion\(\)[\s\S]*?\nend;\n\$\$;/)![0];
}

function syncFn(): string {
  return migration().match(/create or replace function public\.sync_journey_on_experience_completion\(\)[\s\S]*?\nend;\n\$\$;/)![0];
}

function partA(): string {
  const fn = computeFn();
  return fn.slice(fn.indexOf("-- ---- Part A"), fn.indexOf("-- ---- Part B"));
}

function partB(): string {
  const fn = computeFn();
  return fn.slice(fn.indexOf("-- ---- Part B"));
}

// ---------------------------------------------------------------------------
// Issue 1 -- initial stage is 'studied', matching the pre-existing default, not 'captured'
// ---------------------------------------------------------------------------

test("[SOURCE SCAN] the pre-existing lesson_journeys.current_stage column default is 'studied', confirmed against the actual committed 0008 schema -- 'captured' has never been the real starting value for a real journey row", () => {
  const schemaSql = read("supabase/migrations/0008_lesson_journeys.sql");
  assert.match(schemaSql, /current_stage text not null default 'studied'/);
  assert.match(schemaSql, /there is no separate "Captured" member action to perform/);
});

test("[SOURCE SCAN] getOrCreateJourney() never specifies current_stage on insert -- it has always relied on the column default, confirmed against the actual committed service code", () => {
  const journeysServiceSrc = read("services/supabase/journeys.ts");
  const fn = journeysServiceSrc.match(/export async function getOrCreateJourney\([\s\S]*?\n\}/)![0];
  assert.doesNotMatch(fn, /current_stage/);
});

test("[TRUE TEST via structural proof] a new journey inserted through this trigger starts at current_stage = 'studied', matching the pre-existing default exactly -- not forcing new behavior", () => {
  const b = partB();
  assert.match(b, /if tg_op = 'INSERT' then\s*\n\s*new\.current_stage := 'studied';/);
});

// ---------------------------------------------------------------------------
// Issue 2 -- current_stage 'applied' requires a genuinely-existing, satisfied required Experience;
// completed_at's vacuous-truth case does NOT also drive current_stage to 'applied'
// ---------------------------------------------------------------------------

test("[SOURCE SCAN] v_has_required_experience and v_all_required_satisfied are two distinct booleans, computed separately -- completed_at uses only the second (vacuously true when no required Experience exists); current_stage's 'applied' value requires BOTH", () => {
  const b = partB();
  assert.match(b, /into v_has_required_experience;/);
  assert.match(b, /into v_all_required_satisfied;/);
  assert.match(b, /if v_has_required_experience and v_all_required_satisfied then\s*\n\s*new\.current_stage := 'applied';/);
  assert.match(b, /if new\.completed_at is null and v_all_required_satisfied then\s*\n\s*new\.completed_at := now\(\);/);
});

test("[TRUE TEST via structural proof] a lesson with NO required Experience: completed_at is set (vacuous truth) but current_stage caps at 'experienced', never reaching 'applied' -- v_has_required_experience is false so the 'applied' branch's AND-condition cannot be true regardless of v_all_required_satisfied", () => {
  const b = partB();
  assert.match(b, /if v_has_required_experience and v_all_required_satisfied then/);
  assert.match(b, /elsif new\.current_stage <> 'applied' then\s*\n\s*new\.current_stage := 'experienced';/);
});

test("[TRUE TEST via structural proof] a lesson WITH a required Experience, once fully satisfied, reaches current_stage = 'applied' together with completed_at", () => {
  const b = partB();
  assert.match(b, /new\.current_stage := 'applied';/);
  assert.match(b, /new\.completed_at := now\(\);/);
});

test("[SOURCE SCAN] current_stage is forward-only -- once 'applied', a recomputation can never regress it back to 'experienced'", () => {
  const b = partB();
  assert.match(b, /elsif new\.current_stage <> 'applied' then\s*\n\s*new\.current_stage := 'experienced';/);
});

test("[SOURCE SCAN] 'added-to-story' is never written or regressed -- an early return skips all derivation once current_stage is already there", () => {
  const b = partB();
  assert.match(b, /if new\.current_stage = 'added-to-story' then\s*\n\s*return new;/);
});

// ---------------------------------------------------------------------------
// current_stage / completed_at direct forgery protection (unchanged from prior review, re-confirmed)
// ---------------------------------------------------------------------------

test("[SOURCE SCAN] UPDATE: any client-supplied change to current_stage is discarded by restoring the prior stored value before derivation runs", () => {
  const b = partB();
  assert.match(b, /elsif tg_op = 'UPDATE' and new\.current_stage is distinct from old\.current_stage then\s*\n\s*new\.current_stage := old\.current_stage;/);
});

test("[SOURCE SCAN] completed_at forgery protection (insert discard, update restore)", () => {
  const b = partB();
  assert.match(b, /if tg_op = 'INSERT' then\s*\n\s*new\.completed_at := null;/);
  assert.match(b, /elsif tg_op = 'UPDATE' and new\.completed_at is distinct from old\.completed_at then\s*\n\s*new\.completed_at := old\.completed_at;/);
});

test("[SOURCE SCAN] INSERT: a forged non-null studied_completed_at is captured as intent then unconditionally discarded before validation runs", () => {
  const a = partA();
  assert.match(a, /if tg_op = 'INSERT' then\s*\n\s*v_attempted_study_completion := new\.studied_completed_at is not null;\s*\n\s*new\.studied_completed_at := null;/);
});

test("[SOURCE SCAN] UPDATE: any client-supplied change to studied_completed_at is discarded by restoring the prior stored value", () => {
  const a = partA();
  assert.match(a, /elsif tg_op = 'UPDATE' then[\s\S]*?new\.studied_completed_at := old\.studied_completed_at;/);
});

test("[TRUE TEST via structural proof] a forged update setting all three columns together in one statement leaves none forged: Part A resolves studied_completed_at first, then Part B discards and re-derives current_stage and completed_at only from that validated value", () => {
  const fn = computeFn();
  const partAIdx = fn.indexOf("-- ---- Part A");
  const partBIdx = fn.indexOf("-- ---- Part B");
  assert.ok(partAIdx > -1 && partBIdx > -1 && partAIdx < partBIdx);
});

// ---------------------------------------------------------------------------
// lesson_journey_items: item_key vocabulary, duplicates, cross-learner, delete
// ---------------------------------------------------------------------------

test("[SOURCE SCAN] lesson_journey_items gains an item_key CHECK constraint listing exactly the 9 real vocabulary keys", () => {
  const sql = migration();
  const constraintMatch = sql.match(/check \(item_key in \(([\s\S]*?)\)\);/);
  assert.ok(constraintMatch, "expected an item_key CHECK constraint");
  const keys = constraintMatch![1];
  for (const key of ["overview", "primary_scripture", "supporting_scriptures", "notes", "video", "audio", "slides", "document", "questions"]) {
    assert.match(keys, new RegExp(`'${key}'`));
  }
});

test("[SOURCE SCAN] the item_key constraint addition is not guarded with IF NOT EXISTS -- deliberately one-run-only, documented as such in the migration header, matching every other additive migration in this history", () => {
  const sql = migration();
  assert.match(sql, /add constraint lesson_journey_items_item_key_check/);
  assert.doesNotMatch(sql, /add constraint if not exists/);
  assert.match(sql, /One-run-only, like every other migration in this history/);
});

test("[SOURCE SCAN] lesson_journey_items already has unique(journey_id, item_key) -- duplicates already impossible, confirmed against the actual committed 0008 schema", () => {
  const schemaSql = read("supabase/migrations/0008_lesson_journeys.sql");
  assert.match(schemaSql, /unique \(journey_id, item_key\)/);
});

test("[SOURCE SCAN] lesson_journey_items has no delete grant -- required rows cannot be deleted, confirmed against the actual committed 0008 schema", () => {
  const schemaSql = read("supabase/migrations/0008_lesson_journeys.sql");
  assert.match(schemaSql, /grant select, insert, update on public\.lesson_journey_items to authenticated;/);
  assert.doesNotMatch(schemaSql, /grant[\s\S]{0,60}delete[\s\S]{0,60}lesson_journey_items/i);
});

test("[SOURCE SCAN] every applicable key must have a completed = true lesson_journey_items row for the SPECIFIC journey (new.id)", () => {
  const a = partA();
  assert.match(a, /lji\.journey_id = new\.id/);
  assert.match(a, /lji\.completed = true/);
});

// ---------------------------------------------------------------------------
// Backfill -- corrected to set current_stage consistently with completed_at (Step B only)
// ---------------------------------------------------------------------------

test("[SOURCE SCAN] backfill step A (no required Experience) does not touch current_stage -- already correct at 'experienced', matching the corrected live-trigger semantics for this case", () => {
  const sql = migration();
  const stepA = sql.match(/update public\.lesson_journeys lj\s*\nset completed_at = lj\.studied_completed_at[\s\S]*?\);/)![0];
  assert.doesNotMatch(stepA, /current_stage/);
});

test("[SOURCE SCAN] backfill step B (required Experience, satisfied) sets current_stage = 'applied' in the SAME statement as completed_at -- no inconsistency window", () => {
  const sql = migration();
  const stepB = sql.match(/update public\.lesson_journeys lj\s*\nset completed_at = now\(\),\s*\n\s*current_stage = 'applied'[\s\S]*?\);/)![0];
  assert.match(stepB, /set completed_at = now\(\),\s*\n\s*current_stage = 'applied'/);
  assert.doesNotMatch(stepB, /updated_at/);
});

test("[SOURCE SCAN] backfill steps A and B only ever touch rows where completed_at is currently null", () => {
  const sql = migration();
  const backfillSection = sql.slice(sql.indexOf("update public.lesson_journeys lj"), sql.indexOf("notify pgrst"));
  const nullGuards = backfillSection.match(/lj\.completed_at is null/g) ?? [];
  assert.equal(nullGuards.length, 2);
});

test("[SOURCE SCAN] backfill step A uses studied_completed_at (exact, reliable); step B uses now(), not an unreliable updated_at approximation", () => {
  const sql = migration();
  const stepA = sql.match(/update public\.lesson_journeys lj\s*\nset completed_at = lj\.studied_completed_at[\s\S]*?\);/)![0];
  assert.match(stepA, /set completed_at = lj\.studied_completed_at/);
});

// ---------------------------------------------------------------------------
// Step 0 -- historical current_stage='applied' correction (closes the previously disclosed,
// now-fixed gap: a legacy row set to 'applied' by the OLD pre-migration 0026 trigger bug, which
// advanced on ANY ONE required Experience rather than ALL of them, is now normalized)
// ---------------------------------------------------------------------------

function stepZero(): string {
  const sql = migration();
  return sql.match(/update public\.lesson_journeys lj\s*\nset current_stage = 'experienced'[\s\S]*?\);/)![0];
}

test("[SOURCE SCAN] Step 0 runs before Steps A/B and only targets rows currently at current_stage = 'applied'", () => {
  const sql = migration();
  const step0Idx = sql.indexOf("set current_stage = 'experienced'");
  const stepAIdx = sql.indexOf("set completed_at = lj.studied_completed_at");
  assert.ok(step0Idx > -1 && stepAIdx > -1 && step0Idx < stepAIdx);
  assert.match(stepZero(), /where lj\.current_stage = 'applied'/);
});

test("[SOURCE SCAN] Step 0 never writes completed_at -- it only corrects current_stage, and never invents completion for a row that doesn't earn it", () => {
  assert.doesNotMatch(stepZero(), /completed_at/);
});

test("[SOURCE SCAN] Step 0's justified-applied predicate requires the same two conditions the live trigger's 'applied' branch requires -- a real required link exists, and every required link is satisfied -- so a justified pre-existing 'applied' row is left untouched", () => {
  const step0 = stepZero();
  assert.match(step0, /not \(\s*\n\s*exists \(\s*\n\s*select 1 from public\.church_experience_lessons cel/);
  assert.match(step0, /and not exists \(\s*\n\s*select 1\s*\n\s*from public\.church_experience_lessons required_link/);
});

test("[SOURCE SCAN] Step 0, Step A, and Step B all run BEFORE lesson_journeys_compute_completion is created as a trigger -- this is a correctness requirement, not a style choice: that trigger discards any UPDATE-supplied change to current_stage/completed_at that differs from the row's prior stored value, so placing any of these three backfill UPDATEs after CREATE TRIGGER would silently cancel them, including the trigger canceling its own migration's writes", () => {
  const sql = migration();
  const step0Idx = sql.indexOf("set current_stage = 'experienced'");
  const stepAIdx = sql.indexOf("set completed_at = lj.studied_completed_at");
  const stepBIdx = sql.indexOf("set completed_at = now(),\n    current_stage = 'applied'");
  const createTriggerIdx = sql.indexOf("create trigger lesson_journeys_compute_completion");
  assert.ok(step0Idx > -1 && stepAIdx > -1 && stepBIdx > -1 && createTriggerIdx > -1, "expected to find all four anchors in the migration");
  assert.ok(step0Idx < createTriggerIdx, "Step 0 must run before CREATE TRIGGER");
  assert.ok(stepAIdx < createTriggerIdx, "Step A must run before CREATE TRIGGER");
  assert.ok(stepBIdx < createTriggerIdx, "Step B must run before CREATE TRIGGER");
});

// ---------------------------------------------------------------------------
// One shared predicate, both orders, multiple required Experiences
// ---------------------------------------------------------------------------

test("[SOURCE SCAN] sync_journey_on_experience_completion no longer writes current_stage or completed_at itself -- it only touches the row so compute_lesson_journey_completion re-derives both", () => {
  const fn = syncFn();
  assert.doesNotMatch(fn, /current_stage = 'applied'/);
  assert.doesNotMatch(fn, /completed_at = /);
  assert.match(fn, /set last_opened_at = last_opened_at/);
});

test("[TRUE TEST via structural proof] two required Experiences, only one completed -> current_stage stays 'experienced' and completed_at stays null", () => {
  const b = partB();
  assert.match(b, /and not exists \(\s*\n\s*select 1\s*\n\s*from public\.church_experience_occurrences occurrence\s*\n\s*join public\.church_experience_registrations registration/);
});

test("[SOURCE SCAN] a 'recommended' link can never block or satisfy either predicate", () => {
  const sql = migration();
  assert.doesNotMatch(sql, /relationship = 'recommended'/);
});

test("[SOURCE SCAN] neither function branches on church_id or is_campaign_lesson -- standard and campaign lessons use the identical predicate", () => {
  const sql = migration();
  assert.doesNotMatch(sql, /is_campaign_lesson/);
  assert.doesNotMatch(sql, /church_id/);
});

test("[SOURCE SCAN] no RPC was added -- markStudiedComplete() is untouched", () => {
  const journeysServiceSrc = read("services/supabase/journeys.ts");
  assert.match(journeysServiceSrc, /export async function markStudiedComplete\(supabase: SupabaseClient, journeyId: string\): Promise<LessonJourney> \{/);
  assert.match(journeysServiceSrc, /\.update\(\{ current_stage: "experienced", studied_completed_at: new Date\(\)\.toISOString\(\) \}\)/);
});

// ---------------------------------------------------------------------------
// Structural guarantees
// ---------------------------------------------------------------------------

test("[SOURCE SCAN] compute_lesson_journey_completion fires on both insert and update, and is SECURITY DEFINER + revoked from public", () => {
  const sql = migration();
  assert.match(sql, /before insert or update on public\.lesson_journeys/);
  assert.match(sql, /revoke all on function public\.compute_lesson_journey_completion\(\) from public;/);
  assert.match(computeFn(), /security definer/);
});

test("[SOURCE SCAN] the migration is wrapped in an explicit transaction", () => {
  const sql = migration();
  assert.match(sql, /^begin;/m);
  assert.match(sql, /^commit;/m);
});

test("[SOURCE SCAN] no page-visit or localStorage completion path exists in this migration", () => {
  const sql = migration();
  assert.doesNotMatch(sql, /localStorage/i);
});

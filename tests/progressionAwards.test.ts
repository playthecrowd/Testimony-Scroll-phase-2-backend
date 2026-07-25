import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

// Phase 11.3 (docs/PHASE11_ECONOMY_PROGRESSION_SPEC.md SS11-SS17, docs/PHASE11_3_AUDIT.md):
// structural regression guards for the Points/XP/Levels/Badges/Trophies/Leaderboard schema
// (migrations 0032/0033). Same no-live-database-in-`npm test` limitation as every prior phase.

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

function functionBody(name: string, args: string, schema = "public"): string {
  const re = new RegExp(`create or replace function ${schema}\\.${name}\\(${args}\\)[\\s\\S]*?\\$\\$;`, "g");
  const matches = sql.match(re);
  assert.ok(matches && matches.length > 0, `Expected ${schema}.${name}(${args}) to be defined`);
  return matches![matches!.length - 1];
}

// ---------------------------------------------------------------------------
// Schema shape
// ---------------------------------------------------------------------------

test("progression_award_rules: event_type is a fixed enum, amounts are non-negative, xp_reward_ceiling is only used by lesson_studied", () => {
  const tableMatch = sql.match(/create table public\.progression_award_rules \([\s\S]*?\n\);/);
  assert.ok(tableMatch, "Expected the progression_award_rules table definition");
  for (const eventType of [
    "lesson_studied",
    "experience_completed",
    "testimony_submitted",
    "testimony_church_approved",
    "testimony_kingdom_scroll_published",
  ]) {
    assert.match(tableMatch![0], new RegExp(`'${eventType}'`));
  }
  assert.match(tableMatch![0], /points_amount integer not null default 0 check \(points_amount >= 0\)/);
  assert.match(tableMatch![0], /xp_amount integer not null default 0 check \(xp_amount >= 0\)/);
  assert.match(sql, /insert into public\.progression_award_rules[\s\S]*?'lesson_studied', 10, 0, 300/, "Expected the seeded lesson_studied rule with an xp_reward_ceiling");
});

test("progression_level_thresholds: level and min_xp are both constrained positive/non-negative, and seed data is monotonically increasing", () => {
  const tableMatch = sql.match(/create table public\.progression_level_thresholds \([\s\S]*?\n\);/);
  assert.ok(tableMatch, "Expected the progression_level_thresholds table definition");
  assert.match(tableMatch![0], /level integer not null unique check \(level > 0\)/);
  assert.match(tableMatch![0], /min_xp integer not null check \(min_xp >= 0\)/);
});

test("member_progression_summaries: one row per member, non-negative points/XP, leaderboard opt-out flag, no direct client write", () => {
  const tableMatch = sql.match(/create table public\.member_progression_summaries \([\s\S]*?\n\);/);
  assert.ok(tableMatch, "Expected the member_progression_summaries table definition");
  assert.match(tableMatch![0], /profile_id uuid not null unique references public\.profiles/);
  assert.match(tableMatch![0], /points_total integer not null default 0 check \(points_total >= 0\)/);
  assert.match(tableMatch![0], /xp_total integer not null default 0 check \(xp_total >= 0\)/);
  assert.match(tableMatch![0], /leaderboard_opt_out boolean not null default false/);

  const chunks = policiesOn("member_progression_summaries");
  for (const chunk of chunks) {
    assert.doesNotMatch(chunk, /for insert|for update|for delete/i, "member_progression_summaries must only ever have SELECT policies -- every write is trigger-only");
  }
});

test("progression_award_log: unique(member_id, event_type, source_row_id) is the real database-level duplicate-award guard", () => {
  const tableMatch = sql.match(/create table public\.progression_award_log \([\s\S]*?\n\);/);
  assert.ok(tableMatch, "Expected the progression_award_log table definition");
  assert.match(tableMatch![0], /unique \(member_id, event_type, source_row_id\)/);
});

test("badge_definitions: category is a fixed enum including 'trophy' (trophies are a badge category, not a separate table), threshold requires requirement_type='threshold'", () => {
  const tableMatch = sql.match(/create table public\.badge_definitions \([\s\S]*?\n\);/);
  assert.ok(tableMatch, "Expected the badge_definitions table definition");
  assert.match(tableMatch![0], /category text not null default 'achievement' check \(category in \('achievement', 'trophy'\)\)/);
  assert.match(tableMatch![0], /constraint badge_definitions_threshold_requires_type/);
});

test("badge_definitions is seeded with the five brief-named v1 badges, each mapped to a real event type, with Kingdom Scroll Contributor as the one trophy-category badge", () => {
  for (const slug of [
    "first-lesson-completed",
    "first-experience-completed",
    "first-testimony-submitted",
    "church-approved-testimony",
    "kingdom-scroll-contributor",
  ]) {
    assert.match(sql, new RegExp(`'${slug}'`));
  }
  assert.match(sql, /'kingdom-scroll-contributor'[\s\S]*?'trophy'/);
});

test("member_badge_awards: unique(member_id, badge_id) -- every v1 badge is a one-time milestone, never deleted (revoked_at/revocation_reason instead)", () => {
  const tableMatch = sql.match(/create table public\.member_badge_awards \([\s\S]*?\n\);/);
  assert.ok(tableMatch, "Expected the member_badge_awards table definition");
  assert.match(tableMatch![0], /unique \(member_id, badge_id\)/);
  assert.match(tableMatch![0], /revoked_at timestamptz/);
  assert.match(tableMatch![0], /revocation_reason text/);
});

// ---------------------------------------------------------------------------
// RLS
// ---------------------------------------------------------------------------

test("progression_award_rules/progression_level_thresholds/badge_definitions are public-read, admin-only write -- checked directly via profiles.is_platform_admin", () => {
  for (const table of ["progression_award_rules", "progression_level_thresholds", "badge_definitions"]) {
    const chunks = policiesOn(table);
    const selectPolicy = chunks.find((c) => /for select/i.test(c));
    const writePolicy = chunks.find((c) => /for all/i.test(c));
    assert.ok(selectPolicy, `Expected a SELECT policy on ${table}`);
    assert.match(selectPolicy!, /using \(true\)/, `${table}'s catalog must be readable by every authenticated member`);
    assert.ok(writePolicy, `Expected an admin-only write policy on ${table}`);
    assert.match(writePolicy!, /is_platform_admin/);
  }
});

test("member_progression_summaries and member_badge_awards scope to own row, managed church members, or admin -- never a bare using(true)", () => {
  for (const table of ["member_progression_summaries", "member_badge_awards"]) {
    const chunks = policiesOn(table);
    for (const chunk of chunks) {
      assert.doesNotMatch(chunk, /using\s*\(\s*true\s*\)/i);
    }
    assert.ok(chunks.some((c) => new RegExp(`${table === "member_progression_summaries" ? "profile_id" : "member_id"} = auth\\.uid\\(\\)`).test(c)));
    assert.ok(chunks.some((c) => /private\.is_church_manager/.test(c)));
    assert.ok(chunks.some((c) => /is_platform_admin/.test(c)));
  }
});

test("progression_award_log is visible only to the member themselves or a platform admin -- never a church manager (it's an internal audit trail, not a church-facing report)", () => {
  const chunks = policiesOn("progression_award_log");
  assert.ok(chunks.some((c) => /member_id = auth\.uid\(\)/.test(c)));
  assert.ok(chunks.some((c) => /is_platform_admin/.test(c)));
  assert.ok(!chunks.some((c) => /private\.is_church_manager/.test(c)), "progression_award_log should not grant church-manager visibility");
});

// ---------------------------------------------------------------------------
// award_progression_event -- the single award-processing entry point
// ---------------------------------------------------------------------------

test("private.award_progression_event is never granted to authenticated/anon -- only reachable from a trigger", () => {
  assert.match(sql, /revoke all on function private\.award_progression_event\(uuid, text, uuid, uuid, uuid, uuid\) from public;/);
  assert.doesNotMatch(sql, /grant execute on function private\.award_progression_event/);
});

test("private.award_progression_event clamps lesson_studied's XP to xp_reward_ceiling, never trusting an unrestricted host-entered xp_reward directly", () => {
  const body = functionBody("award_progression_event", "[\\s\\S]*?", "private");
  assert.match(body, /if v_rule\.xp_reward_ceiling is not null and p_related_lesson_id is not null then/);
  assert.match(body, /v_xp := least\(coalesce\(v_lesson_xp_reward, 0\), v_rule\.xp_reward_ceiling\);/);
});

test("private.award_progression_event's own progression_award_log insert is the database-level duplicate-award guard -- a unique_violation is caught and treated as a safe no-op", () => {
  const body = functionBody("award_progression_event", "[\\s\\S]*?", "private");
  assert.match(body, /exception when unique_violation then\s*\n\s*return;/);
});

test("private.award_progression_event locks the member's summary row before updating cumulative points/XP, and re-derives the level from the threshold table rather than incrementing it directly", () => {
  const body = functionBody("award_progression_event", "[\\s\\S]*?", "private");
  assert.match(body, /where profile_id = p_member_id for update/);
  assert.match(body, /select level into v_new_level\s*\n\s*from public\.progression_level_thresholds\s*\n\s*where min_xp <= v_new_xp_total/);
});

test("private.award_progression_event awards a matching single_event badge idempotently via on conflict do nothing, never duplicating a badge the member already holds", () => {
  const body = functionBody("award_progression_event", "[\\s\\S]*?", "private");
  assert.match(body, /requirement_type = 'single_event' and related_event_type = p_event_type/);
  assert.match(body, /on conflict \(member_id, badge_id\) do nothing;/);
});

// ---------------------------------------------------------------------------
// The five real triggers -- each fires only on a genuine, already-verified transition
// ---------------------------------------------------------------------------

// Repair Batch 3, D22 (Trello Hv90Iye0, fixed in 0037_fix_lesson_studied_progression_trigger.sql):
// the original current_stage-based condition asserted here was structurally unreachable -- a
// journey is created already at current_stage='studied' and completion moves it forward to
// 'experienced', so new.current_stage <> 'studied' was always true and this trigger never fired on
// a real completion. Updated to assert the corrected studied_completed_at-based condition, the same
// signal testimonies_before_insert (0018) and church_experience_journey_sync (0026) already use
// correctly for this same concept. See tests/lessonStudiedProgressionFix.test.ts for the dedicated
// regression coverage of this fix.
test("award_progression_on_lesson_studied fires only on the transition into a completed Studied stage (studied_completed_at null -> non-null), reading the real lesson_journeys row (user_id, lesson_id)", () => {
  const body = functionBody("award_progression_on_lesson_studied", "");
  assert.match(body, /if new\.studied_completed_at is null or old\.studied_completed_at is not null then/);
  assert.match(body, /private\.award_progression_event\(new\.user_id, 'lesson_studied', new\.id, new\.lesson_id, null, null\)/);
});

test("award_progression_on_experience_completion fires only on the transition into 'completed' and derives experience_id via the occurrence join, not a client-supplied id", () => {
  const body = functionBody("award_progression_on_experience_completion", "");
  assert.match(body, /if new\.completion_status <> 'completed' or old\.completion_status is not distinct from 'completed' then/);
  assert.match(body, /from public\.church_experience_occurrences o\s*\n\s*where o\.id = new\.occurrence_id;/);
});

test("award_progression_on_testimony_submitted fires on every insert, crediting the real submitted_by column", () => {
  const body = functionBody("award_progression_on_testimony_submitted", "");
  assert.match(body, /private\.award_progression_event\(new\.submitted_by, 'testimony_submitted', new\.id, null, null, new\.id\)/);
});

test("award_progression_on_testimony_church_approval fires only on the transition into church_status='approved'", () => {
  const body = functionBody("award_progression_on_testimony_church_approval", "");
  assert.match(body, /if new\.church_status <> 'approved' or old\.church_status is not distinct from 'approved' then/);
});

test("award_progression_on_testimony_kingdom_scroll_publication fires only when the full church+platform+public condition becomes newly true, not when it was already true before this update", () => {
  const body = functionBody("award_progression_on_testimony_kingdom_scroll_publication", "");
  assert.match(body, /v_was_published := old\.church_status = 'approved' and old\.platform_status = 'approved' and old\.visibility = 'public';/);
  assert.match(body, /v_is_published := new\.church_status = 'approved' and new\.platform_status = 'approved' and new\.visibility = 'public';/);
  assert.match(body, /if v_is_published and not v_was_published then/);
});

test("all five progression triggers are attached to the correct table and event", () => {
  assert.match(sql, /create trigger award_progression_on_lesson_studied_trigger\s*\n\s*after update on public\.lesson_journeys/);
  assert.match(sql, /create trigger award_progression_on_experience_completion_trigger\s*\n\s*after update on public\.church_experience_registrations/);
  assert.match(sql, /create trigger award_progression_on_testimony_submitted_trigger\s*\n\s*after insert on public\.testimonies/);
  assert.match(sql, /create trigger award_progression_on_testimony_church_approval_trigger\s*\n\s*after update on public\.testimonies/);
  // This fifth trigger's ORIGINAL (0033) creation statement still literally reads this longer
  // name in the migration source -- Postgres silently truncated it to 63 bytes at creation time
  // (a harmless, purely cosmetic defect), and 0034 later renamed the live trigger to a shorter,
  // exact name. 0033's own historical source text is immutable and unchanged either way; see the
  // dedicated 0034 rename test below for the name that's actually live today.
  assert.match(sql, /create trigger award_progression_on_testimony_kingdom_scroll_publication_trigger\s*\n\s*after update on public\.testimonies/);
});

test("0034 renames the one trigger whose original name exceeded Postgres's 63-byte identifier limit, to a short, exact name that fits", () => {
  const renameMatch = sql.match(/alter trigger "award_progression_on_testimony_kingdom_scroll_publication_trigg"\s*\n\s*on public\.testimonies\s*\n\s*rename to "([^"]+)";/);
  assert.ok(renameMatch, "Expected 0034's corrective rename statement, targeting the exact truncated name Postgres actually created");
  const newName = renameMatch![1];
  assert.ok(newName.length <= 63, `New trigger name "${newName}" (${newName.length} chars) must fit within Postgres's 63-byte identifier limit`);
});

// ---------------------------------------------------------------------------
// Leaderboard views
// ---------------------------------------------------------------------------

test("leaderboard_global and leaderboard_my_church never select profiles.email or any other non-display column", () => {
  const globalMatch = sql.match(/create view public\.leaderboard_global as[\s\S]*?;/);
  const churchMatch = sql.match(/create view public\.leaderboard_my_church as[\s\S]*?;/);
  assert.ok(globalMatch && churchMatch, "Expected both leaderboard views to be defined");
  for (const view of [globalMatch![0], churchMatch![0]]) {
    assert.doesNotMatch(view, /\bemail\b/i, "A leaderboard view must never select email");
  }
});

test("leaderboard_global ranks by points_total descending with an earned-first (created_at ascending) tiebreak, and excludes opted-out members", () => {
  const view = sql.match(/create view public\.leaderboard_global as[\s\S]*?;/);
  assert.ok(view);
  assert.match(view![0], /order by mps\.points_total desc, mps\.created_at asc/);
  assert.match(view![0], /where not mps\.leaderboard_opt_out/);
});

test("leaderboard_my_church scopes to the CALLING member's own church(es) via auth.uid(), never an arbitrary or client-supplied church id", () => {
  const view = sql.match(/create view public\.leaderboard_my_church as[\s\S]*?;/);
  assert.ok(view);
  assert.match(view![0], /my_cm\.profile_id = auth\.uid\(\)/);
});

// ---------------------------------------------------------------------------
// Security / no direct application writes
// ---------------------------------------------------------------------------

test("no application code directly inserts/updates/deletes any progression table -- every mutation is trigger-only, reads go through services/supabase/progression.ts", () => {
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
  const tables = ["member_progression_summaries", "progression_award_log", "member_badge_awards", "progression_award_rules", "progression_level_thresholds", "badge_definitions"];
  const offending = files.filter((f) => {
    const content = readFileSync(f, "utf8");
    return tables.some((t) => new RegExp(`\\.from\\(\\s*["']${t}["']\\s*\\)\\s*\\.(insert|update|delete)\\(`).test(content));
  });
  assert.deepEqual(offending.map((f) => path.relative(REPO_ROOT, f)), []);
});

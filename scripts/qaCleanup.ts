// Guarded QA data removal script -- companion to scripts/qaSeed.ts. NOT run automatically, NOT
// part of deployment or application startup. Intended use: after QA testing on the shared
// pre-launch development and QA database is complete, and BEFORE the platform accepts real users
// -- see docs/QA_SHARED_DATABASE.md's pre-launch checklist.
//
// Scope: removes ONLY rows provably belonging to the five approved QA identities
// (qa.church-a-host@, qa.church-a-member@, qa.church-b-host@, qa.church-b-member@,
// qa.platform-admin@ -- all @qa.quest4thekingdom.com) and the two QA churches they created/joined.
// Never touches global reference/catalog data (badge_definitions, progression_award_rules,
// progression_level_thresholds, experiences, characters, episodes), never touches any other
// profile/church, and never truncates or resets any table.
//
// How deletion actually works: this schema cascades extremely broadly from `churches.id` and
// `profiles.id` (verified against every migration's `on delete cascade`/`set null` clause -- see
// the comment block above DELETION_ORDER below). Deleting the 2 QA churches, then the 5 QA auth
// users (which cascades to their profiles), is sufficient for Postgres to correctly remove every
// dependent row across ~20 tables in the right order automatically. This script does NOT hand-roll
// per-table deletes for that reason -- doing so would just be a worse-audited reimplementation of
// what Postgres's own FK graph already guarantees. What this script DOES do by hand is compute an
// itemized, per-table COUNT before deleting (the "manifest"), and re-verify every count is zero
// after -- so nothing is trusted blindly.
//
// Safety, all fail-closed (same mechanism as qaSeed.ts, plus a second, distinct confirmation):
//   - Refuses to run unless the project ref, QA_ENVIRONMENT, and QA_EMAIL_DOMAIN guards all match,
//     exactly like qaSeed.ts.
//   - --execute additionally requires ALLOW_QA_CLEANUP=true (deliberately a different variable
//     from qaSeed.ts's ALLOW_QA_SEED, so approving seeding never accidentally approves cleanup)
//     AND CONFIRM_QA_CLEANUP=yes-delete-qa-data (a second, distinct confirmation).
//   - Refuses to delete a church unless it matches an expected QA name AND is_demo=true AND was
//     created_by one of the five QA profile ids -- never just "any church named similarly."
//   - Refuses to delete an auth user unless its own qa_seed/qa_label metadata matches one of the
//     five approved identities exactly (same collision check as qaSeed.ts).
//   - Never issues a DELETE with no WHERE clause / no id list. Every delete in this file is scoped
//     to an explicit, previously-verified list of ids.
//   - Defaults to --dry-run: computes and prints the full manifest, deletes nothing.
//   - Never logs a password, token, cookie, or the service-role key.
//
// Usage:
//   npx tsx scripts/qaCleanup.ts --dry-run     (default; read-only manifest)
//   npx tsx scripts/qaCleanup.ts --execute     (deletes QA data from the approved project only)

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient as createSupabaseClient, SupabaseClient } from "@supabase/supabase-js";

function loadEnvFile(filename: string) {
  const path = resolve(process.cwd(), filename);
  if (!existsSync(path)) return;
  const contents = readFileSync(path, "utf8");
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(".env.qa.local");

const DRY_RUN = !process.argv.includes("--execute");

function fail(message: string): never {
  console.error(`\n[qaCleanup] REFUSING TO RUN: ${message}\n`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Guards -- identical project/environment/domain checks as qaSeed.ts, plus cleanup-specific ones.
// ---------------------------------------------------------------------------

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const approvedProjectRef = process.env.QA_SUPABASE_PROJECT_REF;
const qaEnvironment = process.env.QA_ENVIRONMENT;
const qaEmailDomain = process.env.QA_EMAIL_DOMAIN;

if (!url || !serviceRoleKey) {
  fail("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.qa.local.");
}

const projectRefMatch = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/i);
if (!projectRefMatch) fail(`NEXT_PUBLIC_SUPABASE_URL ("${url}") doesn't look like https://<ref>.supabase.co.`);
const actualProjectRef = projectRefMatch[1];

if (!approvedProjectRef) fail("QA_SUPABASE_PROJECT_REF is not set.");
if (approvedProjectRef !== actualProjectRef) {
  fail(`QA_SUPABASE_PROJECT_REF ("${approvedProjectRef}") does not match the URL's project ref ("${actualProjectRef}"). Refusing.`);
}

if (qaEnvironment !== "shared-prelaunch-dev-qa") {
  fail('QA_ENVIRONMENT must be exactly "shared-prelaunch-dev-qa".');
}

const APPROVED_QA_EMAIL_DOMAIN = "qa.quest4thekingdom.com";
if (qaEmailDomain !== APPROVED_QA_EMAIL_DOMAIN) {
  fail(`QA_EMAIL_DOMAIN must be exactly "${APPROVED_QA_EMAIL_DOMAIN}", not "${qaEmailDomain ?? "(unset)"}".`);
}

if (!DRY_RUN) {
  if (process.env.ALLOW_QA_CLEANUP !== "true") {
    fail('ALLOW_QA_CLEANUP must be exactly "true" to run in --execute mode. This is deliberately separate from ALLOW_QA_SEED.');
  }
  if (process.env.CONFIRM_QA_CLEANUP !== "yes-delete-qa-data") {
    fail('CONFIRM_QA_CLEANUP must be exactly "yes-delete-qa-data" -- a second, distinct confirmation beyond ALLOW_QA_CLEANUP.');
  }
}

const QA_EMAIL_PATTERN = new RegExp(`^qa\\.[a-z0-9-]+@${qaEmailDomain.replace(/\./g, "\\.")}$`);
const EXPECTED_QA_KEYS = ["church-a-host", "church-a-member", "church-b-host", "church-b-member", "platform-admin"] as const;
const EXPECTED_CHURCH_NAMES = ["Quest for the Kingdom QA -- Church A", "Quest for the Kingdom QA -- Church B"];

const admin: SupabaseClient = createSupabaseClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------------------------------------------------------------------------
// Discovery -- find the exact QA identities/churches, refusing anything ambiguous.
// ---------------------------------------------------------------------------

interface QaUser {
  id: string;
  email: string;
  qaLabel: string;
}

async function discoverQaUsers(): Promise<QaUser[]> {
  const found: QaUser[] = [];
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    for (const u of data.users) {
      const email = u.email ?? "";
      if (!QA_EMAIL_PATTERN.test(email)) continue; // never touched -- outside the approved domain
      const meta = u.user_metadata ?? {};
      if (meta.qa_seed !== true || typeof meta.qa_label !== "string" || !EXPECTED_QA_KEYS.includes(meta.qa_label as (typeof EXPECTED_QA_KEYS)[number])) {
        fail(
          `Found an auth user on the QA domain (${email}) without valid qa_seed/qa_label metadata matching one ` +
            `of the five approved identities. Refusing to touch it -- this is an unidentified record, not ` +
            `something this script created. Investigate manually.`
        );
      }
      found.push({ id: u.id, email, qaLabel: meta.qa_label as string });
    }
    if (data.users.length < perPage) break;
    page += 1;
  }
  const duplicateLabels = found.map((u) => u.qaLabel).filter((label, i, arr) => arr.indexOf(label) !== i);
  if (duplicateLabels.length > 0) {
    fail(`More than one auth user claims the same qa_label (${duplicateLabels.join(", ")}). Refusing -- ambiguous, investigate manually.`);
  }
  return found;
}

interface QaChurch {
  id: string;
  name: string;
}

async function discoverQaChurches(qaUserIds: string[]): Promise<QaChurch[]> {
  const { data, error } = await admin.from("churches").select("id, name, is_demo, created_by").in("name", EXPECTED_CHURCH_NAMES);
  if (error) throw new Error(`churches lookup failed: ${error.message}`);
  const found: QaChurch[] = [];
  for (const row of data ?? []) {
    const r = row as { id: string; name: string; is_demo: boolean; created_by: string | null };
    if (!r.is_demo) {
      fail(`A church named "${r.name}" exists but is_demo=false -- refusing to treat it as QA data. Investigate manually.`);
    }
    if (!r.created_by || !qaUserIds.includes(r.created_by)) {
      fail(`Church "${r.name}" (id ${r.id}) was not created_by one of the five approved QA identities. Refusing -- ambiguous, investigate manually.`);
    }
    found.push({ id: r.id, name: r.name });
  }
  return found;
}

// ---------------------------------------------------------------------------
// Manifest -- itemized per-table counts, computed the same way for the dry-run report and for the
// pre/post-delete verification in --execute mode. See the FK inventory this was built from: every
// row counted here is reachable from churchIds via `church_id`/`created_by`-chain CASCADE, or from
// profileIds via `profile_id`/`user_id`/`member_id`/`submitted_by`-style CASCADE, confirmed against
// every migration file, 0001-0035.
// ---------------------------------------------------------------------------

interface ManifestRow {
  table: string;
  count: number;
  note?: string;
}

async function countWhereIn(table: string, column: string, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const { count, error } = await admin.from(table).select("id", { count: "exact", head: true }).in(column, ids);
  if (error) throw new Error(`count failed for ${table}.${column}: ${error.message}`);
  return count ?? 0;
}

async function idsWhereIn(table: string, column: string, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const { data, error } = await admin.from(table).select("id").in(column, ids);
  if (error) throw new Error(`id lookup failed for ${table}.${column}: ${error.message}`);
  return (data ?? []).map((r) => (r as { id: string }).id);
}

async function buildManifest(churchIds: string[], profileIds: string[]): Promise<ManifestRow[]> {
  const rows: ManifestRow[] = [];

  // Directly church-scoped (church_id ON DELETE CASCADE).
  for (const table of ["speakers", "ministries", "lessons", "church_memberships", "church_invites", "lesson_requests", "events", "church_experiences", "credit_requests", "church_wallets"]) {
    rows.push({ table, count: await countWhereIn(table, "church_id", churchIds) });
  }

  // Directly profile-scoped (varying column names, all ON DELETE CASCADE to profiles.id).
  rows.push({ table: "lesson_journeys", count: await countWhereIn("lesson_journeys", "user_id", profileIds) });
  rows.push({ table: "member_wallets", count: await countWhereIn("member_wallets", "profile_id", profileIds) });
  rows.push({ table: "testimonies", count: await countWhereIn("testimonies", "submitted_by", profileIds) });
  rows.push({ table: "testimony_likes", count: await countWhereIn("testimony_likes", "profile_id", profileIds) });
  rows.push({ table: "member_progression_summaries", count: await countWhereIn("member_progression_summaries", "profile_id", profileIds) });
  rows.push({ table: "progression_award_log", count: await countWhereIn("progression_award_log", "member_id", profileIds) });
  rows.push({ table: "member_badge_awards", count: await countWhereIn("member_badge_awards", "member_id", profileIds) });
  rows.push({ table: "church_experience_registrations", count: await countWhereIn("church_experience_registrations", "profile_id", profileIds) });

  // Two-hop: children of QA lessons.
  const lessonIds = await idsWhereIn("lessons", "church_id", churchIds);
  for (const table of ["lesson_media", "lesson_hosts", "lesson_ministries", "lesson_questions", "lesson_experiences", "episode_lessons", "church_experience_lessons"]) {
    rows.push({ table, count: lessonIds.length ? await countWhereIn(table, "lesson_id", lessonIds) : 0 });
  }

  // Three-hop: children of QA lesson_questions (the multiple-choice answer rows, migration 0039).
  const questionIds = lessonIds.length ? await idsWhereIn("lesson_questions", "lesson_id", lessonIds) : [];
  rows.push({ table: "lesson_question_choices (via lesson_questions)", count: questionIds.length ? await countWhereIn("lesson_question_choices", "question_id", questionIds) : 0 });

  // Two-hop: children of QA lesson_journeys.
  const journeyIds = await idsWhereIn("lesson_journeys", "user_id", profileIds);
  rows.push({ table: "lesson_journey_items", count: journeyIds.length ? await countWhereIn("lesson_journey_items", "journey_id", journeyIds) : 0 });

  // Two-hop: children of QA church_experiences.
  const experienceIds = await idsWhereIn("church_experiences", "church_id", churchIds);
  rows.push({ table: "church_experience_occurrences (via church_experiences)", count: experienceIds.length ? await countWhereIn("church_experience_occurrences", "experience_id", experienceIds) : 0 });

  // Two-hop: children of QA member/church wallets (the ledger).
  const memberWalletIds = await idsWhereIn("member_wallets", "profile_id", profileIds);
  const churchWalletIds = await idsWhereIn("church_wallets", "church_id", churchIds);
  const memberLedgerCount = memberWalletIds.length ? await countWhereIn("credit_ledger_entries", "member_wallet_id", memberWalletIds) : 0;
  const churchLedgerCount = churchWalletIds.length ? await countWhereIn("credit_ledger_entries", "church_wallet_id", churchWalletIds) : 0;
  rows.push({ table: "credit_ledger_entries", count: memberLedgerCount + churchLedgerCount });

  // Two-hop: children of QA testimonies.
  const testimonyIds = await idsWhereIn("testimonies", "submitted_by", profileIds);
  rows.push({ table: "character_testimonies (via testimonies)", count: testimonyIds.length ? await countWhereIn("character_testimonies", "testimony_id", testimonyIds) : 0 });

  // Informational only -- these rows are NOT deleted, just have actor_id set to null by the
  // schema's own ON DELETE SET NULL (an audit trail is intentionally preserved, not removed).
  const moderationLogCount = await countWhereIn("admin_moderation_log", "actor_id", profileIds);
  rows.push({ table: "admin_moderation_log", count: moderationLogCount, note: "actor_id will be set to NULL, row is preserved (audit trail), not deleted" });

  return rows;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\n[qaCleanup] mode: ${DRY_RUN ? "DRY RUN (read-only)" : "EXECUTE (will delete)"}`);
  console.log(`[qaCleanup] target project ref: ${actualProjectRef}`);
  console.log(`[qaCleanup] environment classification: shared pre-launch development and QA database\n`);

  const qaUsers = await discoverQaUsers();
  console.log(`[qaCleanup] Found ${qaUsers.length}/5 approved QA identities:`);
  for (const u of qaUsers) console.log(`  ${u.qaLabel}: ${u.email}`);
  if (qaUsers.length === 0) {
    console.log("\n[qaCleanup] No QA identities found -- nothing to clean up.");
    return;
  }
  console.log("");

  const profileIds = qaUsers.map((u) => u.id);
  const churches = await discoverQaChurches(profileIds);
  console.log(`[qaCleanup] Found ${churches.length} QA church(es):`);
  for (const c of churches) console.log(`  ${c.name}`);
  console.log("");

  const churchIds = churches.map((c) => c.id);
  const manifest = await buildManifest(churchIds, profileIds);

  console.log("[qaCleanup] Manifest (rows that would be removed):");
  let totalToRemove = 0;
  for (const row of manifest) {
    console.log(`  ${String(row.count).padStart(4)}  ${row.table}${row.note ? `  (${row.note})` : ""}`);
    if (!row.note) totalToRemove += row.count;
  }
  console.log(`\n[qaCleanup] Auth users to remove: ${qaUsers.length}`);
  console.log(`[qaCleanup] Churches to remove: ${churches.length}`);
  console.log(`[qaCleanup] Total dependent rows to remove (excludes preserved audit-log rows): ${totalToRemove}\n`);

  if (DRY_RUN) {
    console.log("[qaCleanup] Dry run complete. Nothing was deleted. Re-run with --execute (after ALLOW_QA_CLEANUP and CONFIRM_QA_CLEANUP are set) to remove.");
    return;
  }

  console.log("[qaCleanup] Deleting churches (cascades to nearly every dependent row above)...");
  if (churchIds.length > 0) {
    const { error } = await admin.from("churches").delete().in("id", churchIds);
    if (error) throw new Error(`church deletion failed: ${error.message}`);
  }

  console.log("[qaCleanup] Deleting the five QA auth users (cascades to profiles and everything hanging off them)...");
  for (const u of qaUsers) {
    const { error } = await admin.auth.admin.deleteUser(u.id);
    if (error) throw new Error(`deleteUser failed for ${u.qaLabel}: ${error.message}`);
  }

  console.log("\n[qaCleanup] Verifying removal...");
  const postManifest = await buildManifest(churchIds, profileIds);
  const remaining = postManifest.filter((r) => !r.note && r.count > 0);
  const remainingUsers = await discoverQaUsers();
  const remainingChurches = await discoverQaChurches([]);

  if (remaining.length === 0 && remainingUsers.length === 0 && remainingChurches.length === 0) {
    console.log("[qaCleanup] Verified: all five QA auth users, both QA churches, and every dependent row are gone.");
  } else {
    console.error("[qaCleanup] VERIFICATION FAILED -- some QA data remains:");
    if (remainingUsers.length > 0) console.error(`  auth users still present: ${remainingUsers.length}`);
    if (remainingChurches.length > 0) console.error(`  churches still present: ${remainingChurches.length}`);
    for (const r of remaining) console.error(`  ${r.table}: ${r.count} row(s) remain`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`\n[qaCleanup] ERROR: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});

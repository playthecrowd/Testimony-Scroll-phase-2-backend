import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

// Static source-scan regression guard (same limitation/approach as every other RLS/authorization
// test in this repo -- no live DB in this environment, see tests/rlsChurchIsolation.test.ts's own
// header comment) for the regular-lesson bulk import action. Two structural guarantees the task
// spec explicitly required: a host can only ever import into a church they actually manage (never
// a client-supplied church_id trusted blindly), and a bulk-imported lesson can never become a
// campaign lesson.
const REPO_ROOT = path.join(__dirname, "..");

function read(relPath: string): string {
  return readFileSync(path.join(REPO_ROOT, ...relPath.split("/")), "utf8");
}

test("importRegularLessonsCsvAction re-verifies the caller's own church_memberships role before importing anything, the same check submitLessonDraft uses for manual creation", () => {
  const source = read("app/experience-builder/import/importActions.ts");
  assert.match(source, /from\("church_memberships"\)/, "must query church_memberships directly, not trust a client-supplied role");
  assert.match(source, /\.eq\("profile_id", user\.id\)/, "must scope the membership check to the authenticated caller");
  assert.match(source, /\.eq\("church_id", churchId\)/, "must scope the membership check to the specific church being imported into");
  assert.match(source, /hasChurchEditAccess\(membership\?\.role\)/, "must require host/admin role, not just any membership");
});

test("RegularLessonInput (lib/regularLessonCsv.ts) has no church_id field -- a CSV can never target another church no matter what it contains", () => {
  const source = read("lib/regularLessonCsv.ts");
  const interfaceMatch = source.match(/export interface RegularLessonInput \{[\s\S]*?\n\}/);
  assert.ok(interfaceMatch, "expected a RegularLessonInput interface");
  assert.doesNotMatch(interfaceMatch![0], /church/i, "RegularLessonInput must never carry a church_id/churchId field -- churchId comes only from the authenticated caller's own membership, verified server-side");
});

test("createRegularLessonsBatch (services/supabase/lessons.ts) takes churchId as an explicit argument, never reads it from the per-row input", () => {
  const source = read("services/supabase/lessons.ts");
  const fnMatch = source.match(/export async function createRegularLessonsBatch\([\s\S]*?\n\}/);
  assert.ok(fnMatch, "expected createRegularLessonsBatch to be defined");
  assert.match(fnMatch![0], /churchId: string/, "churchId must be a top-level function argument");
  assert.match(fnMatch![0], /p_church_id: churchId/, "must pass the function argument's churchId to the RPC, not something derived from each row's own input");
});

test("createRegularLessonsBatch never sets is_campaign_lesson -- every bulk-imported lesson is structurally a regular church lesson", () => {
  const source = read("services/supabase/lessons.ts");
  const fnMatch = source.match(/export async function createRegularLessonsBatch\([\s\S]*?\n\}/);
  assert.ok(fnMatch);
  assert.doesNotMatch(fnMatch![0], /is_campaign_lesson|campaign_name|p_campaign/i, "must never reference any campaign-lesson field -- it should rely on submit_lesson_draft's own insert defaulting is_campaign_lesson to false");
});

test("the regular lesson bulk-upload page lives under /experience-builder, not inside the campaign-lessons admin area", () => {
  // Confirms the file exists at the required location -- read() itself throws if it doesn't.
  const source = read("app/experience-builder/import/page.tsx");
  assert.match(source, /getMyHostChurches/, "must scope church selection to the signed-in Host's own churches");
});

test("the regular lesson bulk-upload page uses the same host/organization-membership server guard as the main Experience Builder page", () => {
  // Phase 10D1: both pages' churchless-fallback redirect became entity-aware (organization
  // accounts land on /onboarding/organization, church/host accounts still land on
  // /onboarding/church) -- the destination is no longer a single bare redirect() call, so this
  // checks both branches of that ternary are present rather than one literal call.
  const importPage = read("app/experience-builder/import/page.tsx");
  const builderPage = read("app/experience-builder/page.tsx");
  for (const source of [importPage, builderPage]) {
    assert.match(source, /redirect\("\/login"\)/);
    assert.match(source, /redirect\("\/dashboard"\)/);
    assert.match(source, /"\/onboarding\/church"/, "a churchless Host must still land on /onboarding/church");
    assert.match(source, /"\/onboarding\/organization"/, "an orgless Organization account must land on /onboarding/organization");
  }
});

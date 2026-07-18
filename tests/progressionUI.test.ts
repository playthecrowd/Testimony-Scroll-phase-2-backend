import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

// Phase 11.4: structural regression guards for the real progression UI (dashboard/badges/
// leaderboard) and the mock-removal requirement. Same limitation as every prior phase's tests --
// no React rendering harness exists in this repo (no Jest/Vitest/RTL, per its own testing
// convention), so these read the actual page/component source directly rather than rendering it.

const REPO_ROOT = path.join(__dirname, "..");

function read(relPath: string): string {
  return readFileSync(path.join(REPO_ROOT, relPath), "utf8");
}

const REAL_PROGRESSION_PAGES = ["app/dashboard/page.tsx", "app/badges/page.tsx", "app/leaderboard/page.tsx"];

// ---------------------------------------------------------------------------
// Mock removal
// ---------------------------------------------------------------------------

test("the real dashboard/badges/leaderboard pages never import the mock SessionContext, the mock badge/quest/journey services, or their localStorage-backed data fixtures", () => {
  const forbidden = [
    "@/context/SessionContext",
    "@/services/badgeService",
    "@/services/questService",
    "@/services/journeyService",
    "@/data/badges",
    "@/data/quests",
    "@/data/users",
    "@/lib/storage",
  ];
  for (const page of REAL_PROGRESSION_PAGES) {
    const content = read(page);
    for (const mod of forbidden) {
      assert.doesNotMatch(content, new RegExp(mod.replace("/", "\\/")), `${page} must not import ${mod}`);
    }
  }
});

test("the real dashboard/badges/leaderboard pages are server components -- no \"use client\" directive, no direct browser Supabase client", () => {
  for (const page of REAL_PROGRESSION_PAGES) {
    const content = read(page);
    assert.doesNotMatch(content.trimStart(), /^"use client"/, `${page} must be a server component`);
    assert.doesNotMatch(content, /@\/lib\/supabase\/client/, `${page} must not import the browser Supabase client`);
    assert.match(content, /@\/lib\/supabase\/server/, `${page} must use the real server-side Supabase client`);
  }
});

test("the homepage no longer imports the mock badge service -- its badge preview is a small static, accurate list instead", () => {
  const content = read("app/page.tsx");
  assert.doesNotMatch(content, /@\/services\/badgeService/);
  assert.match(content, /HOMEPAGE_BADGE_PREVIEW/);
});

// ---------------------------------------------------------------------------
// No hard-coded level thresholds in UI code
// ---------------------------------------------------------------------------

test("XpProgressBar never hard-codes a level threshold table -- thresholds always arrive as a prop from the service layer", () => {
  const content = read("components/progression/XpProgressBar.tsx");
  assert.match(content, /thresholds:\s*ProgressionLevelThreshold\[\]/, "Must accept thresholds as a typed prop");
  assert.doesNotMatch(content, /minXp:\s*\d+/, "Must not contain a literal threshold value");
  assert.doesNotMatch(content, /const\s+thresholds\s*=\s*\[/, "Must never declare its own local threshold array");
});

test("the dashboard page fetches level thresholds from the real service layer, never a local literal array", () => {
  const content = read("app/dashboard/page.tsx");
  assert.match(content, /getAllLevelThresholds/);
});

// ---------------------------------------------------------------------------
// Security: authenticated identity only, never a client-supplied id
// ---------------------------------------------------------------------------

test("the real dashboard/badges/leaderboard pages derive the signed-in member from supabase.auth.getUser(), never from a route param or client-supplied id", () => {
  for (const page of REAL_PROGRESSION_PAGES) {
    const content = read(page);
    assert.match(content, /supabase\.auth\.getUser\(\)/, `${page} must authenticate the caller server-side`);
    assert.doesNotMatch(content, /searchParams/, `${page} must not derive identity/scope from a query string`);
  }
});

test("the leaderboard page never passes a client-supplied church id -- church scoping is entirely derived from the signed-in member's own church memberships", () => {
  const content = read("app/leaderboard/page.tsx");
  assert.doesNotMatch(content, /churchId/i, "The leaderboard page must never accept or forward a churchId parameter");
  assert.match(content, /getMyChurches/, "Must derive church membership from the real, RLS-gated getMyChurches call");
});

test("leaderboard entries never carry email or wallet/credit fields -- only the fields the Phase 11.3 views actually expose", () => {
  const content = read("components/progression/LeaderboardTabs.tsx");
  assert.doesNotMatch(content, /email/i);
  assert.doesNotMatch(content, /credit/i);
  assert.doesNotMatch(content, /balance/i);
});

test("Points, not XP, is the number rendered as the leaderboard ranking column", () => {
  const content = read("components/progression/LeaderboardTabs.tsx");
  assert.match(content, /pointsTotal\.toLocaleString\(\)/);
});

// ---------------------------------------------------------------------------
// Completion feedback: real, non-predictive, no client-side reward calculation
// ---------------------------------------------------------------------------

test("StudiedClient's completion feedback reads the exact award from the real service layer, never computes a points/XP amount itself", () => {
  const content = read("app/journey/[lessonId]/studied/StudiedClient.tsx");
  assert.match(content, /getMyProgressionAwardForSourceRow/);
  assert.match(content, /getMyBadgeAwards/);
  // The feedback state is only ever set from the awaited service call's own returned fields --
  // never a locally-declared points/xp constant assigned before that call resolves.
  assert.doesNotMatch(content, /const\s+points\s*=\s*\d+/i);
  assert.doesNotMatch(content, /const\s+xp\s*=\s*\d+/i);
});

test("StudiedClient never shows award feedback before the completion call has actually succeeded", () => {
  const content = read("app/journey/[lessonId]/studied/StudiedClient.tsx");
  const fnMatch = content.match(/async function handleMarkComplete\(\)[\s\S]*?\n {2}\}/);
  assert.ok(fnMatch, "Expected handleMarkComplete to be defined");
  const body = fnMatch![0];
  const markIdx = body.indexOf("await markStudiedComplete(");
  const feedbackIdx = body.indexOf("getMyProgressionAwardForSourceRow(");
  assert.ok(markIdx !== -1 && feedbackIdx !== -1 && markIdx < feedbackIdx, "markStudiedComplete must resolve before any award feedback is fetched");
});

// ---------------------------------------------------------------------------
// Badges: earned/locked/trophy distinction, deterministic ordering (component-level check)
// ---------------------------------------------------------------------------

test("BadgesGrid visually distinguishes earned, locked, and trophy-category badges, and never shows raw internal ids", () => {
  const content = read("components/progression/BadgesGrid.tsx");
  assert.match(content, /earned \? isTrophy \? <Trophy/, "Must render a distinct trophy icon for earned trophy-category badges");
  assert.match(content, /<Lock/, "Must render a lock icon for a not-yet-earned badge");
  assert.match(content, /Not yet earned/);
  assert.doesNotMatch(content, /badge\.id\}<\/span>|\{award\.id\}/, "Must never render a raw database id as visible text");
});

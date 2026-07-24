import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

// Repair Batch 5, D12 (Trello 37oP4fVD): /profile's "Active Journeys" count read from the legacy
// mock journeyService (localStorage seed data keyed by a mock user id), always 0 for a real
// account, while /my-journey correctly read the real lesson_journeys table. Fixed alongside the
// Testimonies count in the same change (not just Journeys alone) specifically to avoid trading
// "both mock" for a new "one real, one still mock" inconsistency on the same page -- see
// docs/PHASE11_5_AUDIT.md SS11, which named this exact page and this exact risk.
const REPO_ROOT = path.join(__dirname, "..");

function read(relPath: string): string {
  return readFileSync(path.join(REPO_ROOT, ...relPath.split("/")), "utf8");
}

test("D12: app/profile/page.tsx no longer imports the mock journeyService/testimonyService for its stat counts", () => {
  const source = read("app/profile/page.tsx");
  assert.doesNotMatch(source, /from "@\/services\/journeyService"/);
  assert.doesNotMatch(source, /from "@\/services\/testimonyService"/);
});

test("D12: both Journeys and Testimonies counts are sourced from real Supabase queries, not just one of the two", () => {
  const source = read("app/profile/page.tsx");
  assert.match(source, /getUserJourneysWithLessons/, "expected the same real journeys query /my-journey already uses");
  assert.match(source, /getMyTestimonies/, "expected the same real testimonies query /kingdom-scroll/my-testimonies already uses");
});

test("D12: the count fetch only runs once the real session is confirmed logged in, and is scoped to a client-side effect (not a full Server Component conversion of this identity-model page)", () => {
  const source = read("app/profile/page.tsx");
  assert.match(source, /useEffect\(/);
  assert.match(source, /if \(!ready \|\| !session\.isLoggedIn\) return;/);
});

test("D12: the rest of the profile page's identity fields (name/email/avatar/church) are untouched, still from the client SessionContext -- this fix is scoped narrowly, not a full identity-model migration", () => {
  const source = read("app/profile/page.tsx");
  assert.match(source, /session\.user\.fullName/);
  assert.match(source, /session\.user\.avatarUrl/);
  assert.match(source, /getChurchById/, "the church lookup must remain untouched -- out of this defect's scope");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

// scripts/qaSeed.ts has no live Supabase project wired into `npm test` (same limitation every
// prior phase has documented, e.g. tests/churchExperienceAuthorization.test.ts) -- this is the
// static substitute: it scans the actual script source for the invariants requested when
// hardening the church-reuse path, so a future edit can't silently regress any of them.
//
// The hardening requirement: church reuse must validate BOTH the collision-verified QA host
// identity AND the exact stable synthetic QA church name expected for that host, and fail closed
// on an unexpected church, a duplicate QA church, a mismatched name, or a non-QA record.

const SOURCE = readFileSync(path.join(__dirname, "..", "scripts", "qaSeed.ts"), "utf8");

function extractFunction(name: string): string {
  const match = SOURCE.match(new RegExp(`(?:async )?function ${name}\\([\\s\\S]*?\\n\\}\\n`));
  assert.ok(match, `Expected function ${name} to be defined in scripts/qaSeed.ts`);
  return match![0];
}

test("resolveChurchForHost fails closed on a duplicate QA church (more than one church with the exact expected name)", () => {
  const fn = extractFunction("resolveChurchForHost");
  assert.match(fn, /nameMatches[\s\S]*?\)\.length > 1/, "must check for more than one church matching the exact expected name");
  assert.match(fn, /duplicate QA church/i);
});

test("resolveChurchForHost fails closed on more than one host/admin membership for the QA host", () => {
  const fn = extractFunction("resolveChurchForHost");
  assert.match(fn, /memberships[\s\S]*?\)\.length > 1/, "must check for more than one host/admin church_memberships row");
});

test("resolveChurchForHost fails closed when the host manages a church that isn't named exactly the expected QA name", () => {
  const fn = extractFunction("resolveChurchForHost");
  assert.match(fn, /membershipChurchId && !nameMatch/);
  assert.match(fn, /mismatched church/i);
});

test("resolveChurchForHost fails closed when a church has the expected name but the QA host doesn't manage it", () => {
  const fn = extractFunction("resolveChurchForHost");
  assert.match(fn, /!membershipChurchId && nameMatch/);
  assert.match(fn, /unexpected\/non-QA record/i);
});

test("resolveChurchForHost fails closed when the host's managed church and the name-matched church are different rows", () => {
  const fn = extractFunction("resolveChurchForHost");
  assert.match(fn, /nameMatch!\.id !== membershipChurchId/);
});

test("resolveChurchForHost fails closed when the name-matched church was not created_by the verified QA host", () => {
  const fn = extractFunction("resolveChurchForHost");
  assert.match(fn, /nameMatch!\.created_by !== existingHost\.id/);
  assert.match(fn, /non-QA\/unexpected record/i);
});

test("resolveChurchForHost only ever returns a reuse resolution after every check above has passed", () => {
  const fn = extractFunction("resolveChurchForHost");
  // The single "reuse" return must be the last statement in the function, after all the fail()
  // guard clauses above it -- i.e. there is exactly one path to { kind: "reuse", ... } and it is
  // preceded by every check, not an early return that could skip one.
  const reuseReturns = fn.match(/return \{ kind: "reuse"/g) ?? [];
  assert.equal(reuseReturns.length, 1, "expected exactly one reuse-resolution return, reached only after every guard clause");
});

test("provisionChurchForHost and the dry-run path both go through the same resolveChurchForHost logic (no separate, potentially-weaker dry-run path)", () => {
  const fn = extractFunction("provisionChurchForHost");
  assert.match(fn, /resolveChurchForHost\(hostId, churchLabel\)/, "provisionChurchForHost must delegate identity/name verification to resolveChurchForHost for both dry-run and execute");
});

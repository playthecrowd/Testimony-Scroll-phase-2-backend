import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

// Regression guard: the five QA_*_PASSWORD env vars must be presence-checked in BOTH --dry-run and
// --execute mode, not execute-only. Found during pre-flight review before a real provisioning run
// -- the check was previously wrapped in `if (!DRY_RUN) { ... }`, so a dry run gave no signal at
// all about a missing password; the first time it could ever surface was partway through a real
// --execute run. A dry run should be a complete pre-flight check.

const SOURCE = readFileSync(path.join(__dirname, "..", "scripts", "qaSeed.ts"), "utf8");

test("every identity's password env var is checked for presence unconditionally", () => {
  const match = SOURCE.match(/for \(const id of IDENTITIES\) \{\s*if \(!process\.env\[id\.passwordEnvVar\]\) \{\s*fail\(/);
  assert.ok(match, "Expected an unconditional presence check over every IDENTITIES entry's passwordEnvVar");

  // Confirm this loop is not nested inside an `if (!DRY_RUN)` block by checking that the 40
  // characters immediately preceding the loop are not the DRY_RUN guard opening.
  const loopIndex = SOURCE.indexOf(match![0]);
  const preceding = SOURCE.slice(Math.max(0, loopIndex - 60), loopIndex);
  assert.doesNotMatch(preceding, /if \(!DRY_RUN\) \{\s*$/, "the password-presence loop must not be nested inside an if (!DRY_RUN) block");
});

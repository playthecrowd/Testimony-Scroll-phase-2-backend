import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

// Regression guard for a real bug found while reviewing scripts/qaSeed.ts before a real
// provisioning run: listAllUsersCached() is populated once (by the required-table/non-QA-domain
// audit near the top of main()) with the Auth user list as it existed BEFORE any QA identity is
// created in that run. Every later findExistingUserByEmail() call -- including
// resolveChurchForHost()'s host lookup -- reads that same in-memory cache. Without invalidating it
// right after a brand-new user is created, a fresh --execute run would create all five Auth users
// successfully, then incorrectly report every host as "missing" when resolving churches (because
// the cache still reflects the pre-creation snapshot), silently skipping church creation and
// everything gated on it (member joins, wallets) -- with no error, just quietly incomplete
// provisioning. This never manifests in --dry-run (nothing is created, so the stale cache happens
// to still match reality), which is exactly why it wasn't caught by dry-run output alone.

const SOURCE = readFileSync(path.join(__dirname, "..", "scripts", "qaSeed.ts"), "utf8");

test("provisionIdentity invalidates the cached Auth user list immediately after creating a new user", () => {
  const fnMatch = SOURCE.match(/async function provisionIdentity[\s\S]*?\n}\n/);
  assert.ok(fnMatch, "Expected provisionIdentity to be defined");
  const fn = fnMatch![0];

  const createUserIndex = fn.indexOf("admin.auth.admin.createUser(");
  assert.ok(createUserIndex !== -1, "Expected provisionIdentity to call admin.auth.admin.createUser");

  const invalidateIndex = fn.indexOf("cachedAllUsers = null", createUserIndex);
  assert.ok(
    invalidateIndex !== -1,
    "Expected cachedAllUsers to be invalidated (set to null) after admin.auth.admin.createUser() succeeds, " +
      "so a later findExistingUserByEmail() call in the same run (e.g. resolveChurchForHost()'s host lookup) " +
      "sees the newly-created user instead of a stale pre-creation snapshot."
  );
});

test("listAllUsersCached is the single source every lookup uses, so one invalidation point is sufficient", () => {
  // If a second, independent user-listing mechanism were ever added, this invalidation fix
  // wouldn't cover it -- guard that findExistingUserByEmail and auditNonQaIdentities both still
  // route through the one cached function.
  const findFnMatch = SOURCE.match(/async function findExistingUserByEmail[\s\S]*?\n}\n/);
  const auditFnMatch = SOURCE.match(/async function auditNonQaIdentities[\s\S]*?\n}\n/);
  assert.ok(findFnMatch, "Expected findExistingUserByEmail to be defined");
  assert.ok(auditFnMatch, "Expected auditNonQaIdentities to be defined");
  assert.match(findFnMatch![0], /listAllUsersCached\(\)/);
  assert.match(auditFnMatch![0], /listAllUsersCached\(\)/);
});

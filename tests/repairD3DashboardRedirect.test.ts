import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

// Repair Phase Batch 1, D3 (Medium): signed-out visitors to /dashboard saw a generic "couldn't
// load" error instead of a redirect to /login, because Next.js's internal redirect() throw was
// landing inside a catch block that treated it as a generic data-load failure.
// Trello: https://trello.com/c/mABxsQsQ/43
const REPO_ROOT = path.join(__dirname, "..");

function read(relPath: string): string {
  return readFileSync(path.join(REPO_ROOT, ...relPath.split("/")), "utf8");
}

test('D3: redirect("/login...") in app/dashboard/page.tsx is not inside the catch-guarded data-loading try block', () => {
  const source = read("app/dashboard/page.tsx");
  assert.match(source, /redirect\("\/login\?next=%2Fdashboard"\)/, "expected the login redirect call to still exist");

  const redirectIndex = source.indexOf('redirect("/login?next=%2Fdashboard")');
  const dataLoadingTryIndex = source.indexOf("const [summary, thresholdRows");
  assert.notEqual(dataLoadingTryIndex, -1, "expected to find the Promise.all data-loading block");
  assert.ok(
    redirectIndex < dataLoadingTryIndex,
    "redirect() must occur before the data-loading try block starts, not inside it -- otherwise " +
      "Next.js's internal redirect throw gets caught by that block's catch and misreported as a " +
      "generic load failure instead of actually redirecting"
  );

  // The createClient() step must be its own try/catch, fully resolved (including its
  // configError/loadFailed early-return branches) before the redirect call -- confirms redirect()
  // isn't nested inside that try either.
  const createClientTryIndex = source.indexOf("try {");
  assert.notEqual(createClientTryIndex, -1, "expected a dedicated try/catch around createClient()");
  const createClientCallIndex = source.indexOf("supabase = await createClient();", createClientTryIndex);
  assert.notEqual(createClientCallIndex, -1, "expected createClient() to be called inside that try block");
  assert.ok(createClientCallIndex - createClientTryIndex < 30, "createClient() call should immediately follow its try block");

  const configErrorBranchIndex = source.indexOf("if (configError) {");
  assert.notEqual(configErrorBranchIndex, -1, "expected a configError early-return branch");
  assert.ok(
    createClientCallIndex < configErrorBranchIndex && configErrorBranchIndex < redirectIndex,
    "the createClient try/catch and its configError/loadFailed early-return branches must fully " +
      "resolve before the redirect() call, not wrap it"
  );
});

test("D3: genuine dashboard data-load failures (Promise.all) still set loadFailed and render the graceful error state", () => {
  const source = read("app/dashboard/page.tsx");
  assert.match(
    source,
    /We couldn't load your dashboard right now\. Please try again shortly\./,
    "the graceful load-failure message must still be present and reachable"
  );
  assert.match(source, /if \(loadFailed\) \{/, "a loadFailed branch must still guard rendering the error state");
  assert.match(source, /if \(configError\) \{/, "a configError branch must still guard rendering the config-error state");
});

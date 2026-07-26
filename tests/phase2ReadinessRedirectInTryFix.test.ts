import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

// Phase Two readiness checkpoint (pre-homepage-rebuild blocker): five pages had the same
// redirect-inside-try bug already fixed once for D3 (app/dashboard/page.tsx) -- Next.js's internal
// redirect() throw was landing inside a catch block that treated it as a generic data-load
// failure instead of actually redirecting a signed-out visitor to /login. This was never caught
// during original QA or the repair phase because every QA identity was signed in; nobody tested
// these routes as a fully signed-out visitor. Mirrors tests/repairD3DashboardRedirect.test.ts.
const REPO_ROOT = path.join(__dirname, "..");

function read(relPath: string): string {
  return readFileSync(path.join(REPO_ROOT, ...relPath.split("/")), "utf8");
}

function assertRedirectBeforeDataLoad(
  filePath: string,
  redirectPattern: RegExp,
  dataLoadMarker: string,
  loadFailedMessage: RegExp,
  configErrorPattern: RegExp = /if \(configError\) \{/
) {
  const source = read(filePath);

  assert.match(source, redirectPattern, `expected the login redirect call to still exist in ${filePath}`);
  const redirectIndex = source.search(redirectPattern);

  const dataLoadingIndex = source.indexOf(dataLoadMarker);
  assert.notEqual(dataLoadingIndex, -1, `expected to find the data-loading marker in ${filePath}`);
  assert.ok(
    redirectIndex < dataLoadingIndex,
    `${filePath}: redirect() must occur before the data-loading try block starts, not inside it -- ` +
      "otherwise Next.js's internal redirect throw gets caught by that block's catch and " +
      "misreported as a generic load failure instead of actually redirecting"
  );

  assert.match(source, loadFailedMessage, `${filePath}: the graceful load-failure message must still be present and reachable`);
  assert.match(source, configErrorPattern, `${filePath}: a config-error branch must still guard rendering the config-error state`);
}

test("leaderboard: redirect(/login) is not inside the catch-guarded data-loading try block", () => {
  assertRedirectBeforeDataLoad(
    "app/leaderboard/page.tsx",
    /redirect\("\/login\?next=%2Fleaderboard"\)/,
    "const [global, myChurches, gRank] = await Promise.all(",
    /We couldn't load the leaderboard right now\. Please try again shortly\./
  );
});

test("badges: redirect(/login) is not inside the catch-guarded data-loading try block", () => {
  assertRedirectBeforeDataLoad(
    "app/badges/page.tsx",
    /redirect\("\/login\?next=%2Fbadges"\)/,
    "const [allBadges, myAwards] = await Promise.all(",
    /We couldn't load your badges right now\. Please try again shortly\./
  );
});

test("experiences (list): redirect(/login) is not inside the catch-guarded data-loading try block", () => {
  assertRedirectBeforeDataLoad(
    "app/experiences/page.tsx",
    /redirect\("\/login\?next=%2Fexperiences"\)/,
    "const churches = await getMyChurches(supabase);",
    /We couldn't load Experiences right now\. Please try again shortly\./
  );
});

test("experiences/[experienceId] (detail): redirect(/login) is not inside the catch-guarded data-loading try block", () => {
  assertRedirectBeforeDataLoad(
    "app/experiences/[experienceId]/page.tsx",
    /redirect\(`\/login\?next=%2Fexperiences%2F\$\{experienceId\}`\)/,
    "experience = await getExperienceById(supabase, experienceId);",
    /We couldn't load this Experience right now\. Please try again shortly\./
  );
});

test("my-experiences: redirect(/login) is not inside the catch-guarded data-loading try block", () => {
  // my-experiences returns SupabaseConfigError JSX inline from its catch blocks rather than using
  // a `configError` variable + `if (configError)` branch (unlike the other 4 files) -- that
  // structure predates this fix and was preserved as-is, so it's checked with its own pattern.
  assertRedirectBeforeDataLoad(
    "app/my-experiences/page.tsx",
    /redirect\("\/login\?next=%2Fmy-experiences"\)/,
    "items = await getMyRegistrationsWithDetails(supabase);",
    /We couldn't load your Experiences right now\. Please try again shortly\./,
    /err instanceof SupabaseConfigError/
  );
});

test("safe pages already re-throw non-config errors, so their existing redirect() calls were never at risk", () => {
  for (const filePath of ["app/experience-builder/page.tsx", "app/host-dashboard/experiences/new/page.tsx"]) {
    const source = read(filePath);
    assert.match(source, /throw err;/, `${filePath}: expected the catch-all branch to re-throw non-SupabaseConfigError errors (including redirect's internal throw)`);
  }
});

test("host-dashboard keeps its in-page sign-in prompt for signed-out visitors instead of a redirect (established valid pattern, left unchanged)", () => {
  // app/host-dashboard/page.tsx legitimately calls redirect("/onboarding/church") for a signed-in
  // host who manages zero churches -- an unrelated, valid redirect. What matters here is that the
  // signed-out case still renders the in-page prompt rather than gaining a /login redirect.
  const source = read("app/host-dashboard/page.tsx");
  assert.doesNotMatch(source, /redirect\("\/login/, "app/host-dashboard/page.tsx should not have gained a /login redirect -- its in-page sign-in prompt is the established pattern for signed-out visitors");
  assert.match(source, /Sign in as a Church Host/i, "expected the existing in-page sign-in prompt to remain");
});

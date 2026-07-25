import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

// Repair Phase Batch 1, D2 (Medium): /login and /signup do not redirect away when already signed
// in. Diagnosis (docs/REPAIR_D2_DIAGNOSIS.md) found both routes were statically prerendered and
// served live with a one-year CDN s-maxage, while dynamic routes (e.g. /dashboard,
// /experience-builder) were correctly uncached and their proxy.ts redirects demonstrably worked.
// Forcing these two routes to render dynamically means every request reaches the server runtime
// where proxy.ts's AUTH_PATHS check runs, instead of being servable from a cached static response.
// Trello: https://trello.com/c/mCY4Thmo/42
//
// Scoped narrowly: only these two files get `dynamic = "force-dynamic"` -- this does not touch
// next.config.ts, any global cache-control header, or any other route's caching behavior.
const REPO_ROOT = path.join(__dirname, "..");

function read(relPath: string): string {
  return readFileSync(path.join(REPO_ROOT, ...relPath.split("/")), "utf8");
}

for (const relPath of ["app/login/page.tsx", "app/signup/page.tsx"]) {
  test(`D2: ${relPath} is forced dynamic so it always hits the server runtime where proxy.ts's AUTH_PATHS check runs`, () => {
    const source = read(relPath);
    assert.match(
      source,
      /export const dynamic = "force-dynamic";/,
      `${relPath} must export dynamic = "force-dynamic" so it can never be served as a cached ` +
        `static response that bypasses proxy.ts's signed-in redirect check`
    );
  });
}

test("D2: no other route or global config was changed to force this behavior (scoped to /login and /signup only)", () => {
  const nextConfig = read("next.config.ts");
  assert.doesNotMatch(nextConfig, /force-dynamic/, "next.config.ts must not set any global dynamic/caching override for this fix");
  assert.doesNotMatch(nextConfig, /headers\s*:/, "next.config.ts must not add global cache-control headers for this fix");
});

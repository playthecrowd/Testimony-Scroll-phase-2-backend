// Manual/ad-hoc Playwright behavioral checks for Repair Phase Batch 1 (D1, D3, D10).
//
// NOT part of `npm test` and NOT a permanent project dependency -- Playwright is installed ad hoc
// in this environment (same pattern used during the QA phase: `npm install --no-save`), per
// CLAUDE.md's instruction to report before adding a permanent test framework. Run manually with:
//   node_modules/.bin/playwright test tests/manual/repairBatch1.spec.ts --config=tests/manual/playwright.config.ts
//
// Scope note (why some scenarios are covered here and others aren't):
// This repo has no .env.local in this environment, so NEXT_PUBLIC_SUPABASE_URL/PUBLISHABLE_KEY
// are unset locally. That makes `createClient()` throw a real, unmocked SupabaseConfigError the
// instant any Supabase call is attempted -- which is exactly D1's target failure mode, so D1 is
// tested here with a REAL thrown exception, no network mocking needed.
//
// D3 (signed-out /dashboard redirect) and D10 (Sign Out session invalidation) both require a real
// authenticated session against a real Supabase project to drive behaviorally end-to-end -- that
// isn't available in this local environment (no seeded credentials, no .env.local). Both remain
// verified structurally via tests/repairBatch1Auth.test.ts, and both are called out explicitly in
// the final checkpoint as needing a live retest on production.quest4thekingdom.com (which the
// repair plan already requires before closing any Trello card, independent of this file).
import { test, expect } from "@playwright/test";

test("D1 (signin): a thrown exception during sign-in shows a visible error and does not leave the button stuck on 'Please wait...'", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("you@example.com").fill("qa-repair-batch1@example.com");
  await page.getByPlaceholder("Enter your password").fill("password123");

  const submitButton = page.locator("form").getByRole("button", { name: /Sign In|Please wait/ });
  await submitButton.click();

  // Without Supabase configured, createClient() throws synchronously inside signIn() --
  // pre-fix, this exception was unhandled: submitting stayed true forever and no error appeared.
  await expect(page.getByText(/Something went wrong signing you in/i)).toBeVisible({ timeout: 5000 });
  await expect(submitButton).toBeEnabled();
  await expect(submitButton).toHaveText(/Sign In/);
});

test("D1 (signup): a thrown exception during sign-up shows a visible error and does not leave the button stuck on 'Please wait...'", async ({ page }) => {
  await page.goto("/signup");
  await page.getByPlaceholder("Enter your full name").fill("QA Repair Batch1");
  await page.getByPlaceholder("you@example.com").fill("qa-repair-batch1@example.com");
  await page.getByPlaceholder("Create a strong password").fill("password123");
  await page.getByText(/I agree to the/).locator("input[type=checkbox]").check();

  const submitButton = page.getByRole("button", { name: /Create My Account|Please wait/ });
  await submitButton.click();

  await expect(page.getByText(/Something went wrong creating your account/i)).toBeVisible({ timeout: 5000 });
  await expect(submitButton).toBeEnabled();
});

test("D3: unconfigured Supabase on /dashboard renders the graceful config-error state, not an uncaught crash", async ({ page }) => {
  // Without env vars, this exercises the createClient()-failure branch (configError), which is a
  // different branch from the redirect-swallowing bug itself (that needs a *working* client with
  // no signed-in user, which requires real Supabase credentials -- see file header). This test
  // still confirms the page never crashes and always resolves to one of its two graceful states.
  const response = await page.goto("/dashboard");
  expect(response?.status()).toBeLessThan(500);
  const bodyText = await page.locator("body").innerText();
  expect(bodyText).toMatch(/Supabase|We couldn't load your dashboard|sign in/i);
});

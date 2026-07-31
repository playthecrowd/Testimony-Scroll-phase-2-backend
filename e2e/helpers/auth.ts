import { expect, type Page } from "@playwright/test";

const AUTH_TIMEOUT = 15_000;

export async function assertHomepage(page: Page) {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Every lesson becomes a journey/i }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign In" })).toBeVisible();
}

export async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();

  // Prefer data-testid (local / post-deploy). Fall back to type selectors — production
  // AuthScreen labels are not wired with htmlFor, so getByLabel does not work there.
  const emailInput = page
    .getByTestId("auth-email")
    .or(page.locator('form input[type="email"]'));
  const passwordInput = page
    .getByTestId("auth-password")
    .or(page.locator('form input[type="password"]'));
  const submit = page
    .getByTestId("auth-submit")
    .or(page.locator("form").getByRole("button", { name: "Sign In" }));

  await emailInput.fill(email);
  await passwordInput.fill(password);
  await submit.click();
}

export async function openAccountMenu(page: Page) {
  const header = page.locator("header");
  const menuToggle = page
    .getByTestId("account-menu")
    .or(
      header
        .getByRole("button")
        .filter({ has: page.locator("img.rounded-full") }),
    );
  await expect(menuToggle).toBeVisible({ timeout: AUTH_TIMEOUT });
  await menuToggle.click();
}

export async function signOut(page: Page) {
  await openAccountMenu(page);
  const signOutButton = page
    .getByTestId("sign-out")
    .or(page.getByRole("button", { name: "Sign Out" }));
  await signOutButton.click();
  await expect(page).toHaveURL((url) => url.pathname === "/", {
    timeout: AUTH_TIMEOUT,
  });
  await assertHomepage(page);
}

/** Wait for network + fonts to settle before visual snapshots. */
export async function settleForScreenshot(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  // Give client-rendered dashboards a beat to paint after auth redirect.
  await page.waitForTimeout(500);
}

export { AUTH_TIMEOUT };

import { test, expect } from "@playwright/test";
import {
  assertHomepage,
  login,
  signOut,
  settleForScreenshot,
  AUTH_TIMEOUT,
} from "./helpers/auth";

test.describe("Smoke tests", () => {
  test("host user can sign in, view host dashboard, and sign out", async ({
    page,
  }) => {
    const email = process.env.HOST_MEMBER_EMAIL!;
    const password = process.env.HOST_MEMBER_PASSWORD!;

    await assertHomepage(page);
    await settleForScreenshot(page);
    await expect(page).toHaveScreenshot("home-signed-out.png");

    await login(page, email, password);

    await expect(page).toHaveURL(/\/host-dashboard/, { timeout: AUTH_TIMEOUT });
    await expect(
      page.getByRole("heading", { name: /Host Dashboard/i }),
    ).toBeVisible();
    await settleForScreenshot(page);
    await expect(page).toHaveScreenshot("host-dashboard.png", {
      // Avatars and live member counts shift often on production.
      mask: [page.locator("img"), page.locator("header")],
    });

    await signOut(page);
    await settleForScreenshot(page);
    await expect(page).toHaveScreenshot("home-after-signout-host.png");
  });

  test("member user can sign in, view member dashboard, and sign out", async ({
    page,
  }) => {
    const email = process.env.MEMBER_EMAIL!;
    const password = process.env.MEMBER_PASSWORD!;

    await assertHomepage(page);
    await settleForScreenshot(page);
    await expect(page).toHaveScreenshot("home-signed-out-member.png");

    await login(page, email, password);

    // Exact pathname — /\/dashboard/ alone also matches /host-dashboard.
    await expect(page).toHaveURL(
      (url) => url.pathname === "/dashboard",
      { timeout: AUTH_TIMEOUT },
    );
    await expect(
      page.getByRole("heading", { name: /My Dashboard/i }),
    ).toBeVisible();
    await settleForScreenshot(page);
    await expect(page).toHaveScreenshot("member-dashboard.png");

    await signOut(page);
    await settleForScreenshot(page);
    await expect(page).toHaveScreenshot("home-after-signout-member.png");
  });
});

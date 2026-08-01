const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    storageState: ".playwright-qa/session-ksmember.json",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  await page.goto("http://localhost:3000/dashboard", { waitUntil: "networkidle" });

  const width = await page.evaluate(() => window.innerWidth);
  console.log("viewport width:", width);

  // Find and open the hamburger/menu trigger -- TopBar.tsx's menu button has no accessible
  // name (icon-only, no aria-label), so target it by its actual class instead of role+name.
  const menuButton = page.locator("button.md\\:hidden").first();
  const menuVisible = await menuButton.isVisible().catch(() => false);
  console.log("menu button visible:", menuVisible);
  if (menuVisible) {
    await menuButton.click();
    await page.waitForTimeout(400);
  }

  const kingdomScrollSingular = await page.getByRole("link", { name: "Kingdom Scroll", exact: true }).isVisible().catch(() => false);
  const theKingdomScroll = await page.getByRole("link", { name: "The Kingdom Scroll", exact: true }).isVisible().catch(() => false);
  console.log('link "Kingdom Scroll" (singular, testimony wall) visible:', kingdomScrollSingular);
  console.log('link "The Kingdom Scroll" (Gateway) visible:', theKingdomScroll);

  const singularHref = await page.getByRole("link", { name: "Kingdom Scroll", exact: true }).getAttribute("href").catch(() => null);
  const gatewayHref = await page.getByRole("link", { name: "The Kingdom Scroll", exact: true }).getAttribute("href").catch(() => null);
  console.log('"Kingdom Scroll" href:', singularHref);
  console.log('"The Kingdom Scroll" href:', gatewayHref);

  // Check no horizontal overflow
  const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  console.log("has horizontal overflow:", hasOverflow);

  await page.screenshot({ path: ".playwright-qa/screenshots/mobile-drawer-signed-in.png", fullPage: false });
  console.log("screenshot saved");

  await browser.close();
})().catch((err) => {
  console.error("SCRIPT ERROR:", err);
  process.exit(1);
});

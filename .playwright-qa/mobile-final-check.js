const { chromium } = require("playwright");

async function checkOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
}

(async () => {
  const browser = await chromium.launch();

  // Signed-out checks: /forgot-password form fit at mobile width
  const anonContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  const anonPage = await anonContext.newPage();
  await anonPage.goto("http://localhost:3000/forgot-password", { waitUntil: "networkidle" });
  console.log("/forgot-password overflow:", await checkOverflow(anonPage));
  const emailFieldBox = await anonPage.getByLabel("Email Address").boundingBox();
  console.log("/forgot-password email field box:", emailFieldBox);
  await anonPage.screenshot({ path: ".playwright-qa/screenshots/mobile-forgot-password.png" });

  await anonPage.goto("http://localhost:3000/reset-password", { waitUntil: "networkidle" });
  console.log("/reset-password (no session) overflow:", await checkOverflow(anonPage));
  const problemHeading = await anonPage.getByText("Reset link problem").isVisible().catch(() => false);
  console.log('/reset-password shows "Reset link problem":', problemHeading);
  await anonPage.screenshot({ path: ".playwright-qa/screenshots/mobile-reset-password-error.png" });
  await anonContext.close();

  // Signed-in check: Gateway CTA + Questions tab layout at mobile width
  const memberContext = await browser.newContext({
    storageState: ".playwright-qa/session-ksmember.json",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  const memberPage = await memberContext.newPage();
  await memberPage.goto("http://localhost:3000/kingdom-scrolls", { waitUntil: "networkidle" });
  console.log("/kingdom-scrolls overflow:", await checkOverflow(memberPage));
  const ctaVisible = await memberPage.getByRole("link", { name: "Go To Inventory Plot" }).isVisible().catch(() => false);
  console.log('Gateway "Go To Inventory Plot" CTA visible on mobile:', ctaVisible);
  await memberPage.screenshot({ path: ".playwright-qa/screenshots/mobile-gateway.png" });

  await memberPage.goto("http://localhost:3000/journey/a09cb890-6ef1-4564-a59a-06823975e649/studied", {
    waitUntil: "networkidle",
  });
  const questionsTabBtn = memberPage.getByRole("button", { name: "Questions" });
  if (await questionsTabBtn.isVisible().catch(() => false)) {
    await questionsTabBtn.click();
    await memberPage.waitForTimeout(300);
  }
  console.log("Study page Questions tab overflow:", await checkOverflow(memberPage));
  const checkAnswerBtns = await memberPage.getByRole("button", { name: "Check Answer" }).count();
  console.log("Check Answer buttons visible on mobile (0 expected if already all answered):", checkAnswerBtns);
  await memberPage.screenshot({ path: ".playwright-qa/screenshots/mobile-questions-tab.png", fullPage: true });

  await browser.close();
})().catch((err) => {
  console.error("SCRIPT ERROR:", err);
  process.exit(1);
});

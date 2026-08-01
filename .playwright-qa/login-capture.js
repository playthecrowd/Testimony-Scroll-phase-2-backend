const { chromium } = require('playwright');

const EMAIL = process.argv[2];
const OUT_FILE = process.argv[3];

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--window-size=1000,800'] });
  const context = await browser.newContext({ viewport: { width: 960, height: 760 } });
  const page = await context.newPage();

  await page.goto('http://localhost:3000/login');
  await page.waitForTimeout(1000);
  await page.getByPlaceholder('you@example.com').fill(EMAIL);

  console.log(`Email filled: ${EMAIL}`);
  console.log('Waiting up to 5 minutes for you to type the password and sign in in the opened window...');

  try {
    await page.waitForFunction(
      () => !window.location.pathname.startsWith('/login'),
      null,
      { timeout: 5 * 60 * 1000, polling: 500 }
    );
  } catch (err) {
    await browser.close();
    throw err;
  }

  await page.waitForTimeout(1500);
  await context.storageState({ path: OUT_FILE });
  console.log(`Session saved to ${OUT_FILE}`);
  await browser.close();
})().catch((err) => {
  console.error('login-capture failed:', err.message || err);
  process.exit(1);
});

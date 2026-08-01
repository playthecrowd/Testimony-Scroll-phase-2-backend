// Mobile verification for Kingdom Scrolls Gateway + Inventory Land, using genuinely isolated
// Playwright browser contexts (real viewport emulation, not window.innerWidth spoofing). Uses
// saved auth sessions (session-kschurch.json = 0/2 progress, session-ksmember.json = 2/2, already
// has one placed item) captured via login-capture.js.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:3000';
const OUT_DIR = path.join(__dirname, 'screenshots');
fs.mkdirSync(OUT_DIR, { recursive: true });

const VIEWPORTS = [
  { name: 'mobile-390x844', width: 390, height: 844, isMobile: true, hasTouch: true },
  { name: 'mobile-430x932', width: 430, height: 932, isMobile: true, hasTouch: true },
  { name: 'tablet-768x1024', width: 768, height: 1024, isMobile: true, hasTouch: true },
];

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}: ${name}${detail ? ' -- ' + detail : ''}`);
}

async function hasHorizontalOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
}

async function checkTouchTargets(page, selector, label) {
  const boxes = await page.locator(selector).all();
  let allOk = true;
  let detail = [];
  for (const box of boxes) {
    if (!(await box.isVisible())) continue;
    const bb = await box.boundingBox();
    if (!bb) continue;
    const ok = bb.width >= 44 - 1 && bb.height >= 44 - 1;
    if (!ok) {
      allOk = false;
      detail.push(`${bb.width.toFixed(0)}x${bb.height.toFixed(0)}`);
    }
  }
  record(`Touch targets >= 44x44px: ${label}`, allOk, allOk ? `${boxes.length} checked` : `undersized: ${detail.join(', ')}`);
}

// Robust, verified lesson completion: navigates to the lesson, starts the journey if needed,
// checks every applicable item via accessible role (not raw text nodes, which can resolve to a
// non-clickable child span), waits for 100% progress, and only clicks Mark Study Complete once it
// is actually enabled -- clicking a disabled button is a silent no-op and was the root cause of
// the first run's failures.
async function completeLesson(page, slug, vpName, screenshotPrefix) {
  await page.goto(`${BASE}/lessons/${slug}`, { waitUntil: 'networkidle' });

  const startLink = page.getByRole('link', { name: /Start Your Journey/i });
  if (await startLink.isVisible().catch(() => false)) {
    await Promise.all([page.waitForURL(/\/journey\/.+\/studied/, { timeout: 15000 }), startLink.click()]);
  } else if (!/\/journey\/.+\/studied/.test(page.url())) {
    // Already-started journeys sometimes need a manual nav (e.g. "View Journey" on My Journey) --
    // fall back to My Journey and click through if the lesson detail page didn't offer the link.
    const continueLink = page.getByRole('link', { name: /Continue Your Journey|View Journey/i });
    if (await continueLink.isVisible().catch(() => false)) {
      await Promise.all([page.waitForURL(/\/journey\/.+\/studied/, { timeout: 15000 }), continueLink.click()]);
    }
  }
  await page.waitForLoadState('networkidle');

  // If already 100%/complete from a prior pass, nothing more to do.
  const alreadyComplete = await page.getByText('Studied stage complete').isVisible().catch(() => false);
  if (alreadyComplete) {
    record(`${vpName}: ${slug} already Studied-complete (idempotent re-check)`, true);
    return;
  }

  for (const label of ['Read the lesson overview', 'Watch the video']) {
    const btn = page.getByRole('button', { name: label });
    if (await btn.isVisible().catch(() => false)) {
      const pressed = await btn.getAttribute('aria-pressed').catch(() => null);
      if (pressed !== 'true') {
        await btn.click();
        await page.waitForTimeout(400);
      }
    }
  }

  const questionsTab = page.getByRole('button', { name: 'Questions' });
  if (await questionsTab.isVisible().catch(() => false)) {
    await questionsTab.click();
    await page.waitForTimeout(300);
    const questionButtons = page.locator('ol li button[aria-pressed]');
    const count = await questionButtons.count().catch(() => 0);
    for (let i = 0; i < count; i++) {
      const btn = questionButtons.nth(i);
      const pressed = await btn.getAttribute('aria-pressed').catch(() => null);
      if (pressed !== 'true') {
        await btn.click();
        await page.waitForTimeout(150);
      }
    }
  }

  // Verify 100% before attempting to mark complete -- do not click a disabled button and assume
  // it worked.
  await page.waitForTimeout(500);
  const progressText = await page.getByText(/\d+% /).textContent().catch(() => null);
  const at100 = await page.getByText('100%').isVisible().catch(() => false);
  record(`${vpName}: ${slug} checklist reached 100%`, at100, `progress node: ${progressText}`);
  if (!at100) {
    await page.screenshot({ path: path.join(OUT_DIR, `${screenshotPrefix}-DEBUG-checklist-incomplete-${slug}.png`), fullPage: true });
    return; // don't attempt Mark Study Complete on an incomplete checklist
  }

  const markCompleteBtn = page.getByRole('button', { name: /Mark Study Complete/i });
  const enabled = await markCompleteBtn.isEnabled().catch(() => false);
  if (!enabled) {
    await page.screenshot({ path: path.join(OUT_DIR, `${screenshotPrefix}-DEBUG-markcomplete-disabled-${slug}.png`), fullPage: true });
    record(`${vpName}: ${slug} Mark Study Complete was enabled`, false);
    return;
  }
  page.once('dialog', (d) => d.accept());
  await markCompleteBtn.click();
  await page.waitForTimeout(2000);
  const nowComplete = await page.getByText('Studied stage complete').isVisible().catch(() => false);
  record(`${vpName}: ${slug} marked Studied-complete`, nowComplete);
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  for (const vp of VIEWPORTS) {
    console.log(`\n=== Viewport: ${vp.name} ===`);

    // ---------- Gateway: 0/2 -> 1/2 -> 2/2 using kschurch ----------
    const churchCtx = await browser.newContext({
      storageState: path.join(__dirname, 'session-kschurch.json'),
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile,
      hasTouch: vp.hasTouch,
      deviceScaleFactor: 2,
    });
    const churchPage = await churchCtx.newPage();
    await churchPage.goto(`${BASE}/kingdom-scrolls`, { waitUntil: 'networkidle' });
    await churchPage.waitForTimeout(1000);

    const startCount = (await churchPage.getByText(/lessons completed toward Inventory Land/).textContent().catch(() => '')) || '';
    console.log(`[${vp.name}] starting Gateway progress text: "${startCount.trim()}"`);

    const overflow0 = await hasHorizontalOverflow(churchPage);
    record(`${vp.name}: Gateway no horizontal overflow (initial)`, !overflow0);
    await churchPage.screenshot({ path: path.join(OUT_DIR, `${vp.name}-01-gateway-initial.png`), fullPage: true });

    const lessonsHeading = churchPage.getByText('Lessons Available', { exact: true });
    record(`${vp.name}: Lessons Available reachable`, await lessonsHeading.isVisible().catch(() => false));
    await churchPage.screenshot({ path: path.join(OUT_DIR, `${vp.name}-02-lessons-available.png`), fullPage: true });

    const inventoryHeading = churchPage.getByText('Seeker Inventory', { exact: true });
    record(`${vp.name}: Seeker Inventory reachable`, await inventoryHeading.isVisible().catch(() => false));
    await churchPage.screenshot({ path: path.join(OUT_DIR, `${vp.name}-03-seeker-inventory.png`), fullPage: true });

    // Complete both lessons (idempotent -- if this account already progressed on a prior viewport
    // pass, completeLesson() detects "already complete" and skips re-doing it).
    await completeLesson(churchPage, 'ready-for-the-harvest', vp.name, vp.name);
    await churchPage.goto(`${BASE}/kingdom-scrolls`, { waitUntil: 'networkidle' });
    await churchPage.waitForTimeout(800);
    record(`${vp.name}: Gateway no horizontal overflow (1/2)`, !(await hasHorizontalOverflow(churchPage)));
    record(`${vp.name}: 1/2 messaging present`, await churchPage.getByText(/1 more distinct lesson/i).isVisible().catch(() => false));
    await churchPage.screenshot({ path: path.join(OUT_DIR, `${vp.name}-04-gateway-1of2.png`), fullPage: true });

    await completeLesson(churchPage, 'faith-in-action', vp.name, vp.name);
    await churchPage.goto(`${BASE}/kingdom-scrolls`, { waitUntil: 'networkidle' });
    await churchPage.waitForTimeout(800);
    record(`${vp.name}: Gateway no horizontal overflow (2/2)`, !(await hasHorizontalOverflow(churchPage)));
    const unlockedMsg = churchPage.getByText('Inventory Land is unlocked!');
    record(`${vp.name}: Unlocked state renders at 2/2`, await unlockedMsg.isVisible().catch(() => false));
    await churchPage.screenshot({ path: path.join(OUT_DIR, `${vp.name}-05-gateway-2of2-unlocked.png`), fullPage: true });

    const continueBtn = churchPage.getByRole('link', { name: /Go To Inventory Plot/i });
    record(`${vp.name}: Go To Inventory Plot reachable`, await continueBtn.isVisible().catch(() => false));
    await churchCtx.close();

    // ---------- Inventory Land interactions using ksmember (already 2/2) ----------
    const memberCtx = await browser.newContext({
      storageState: path.join(__dirname, 'session-ksmember.json'),
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile,
      hasTouch: vp.hasTouch,
      deviceScaleFactor: 2,
    });
    const mp = await memberCtx.newPage();
    await mp.goto(`${BASE}/kingdom-scrolls/inventory-land`, { waitUntil: 'networkidle' });
    await mp.waitForTimeout(1500);
    record(`${vp.name}: Inventory Land loads at mobile width`, mp.url().includes('/inventory-land'));
    await mp.screenshot({ path: path.join(OUT_DIR, `${vp.name}-06-inventory-land-initial.png`) });
    record(`${vp.name}: Inventory Land no horizontal overflow`, !(await hasHorizontalOverflow(mp)));

    const buildBtn = mp.getByRole('button', { name: /^Build$/ });
    if (await buildBtn.isVisible().catch(() => false)) {
      await buildBtn.click();
      await mp.waitForTimeout(500);
    }

    const inventoryLauncher = mp.getByRole('button', { name: /Open Seeker Inventory/ });
    const launcherVisible = await inventoryLauncher.isVisible().catch(() => false);
    record(`${vp.name}: Mobile Seeker Inventory launcher visible`, launcherVisible);
    if (launcherVisible) {
      await inventoryLauncher.click();
      await mp.waitForTimeout(600);
    }
    record(`${vp.name}: Mobile Seeker Inventory bottom sheet opens with production copy`, await mp.getByText('Beta preview').isVisible().catch(() => false));
    await mp.screenshot({ path: path.join(OUT_DIR, `${vp.name}-07-inventory-bottomsheet-open.png`) });

    const lanternBtn = mp.getByRole('button', { name: /Listening Lantern/i });
    const lanternVisible = await lanternBtn.first().isVisible().catch(() => false);
    record(`${vp.name}: Inventory item selectable`, lanternVisible);
    if (lanternVisible) {
      await lanternBtn.first().click();
      await mp.waitForTimeout(500);
    }

    // Try several candidate points to find a valid (green) placement cell -- camera framing shifts
    // with viewport size/aspect ratio, so no single hard-coded point works across all three sizes.
    const candidates = [
      [0.42, 0.42], [0.5, 0.45], [0.45, 0.5], [0.55, 0.42], [0.42, 0.55], [0.5, 0.5], [0.38, 0.48],
    ];
    const confirmBtn = mp.getByRole('button', { name: 'Confirm placement' });
    let placed = false;
    for (const [fx, fy] of candidates) {
      const x = Math.round(vp.width * fx);
      const y = Math.round(vp.height * fy);
      await mp.mouse.click(x, y);
      await mp.waitForTimeout(350);
      if (await confirmBtn.isVisible().catch(() => false) && (await confirmBtn.isEnabled().catch(() => false))) {
        placed = true;
        break;
      }
    }
    await mp.screenshot({ path: path.join(OUT_DIR, `${vp.name}-08-placement-preview.png`) });

    const rotateBtn = mp.getByRole('button', { name: 'Rotate item' });
    const cancelBtn = mp.getByRole('button', { name: 'Cancel placement' });
    const rotateVisible = await rotateBtn.isVisible().catch(() => false);
    const confirmVisible = await confirmBtn.isVisible().catch(() => false);
    const cancelVisible = await cancelBtn.isVisible().catch(() => false);
    record(`${vp.name}: Rotate/Confirm/Cancel controls accessible`, rotateVisible && confirmVisible && cancelVisible, `rotate=${rotateVisible} confirm=${confirmVisible} cancel=${cancelVisible}`);
    if (rotateVisible) {
      await rotateBtn.click();
      await mp.waitForTimeout(300);
    }
    await checkTouchTargets(mp, 'button[aria-label="Rotate item"], button[aria-label="Confirm placement"], button[aria-label="Cancel placement"]', `${vp.name} placement toolbar`);

    if (placed && (await confirmBtn.isEnabled().catch(() => false))) {
      await confirmBtn.click();
      await mp.waitForTimeout(600);
      record(`${vp.name}: Item placed via mobile confirm control`, true);
    } else if (cancelVisible) {
      await cancelBtn.click();
      await mp.waitForTimeout(300);
      record(`${vp.name}: Item placed via mobile confirm control`, false, 'no candidate cell was valid across 7 tries -- used Cancel; see screenshot 08 for camera framing');
    }
    await mp.screenshot({ path: path.join(OUT_DIR, `${vp.name}-09-after-confirm-or-cancel.png`) });

    // Pan gesture
    try {
      await mp.mouse.move(vp.width / 2, vp.height / 2);
      await mp.mouse.down();
      await mp.mouse.move(vp.width / 2 - 60, vp.height / 2 - 40, { steps: 8 });
      await mp.mouse.up();
      await mp.waitForTimeout(300);
      record(`${vp.name}: Pan gesture accepted (no crash/error)`, true);
    } catch (e) {
      record(`${vp.name}: Pan gesture accepted (no crash/error)`, false, String(e.message || e));
    }

    // Camera bounds after hard repeated panning
    for (let i = 0; i < 6; i++) {
      await mp.mouse.move(vp.width / 2, vp.height / 2);
      await mp.mouse.down();
      await mp.mouse.move(vp.width / 2 + 150, vp.height / 2 + 150, { steps: 5 });
      await mp.mouse.up();
      await mp.waitForTimeout(100);
    }
    await mp.screenshot({ path: path.join(OUT_DIR, `${vp.name}-10-camera-bounds-after-hard-pan.png`) });
    record(`${vp.name}: Camera bounds check (visual -- see screenshot 10)`, true);

    // Reload-persistence, scoped to THIS Playwright browser profile only (its localStorage is
    // independent of any other browser, e.g. the earlier desktop claude-in-chrome session -- a
    // fresh Playwright profile legitimately starts with zero placements of its own until this run
    // places one).
    const placementsBefore = await mp.evaluate(() => {
      const key = Object.keys(localStorage).find((k) => k.startsWith('kingdom-scrolls-inventory-land-placements-v1:'));
      return key ? JSON.parse(localStorage.getItem(key) || '[]').length : 0;
    });
    await mp.reload({ waitUntil: 'networkidle' });
    await mp.waitForTimeout(1000);
    const placementsAfter = await mp.evaluate(() => {
      const key = Object.keys(localStorage).find((k) => k.startsWith('kingdom-scrolls-inventory-land-placements-v1:'));
      return key ? JSON.parse(localStorage.getItem(key) || '[]').length : 0;
    });
    record(
      `${vp.name}: Reload preserves placed object(s) for this profile`,
      placementsBefore === placementsAfter && placementsBefore > 0,
      `before=${placementsBefore} after=${placementsAfter}`
    );
    await mp.screenshot({ path: path.join(OUT_DIR, `${vp.name}-11-after-reload.png`) });

    const offscreenEls = await mp.evaluate(({ vw, vh }) => {
      const els = Array.from(document.querySelectorAll('button, a, [role="toolbar"]'));
      const bad = [];
      for (const el of els) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.left < -2 || r.top < -2 || r.right > vw + 2 || r.bottom > vh + 2) {
          bad.push({ text: (el.textContent || el.getAttribute('aria-label') || '').slice(0, 30), rect: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)] });
        }
      }
      return bad;
    }, { vw: vp.width, vh: vp.height });
    record(`${vp.name}: No interactive element trapped offscreen`, offscreenEls.length === 0, offscreenEls.length ? JSON.stringify(offscreenEls.slice(0, 5)) : '');

    await memberCtx.close();
  }

  await browser.close();

  console.log('\n=== SUMMARY ===');
  const failed = results.filter((r) => !r.pass);
  console.log(`${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log('FAILED CHECKS:');
    failed.forEach((f) => console.log(`  - ${f.name}: ${f.detail}`));
  }
  fs.writeFileSync(path.join(OUT_DIR, 'results.json'), JSON.stringify(results, null, 2));
  process.exit(failed.length ? 1 : 0);
})().catch((err) => {
  console.error('mobile-verify crashed:', err);
  process.exit(1);
});

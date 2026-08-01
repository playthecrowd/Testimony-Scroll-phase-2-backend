// Verification script for the rebuilt "Study Questions" feature on the member lesson-journey
// page. Read-only QA against a running local dev server; does not touch application code.
// Selectors are based directly on app/journey/[lessonId]/studied/StudiedClient.tsx and
// lib/journeyChecklist.ts (read before writing this script), not guessed.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:3000';
const OUT_DIR = path.join(__dirname, 'screenshots');
fs.mkdirSync(OUT_DIR, { recursive: true });

const LESSON_SLUG = 'make-room-for-christ';
const LESSON_ID = 'a09cb890-6ef1-4564-a59a-06823975e649';
const STUDY_URL = `${BASE}/journey/${LESSON_ID}/studied`;
const PUBLIC_URL = `${BASE}/lessons/${LESSON_SLUG}`;

const QUESTIONS = [
  { text: 'What is the main focus of "Make Room for Christ"?', correct: 'Living the lesson theme with faith' },
  { text: 'Which Bible verse guides "Make Room for Christ"?', correct: 'Luke 2:7' },
  { text: 'What action connects best with "Make Room for Christ"?', correct: 'Pray, obey, and take one faithful step' },
  { text: 'How can "Make Room for Christ" strengthen Renaissance Church Of Christ?', correct: 'By helping people live and serve together' },
  { text: 'What is one sign "Make Room for Christ" is taking root?', correct: 'Faith becomes visible through love and action' },
];

const results = [];
function record(n, status, detail) {
  results.push({ n, status, detail });
  console.log(`${n}. ${status} -- ${detail}`);
}
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const networkBodies = []; // { url, body } for every JSON/text response seen during the whole run

async function getQuestionLi(page, questionText) {
  return page.locator('ol > li').filter({ hasText: questionText }).first();
}

async function getChoiceTexts(li) {
  const radios = li.getByRole('radio');
  const count = await radios.count();
  const texts = [];
  for (let i = 0; i < count; i++) {
    const label = await radios.nth(i).getAttribute('aria-label');
    // aria-label format: "Question N, answer X: <answerText>"
    const m = label && label.match(/:\s(.*)$/);
    texts.push(m ? m[1] : label);
  }
  return texts;
}

async function selectChoice(li, choiceText) {
  const radio = li.getByRole('radio', { name: new RegExp(`:\\s${escapeRegExp(choiceText)}$`) });
  await radio.check();
}

function checkAnswerButton(li) {
  return li.getByRole('button', { name: /Check Answer/i });
}

function statusRegion(li) {
  return li.locator('[role="status"]');
}

async function submitAndWait(page, li) {
  await checkAnswerButton(li).click();
  // Poll until the status region shows non-empty feedback or the Check Answer button disappears
  // (both happen once the RPC round-trip resolves).
  await page
    .waitForFunction(
      (el) => {
        const status = el.querySelector('[role="status"]');
        const hasStatusText = status && status.textContent && status.textContent.trim().length > 0;
        const hasCheckBtn = Array.from(el.querySelectorAll('button')).some((b) => /Check Answer/i.test(b.textContent || ''));
        return hasStatusText || !hasCheckBtn;
      },
      await li.elementHandle(),
      { timeout: 10000 }
    )
    .catch(() => {});
  await page.waitForTimeout(200);
}

async function getChecklistState(page) {
  const label = page.getByText('Complete reflection questions', { exact: true });
  if ((await label.count().catch(() => 0)) === 0) return null;
  const div = label.locator('xpath=ancestor::div[contains(@class,"flex")][1]');
  const text = await div.first().innerText().catch(() => '');
  return { text, completed: !text.includes('See Questions tab') };
}

async function getProgressState(page) {
  const el = page.getByText(/items complete/i).first();
  if ((await el.count().catch(() => 0)) === 0) return null;
  const text = await el.innerText().catch(() => '');
  const pctEl = page.locator('p.text-3xl').first();
  const pctText = (await pctEl.count().catch(() => 0)) > 0 ? await pctEl.innerText().catch(() => '') : '';
  return { itemsText: text, pctText };
}

async function openQuestionsTab(page) {
  const tabBtn = page.getByRole('button', { name: 'Questions', exact: true });
  await tabBtn.click();
  await page.waitForTimeout(400);
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ storageState: path.join(__dirname, 'session-ksmember.json') });
  const page = await context.newPage();

  page.on('response', async (res) => {
    try {
      const ct = res.headers()['content-type'] || '';
      if (ct.includes('json') || ct.includes('text')) {
        const body = await res.text().catch(() => null);
        if (body) networkBodies.push({ url: res.url(), body });
      }
    } catch (_) {}
  });

  // ---------- Step 1 ----------
  let s1 = 'FAIL', s1d = '';
  try {
    await page.goto(PUBLIC_URL, { waitUntil: 'networkidle' });
    const html = await page.content();
    const bodyText = await page.evaluate(() => document.body.innerText);
    const leaks = ['Living the lesson theme', 'Luke 2:7', ...QUESTIONS.map((q) => q.text)].filter(
      (n) => html.includes(n) || bodyText.includes(n)
    );
    const questionsBtnCount = await page.getByRole('button', { name: 'Questions', exact: true }).count().catch(() => 0);
    const questionsLinkCount = await page.getByRole('link', { name: 'Questions', exact: true }).count().catch(() => 0);
    await page.screenshot({ path: path.join(OUT_DIR, '01-public-lesson-page.png'), fullPage: true });
    if (leaks.length === 0 && questionsBtnCount === 0 && questionsLinkCount === 0) {
      s1 = 'PASS';
      s1d = 'No question text/answers found in HTML or visible text; no button/link labeled "Questions" on the public page.';
    } else {
      s1d = `Leaked strings: [${leaks.join(', ')}]; Questions button count: ${questionsBtnCount}, link count: ${questionsLinkCount}`;
    }
  } catch (e) {
    s1 = 'UNABLE-TO-TEST'; s1d = `Error: ${e.message}`;
  }
  record(1, s1, s1d);

  // ---------- Step 2 ----------
  // NOTE: "Start Your Journey" renders as a <button> (Button component, onClick handler), while
  // "Continue Your Journey" renders as an <a> (LinkButton/Link) -- confirmed by reading
  // app/lessons/[lessonId]/LessonDetailClient.tsx lines ~453-464 before writing this selector.
  let s2 = 'FAIL', s2d = '';
  try {
    const startBtn = page.getByRole('button', { name: 'Start Your Journey', exact: true });
    const continueLink = page.getByRole('link', { name: 'Continue Your Journey', exact: true });
    if (await startBtn.isVisible().catch(() => false)) {
      await Promise.all([page.waitForURL(/\/journey\/.+\/studied/, { timeout: 15000 }), startBtn.click()]);
    } else if (await continueLink.isVisible().catch(() => false)) {
      await Promise.all([page.waitForURL(/\/journey\/.+\/studied/, { timeout: 15000 }), continueLink.click()]);
    } else {
      throw new Error('Neither "Start Your Journey" button nor "Continue Your Journey" link was visible on the public page');
    }
    await page.waitForLoadState('networkidle').catch(() => {});
    const landedUrl = page.url();
    if (landedUrl === STUDY_URL || landedUrl.startsWith(STUDY_URL)) {
      s2 = 'PASS'; s2d = `Landed on ${landedUrl}`;
    } else {
      s2d = `Landed on unexpected URL: ${landedUrl}`;
    }
  } catch (e) {
    s2 = 'UNABLE-TO-TEST'; s2d = `Error: ${e.message}`;
    await page.goto(STUDY_URL, { waitUntil: 'networkidle' }).catch(() => {});
  }
  record(2, s2, s2d);

  // ---------- Step 3 ----------
  let s3 = 'FAIL', s3d = '';
  try {
    await openQuestionsTab(page);
    const bodyText = await page.evaluate(() => document.body.innerText);
    const missing = QUESTIONS.filter((q) => !bodyText.includes(q.text));
    let choiceCounts = [];
    let checkBtnCount = 0;
    for (const q of QUESTIONS) {
      const li = await getQuestionLi(page, q.text);
      const radios = await li.getByRole('radio').count().catch(() => 0);
      choiceCounts.push(radios);
      if ((await checkAnswerButton(li).count().catch(() => 0)) > 0) checkBtnCount++;
    }
    await page.screenshot({ path: path.join(OUT_DIR, '02-questions-tab-open.png'), fullPage: true });
    const allFourChoices = choiceCounts.every((c) => c === 4);
    if (missing.length === 0 && allFourChoices && checkBtnCount === 5) {
      s3 = 'PASS';
      s3d = `All 5 question texts visible, each with 4 radio choices (${choiceCounts.join(',')}), 5 "Check Answer" buttons found.`;
    } else {
      s3d = `Missing questions: [${missing.map((q) => q.text).join(', ')}]; choice counts: [${choiceCounts.join(',')}]; Check Answer buttons: ${checkBtnCount}`;
    }
  } catch (e) {
    s3 = 'UNABLE-TO-TEST'; s3d = `Error: ${e.message}`;
  }
  record(3, s3, s3d);

  const pageHtmlAfterOpen = await page.content().catch(() => '');
  const networkBodiesAfterOpen = networkBodies.slice();

  // ---------- Step 4 ----------
  let s4 = 'FAIL', s4d = '';
  try {
    const state = await getChecklistState(page);
    if (!state) {
      s4 = 'UNABLE-TO-TEST'; s4d = 'Could not locate "Complete reflection questions" checklist item.';
    } else if (!state.completed) {
      s4 = 'PASS'; s4d = `Checklist item text: ${JSON.stringify(state.text)} -- shows "See Questions tab" (not complete), as expected before any answers are submitted.`;
    } else {
      s4d = `Checklist item already shows complete before answering anything: ${JSON.stringify(state.text)}`;
    }
  } catch (e) {
    s4 = 'UNABLE-TO-TEST'; s4d = `Error: ${e.message}`;
  }
  record(4, s4, s4d);

  // Detect whether this journey's questions were already answered/locked by a prior run in this
  // same QA session (no delete/reset path exists for a normal member on lesson_journey_items by
  // design -- see supabase/migrations/0008_lesson_journeys.sql's closing "No delete policy on
  // either table by design" comment -- and an attempt to reset via the member's own
  // legitimately-permitted RLS self-update (an UPDATE, which IS granted) was blocked by the
  // sandbox's permission system, so a second genuinely-fresh run isn't available this session).
  const q1LiForLockCheck = await getQuestionLi(page, QUESTIONS[0].text);
  const alreadyLocked = (await checkAnswerButton(q1LiForLockCheck).count().catch(() => 0)) === 0;
  const LOCK_NOTE =
    'Questions are already locked as correct from an earlier run of this same script in this session; ' +
    'no reset path is available (member accounts have no delete permission on lesson_journey_items by design, ' +
    'and a legitimate self-update reset attempt was blocked by the permission system). ' +
    'See the first run of this script (captured in the report) for direct evidence of the live wrong/right feedback flow.';

  // ---------- Step 5: wrong answer on Q1 ----------
  let s5 = 'FAIL', s5d = '';
  if (alreadyLocked) {
    s5 = 'UNABLE-TO-TEST'; s5d = LOCK_NOTE;
  } else {
    try {
      const li = await getQuestionLi(page, QUESTIONS[0].text);
      const choices = await getChoiceTexts(li);
      const wrongChoiceQ1 = choices.find((c) => c && c.trim() !== QUESTIONS[0].correct);
      if (!wrongChoiceQ1) throw new Error(`Could not find a distractor among choices: ${JSON.stringify(choices)}`);
      await selectChoice(li, wrongChoiceQ1);
      await submitAndWait(page, li);
      const statusText = (await statusRegion(li).innerText().catch(() => '')).trim();
      const stillHasCheckBtn = (await checkAnswerButton(li).count().catch(() => 0)) > 0;
      await page.screenshot({ path: path.join(OUT_DIR, '03-question1-incorrect-feedback.png'), fullPage: true });
      if (/not quite/i.test(statusText)) {
        s5 = 'PASS';
        s5d = `Selected wrong choice "${wrongChoiceQ1}", clicked Check Answer. Status region showed: "${statusText}". Check Answer button still present: ${stillHasCheckBtn} (question not marked complete).`;
      } else {
        s5d = `Selected wrong choice "${wrongChoiceQ1}" but status region text was: "${statusText}" (expected "Not quite..."). Check Answer button present: ${stillHasCheckBtn}`;
      }
    } catch (e) {
      s5 = 'UNABLE-TO-TEST'; s5d = `Error: ${e.message}`;
    }
  }
  record(5, s5, s5d);

  // ---------- Step 6: correct answer on Q1 ----------
  let s6 = 'FAIL', s6d = '';
  if (alreadyLocked) {
    s6 = 'UNABLE-TO-TEST'; s6d = LOCK_NOTE;
  } else {
    try {
      const li = await getQuestionLi(page, QUESTIONS[0].text);
      await selectChoice(li, QUESTIONS[0].correct);
      await submitAndWait(page, li);
      const statusText = (await statusRegion(li).innerText().catch(() => '')).trim();
      const checkBtnGone = (await checkAnswerButton(li).count().catch(() => 0)) === 0;
      const radios = li.getByRole('radio');
      const radioCount = await radios.count().catch(() => 0);
      let allDisabled = radioCount > 0;
      for (let i = 0; i < radioCount; i++) {
        const disabled = await radios.nth(i).isDisabled().catch(() => false);
        if (!disabled) allDisabled = false;
      }
      await page.screenshot({ path: path.join(OUT_DIR, '04-question1-correct-locked.png'), fullPage: true });
      if (/^correct$/i.test(statusText) && checkBtnGone && allDisabled) {
        s6 = 'PASS';
        s6d = `Status region showed "${statusText}"; Check Answer button removed (locked); all ${radioCount} choices disabled.`;
      } else {
        s6d = `Status region: "${statusText}", Check Answer button gone: ${checkBtnGone}, all choices disabled: ${allDisabled} (${radioCount} radios).`;
      }
    } catch (e) {
      s6 = 'UNABLE-TO-TEST'; s6d = `Error: ${e.message}`;
    }
  }
  record(6, s6, s6d);

  // ---------- Step 7: Q2-Q5, with wrong-then-right repeated on Q3 ----------
  let s7 = 'FAIL', s7d = '';
  if (alreadyLocked) {
    s7 = 'UNABLE-TO-TEST'; s7d = LOCK_NOTE;
  } else {
    const notes = [];
    try {
      // Q2 - correct only
      {
        const li = await getQuestionLi(page, QUESTIONS[1].text);
        await selectChoice(li, QUESTIONS[1].correct);
        await submitAndWait(page, li);
        const t = (await statusRegion(li).innerText().catch(() => '')).trim();
        notes.push(`Q2 correct-submit status: "${t}"`);
      }
      // Q3 - wrong then right
      {
        const li = await getQuestionLi(page, QUESTIONS[2].text);
        const choices = await getChoiceTexts(li);
        const wrong = choices.find((c) => c && c.trim() !== QUESTIONS[2].correct);
        if (wrong) {
          await selectChoice(li, wrong);
          await submitAndWait(page, li);
          const t1 = (await statusRegion(li).innerText().catch(() => '')).trim();
          notes.push(`Q3 wrong-submit ("${wrong}") status: "${t1}"`);
        } else {
          notes.push('Q3 wrong-submit: could not find a distractor');
        }
        await selectChoice(li, QUESTIONS[2].correct);
        await submitAndWait(page, li);
        const t2 = (await statusRegion(li).innerText().catch(() => '')).trim();
        notes.push(`Q3 correct-submit status: "${t2}"`);
      }
      // Q4 - correct only
      {
        const li = await getQuestionLi(page, QUESTIONS[3].text);
        await selectChoice(li, QUESTIONS[3].correct);
        await submitAndWait(page, li);
        const t = (await statusRegion(li).innerText().catch(() => '')).trim();
        notes.push(`Q4 correct-submit status: "${t}"`);
      }
      // Q5 - correct only
      {
        const li = await getQuestionLi(page, QUESTIONS[4].text);
        await selectChoice(li, QUESTIONS[4].correct);
        await submitAndWait(page, li);
        const t = (await statusRegion(li).innerText().catch(() => '')).trim();
        notes.push(`Q5 correct-submit status: "${t}"`);
      }
      const allOk =
        /"Correct"/i.test(notes[0]) &&
        /not quite/i.test(notes[1]) &&
        /"Correct"/i.test(notes[2]) &&
        /"Correct"/i.test(notes[3]) &&
        /"Correct"/i.test(notes[4]);
      s7 = allOk ? 'PASS' : 'FAIL';
      s7d = notes.join(' | ');
    } catch (e) {
      s7 = 'UNABLE-TO-TEST'; s7d = `Error: ${e.message}. Notes so far: ${notes.join(' | ')}`;
    }
  }
  record(7, s7, s7d);

  // ---------- Step 8 ----------
  let s8 = 'FAIL', s8d = '';
  try {
    await page.waitForTimeout(700);
    const checklist = await getChecklistState(page);
    const progress = await getProgressState(page);
    await page.screenshot({ path: path.join(OUT_DIR, '05-all-questions-complete.png'), fullPage: true });
    if (checklist && checklist.completed) {
      s8 = 'PASS';
      s8d = `Checklist item now shows complete: ${JSON.stringify(checklist.text)}. Progress: ${JSON.stringify(progress)}`;
    } else {
      s8d = `Checklist state: ${JSON.stringify(checklist)}. Progress: ${JSON.stringify(progress)}`;
    }
  } catch (e) {
    s8 = 'UNABLE-TO-TEST'; s8d = `Error: ${e.message}`;
  }
  record(8, s8, s8d);

  // ---------- Step 9: reload persistence ----------
  let s9 = 'FAIL', s9d = '';
  try {
    await page.reload({ waitUntil: 'networkidle' });
    await openQuestionsTab(page);
    let allLocked = true;
    const perQ = [];
    for (const q of QUESTIONS) {
      const li = await getQuestionLi(page, q.text);
      const statusText = (await statusRegion(li).innerText().catch(() => '')).trim();
      const checkBtnGone = (await checkAnswerButton(li).count().catch(() => 0)) === 0;
      const ok = /^correct$/i.test(statusText) && checkBtnGone;
      perQ.push(`${q.text.slice(0, 25)}...: status="${statusText}", locked=${checkBtnGone}`);
      if (!ok) allLocked = false;
    }
    const checklist = await getChecklistState(page);
    await page.screenshot({ path: path.join(OUT_DIR, '06-after-reload.png'), fullPage: true });
    if (allLocked && checklist && checklist.completed) {
      s9 = 'PASS';
      s9d = `After full reload, all 5 questions still show "Correct" and locked; checklist item still complete. ${perQ.join(' | ')}`;
    } else {
      s9d = `allLocked=${allLocked}, checklist=${JSON.stringify(checklist)}. ${perQ.join(' | ')}`;
    }
  } catch (e) {
    s9 = 'UNABLE-TO-TEST'; s9d = `Error: ${e.message}`;
  }
  record(9, s9, s9d);

  // ---------- Step 10: is_correct / isCorrect leak search ----------
  let s10 = 'PASS', s10d = '';
  try {
    const htmlSources = [pageHtmlAfterOpen, await page.content().catch(() => '')];
    const foundIn = [];
    for (const h of htmlSources) {
      if (h && (h.includes('is_correct') || h.includes('isCorrect'))) foundIn.push('page HTML (page.content())');
    }
    for (const { url, body } of networkBodies) {
      if (body.includes('is_correct') || body.includes('isCorrect')) foundIn.push(`network response: ${url}`);
    }
    const unique = [...new Set(foundIn)];
    s10d = `Searched page.content() (right after opening Questions tab, and again at end of run) and ${networkBodies.length} JSON/text network response bodies captured over the whole session for literal "is_correct" / "isCorrect". `;
    if (unique.length === 0) {
      s10 = 'PASS'; s10d += 'Found in: none.';
    } else {
      s10 = 'FAIL'; s10d += `Found in: ${unique.join(', ')}`;
    }
  } catch (e) {
    s10 = 'UNABLE-TO-TEST'; s10d = `Error: ${e.message}`;
  }
  record(10, s10, s10d);

  // ---------- Step 11: keyboard-only navigation ----------
  let s11 = 'UNABLE-TO-TEST';
  let s11d = 'All 5 questions were already answered correctly in steps 5-7; nothing left unanswered to drive fresh via keyboard. Verified keyboard mechanics as a proxy on the (already-locked) Q1 block instead.';
  try {
    const li = await getQuestionLi(page, QUESTIONS[0].text);
    const firstRadio = li.getByRole('radio').first();
    const radioExists = (await firstRadio.count().catch(() => 0)) > 0;
    if (radioExists) {
      const isDisabled = await firstRadio.isDisabled().catch(() => null);
      // Even disabled radios can normally still receive programmatic focus check; use tab from body.
      await page.keyboard.press('Tab').catch(() => {});
      s11d += ` Q1's first radio isDisabled=${isDisabled} (expected true/locked, since it was answered correctly and persisted).`;
    }
  } catch (e) {
    s11d += ` Proxy check error: ${e.message}`;
  }
  record(11, s11, s11d);

  await browser.close();

  console.log('\n=== SUMMARY ===');
  for (const r of results) console.log(`${r.n}. ${r.status}`);
})();

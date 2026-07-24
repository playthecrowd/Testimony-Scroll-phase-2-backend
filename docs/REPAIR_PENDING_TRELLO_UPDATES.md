# Pending Trello updates — blocked by MCP outage (2026-07-24)

**Status: no Trello write succeeded for any item below.** The Trello MCP integration
(`mcp-proxy.anthropic.com`) began returning Cloudflare 502 "bad gateway" errors and 300s
background-task timeouts partway through the Batch 6 Trello update pass. All 7 card-update
attempts (D13–D19) and the planned REPAIR PHASE READY update failed before completing -- none
partially applied, none corrupted. This file is the durable record of what still needs to be
written to Trello once the service recovers, so the work isn't lost if the session ends first.

Per owner instruction: do not keep retrying Trello during the outage; retry once after Batch 7
reaches its checkpoint.

## D13–D19: deployed verification evidence and intended moves

All 7 cards are currently in list **❌ Failed QA Results — Needs Development**. Each should be
updated with the description text below, then moved to **✅ Completed / Passed**.

### D13 — trello.com/c/2YFexlyD/55
```
ORIGINAL: AuthScreen's Full Name/Email/Password labels on /login (both tabs) had no id/htmlFor pairing, no aria-label, and inputs weren't wrapped in the label -- 5 of 5 fields (minus the agreement checkbox) had no programmatic association.

FIX (commit 6985979, Batch 6): added matching id/htmlFor pairs -- auth-full-name, auth-email, auth-password -- to all 3 field types across both Sign In and Create Account tabs (distinct ids avoid tab-switch collision since only one tab's fields render at a time).

DEPLOYED RETEST (2026-07-24): live browser query against production.quest4thekingdom.com/login confirmed programmatically -- label[for="auth-email"]/label[for="auth-password"] resolve to real inputs on the Sign In tab; label[for="auth-full-name"] resolves on the Create Account tab. Verified via document.getElementById lookup from each label's `for` attribute, not just visual inspection.

RESULT: PASSED. Moving to Completed.
ORIGIN CARD: Stage 20 — Accessibility Review: trello.com/c/BWLnjq1t
```

### D14 — trello.com/c/vPXpf6a7/56
```
ORIGINAL: the icon-only show/hide-password toggle button on /login had empty textContent and no aria-label/aria-labelledby/title -- screen readers announced only "button".

FIX (commit 6985979, Batch 6): added aria-label={showPw ? "Hide password" : "Show password"} to the toggle button, reflecting current state.

DEPLOYED RETEST (2026-07-24): live browser query against production.quest4thekingdom.com/login confirmed the toggle button's aria-label resolves to "Show password" in its default state via getAttribute, not just visual/text inspection.

RESULT: PASSED. Moving to Completed.
ORIGIN CARD: Stage 20 — Accessibility Review: trello.com/c/BWLnjq1t
```

### D15 — trello.com/c/m3Ttx08S/57
```
ORIGINAL: the church filter <select> on /kingdom-scroll had no id, aria-label, or associated <label> -- zero accessible name.

FIX (commit f6f5162, Batch 6): added aria-label="Filter by church" to the select.

DEPLOYED RETEST (2026-07-24): live browser query against production.quest4thekingdom.com/kingdom-scroll confirmed document.querySelector('select').getAttribute('aria-label') === "Filter by church".

RESULT: PASSED. Moving to Completed.
ORIGIN CARD: Stage 20 — Accessibility Review: trello.com/c/BWLnjq1t
```

### D16 — trello.com/c/98BaAiXZ/58
```
ORIGINAL CLAIM: /leaderboard has zero heading elements, document.querySelectorAll('h1,h2,h3,h4,h5,h6') returns empty.

RE-VERIFICATION (before writing any fix, per this repair phase's standing protocol): direct read of app/leaderboard/page.tsx showed the "Leaderboard" title already rendering as a real <h1>. Confirmed live against production.quest4thekingdom.com/leaderboard with an authenticated session (signed in as [QA] Church A Host) on 2026-07-24: document.querySelectorAll('h1') returns exactly 1 element, textContent "Leaderboard".

DISPOSITION: does not reproduce on current/deployed code. Treated as a stale-build artifact from the original QA scan pass (same disposition as D8 in Batch 3). No code changed -- see docs/REPAIR_D16_DISPOSITION.md (commit 4cd78d5).

RESULT: PASSED (does not reproduce). Moving to Completed.
ORIGIN CARD: Stage 20 — Accessibility Review: trello.com/c/BWLnjq1t
```

### D17 — trello.com/c/UDTm1JgD/59
```
ORIGINAL: / and /about jumped straight from H1 to H3 with no intervening H2 (axe-core "heading-order").

FIX (commit ff6604a, Batch 6): promoted the shared SectionCard / FeaturedEventBanner / FeaturedScrollStrip headings, and /about's local InfoCard heading, from <h3> to <h2>. Checked impact on all other consumers of these shared components (dashboard, host-dashboard, churches/[churchId]) before changing them -- none currently has an H2 between its own H1 and these headings, and churches/[churchId] actually had an existing H3-before-H2 reversal against its own "Church Archive" H2, so this fix is a strict improvement everywhere it's used, not just on the 2 originally-flagged pages.

DEPLOYED RETEST (2026-07-24): live browser heading-tag queries against production.quest4thekingdom.com/ and /about (authenticated). Homepage: H1 -> H2 x7, no skip. /about: H1 -> H2 x5, no skip, no reversal.

RESULT: PASSED. Moving to Completed.
ORIGIN CARD: Stage 20 — Accessibility Review: trello.com/c/BWLnjq1t
```

### D18 — trello.com/c/WMX429cM/60
```
ORIGINAL: the homepage journey-stage strip (overflow-x-auto div wrapping JourneyStagesBar) had scrollWidth > clientWidth (real cut-off content) but no tabindex -- unreachable via keyboard.

FIX (commit c53b156, Batch 6): added tabIndex={0} to the wrapper div.

DEPLOYED RETEST (2026-07-24): live browser check against production.quest4thekingdom.com/ (authenticated) confirmed both the tabindex="0" attribute AND real keyboard-focusability -- called element.focus() directly and verified document.activeElement === the strip element, not just attribute presence.

RESULT: PASSED. Moving to Completed.
ORIGIN CARD: Stage 20 — Accessibility Review: trello.com/c/BWLnjq1t
```

### D19 — trello.com/c/MLHCuziM/61
```
ORIGINAL: --accent-blue (#2f7dff) + white text measured ~3.8:1, below the 4.5:1 WCAG AA threshold for normal text, reused across 5+ pages via one shared design token (bg-accent-blue buttons/badges).

FIX (commit b1262e0, Batch 6): owner selected #1f66e0 (5.20:1 vs white) from 3 candidate values I computed and presented (#1f66e0 5.20:1, #1a5ccc 6.09:1, #1552b8 7.16:1). --accent-blue updated in app/globals.css; --accent-blue-light (used for text-on-dark-background, a different contrast pairing, not flagged) left unchanged.

DEPLOYED RETEST (2026-07-24): live browser query against production.quest4thekingdom.com/ confirmed getComputedStyle(document.documentElement).getPropertyValue('--accent-blue').trim() === "#1f66e0", and computed the actual WCAG relative-luminance contrast ratio in-browser against white: 5.20:1. Regression test tests/repairD19ColorContrast.test.ts computes this ratio from app/globals.css directly (not just string-matching the hex) so a future accidental revert would fail CI.

RESULT: PASSED. Moving to Completed.
ORIGIN CARD: Stage 20 — Accessibility Review: trello.com/c/BWLnjq1t
```

## REPAIR PHASE READY — Batch 6 summary update

Card: trello.com/c/faM01G08/63. Append (in the same style as the existing Batch 1-5 entries):

```
BATCH 6 COMPLETE AND DEPLOYED (2026-07-24) -- Accessibility. D13 (auth field label association),
D14 (password toggle aria-label), D15 (church filter aria-label), D17 (heading hierarchy on / and
/about promoted h3->h2, verified safe across all shared-component consumers), D18 (journey strip
tabindex + real keyboard-focus verification), D19 (--accent-blue darkened to #1f66e0, 5.20:1,
owner-selected from 3 candidates) all fixed, deployed, retested live with DOM-level evidence (not
just visual). D16 re-verified live before any fix was written and does not reproduce on current
code -- reclassified as a stale QA-scan artifact, no code change, same disposition as D8. All 7
Completed/Passed.

Note: a Trello MCP service outage blocked writing these results at the time Batch 6 finished --
see docs/REPAIR_PENDING_TRELLO_UPDATES.md for the full pending update record and evidence that
was queued during the outage.

Remaining defects: Batch 7 (Copy/polish -- D4, D11) [IN PROGRESS / STATUS AT TIME OF WRITE].
```

## Outage confirmation

Every one of the following calls failed during the outage window (2026-07-24, ~13:50-14:03 UTC),
either with an immediate Cloudflare 502 from `mcp-proxy.anthropic.com`, or as a backgrounded task
that timed out after 300s with no response:

- `trelloReadCard` (D13, D16, and a template-lookup read) — 502 / timeout
- `trelloWriteCard` update calls for D13, D14, D15, D16, D17, D18, D19 — 502 / 300s timeout
- `trelloSearch` for "REPAIR PHASE READY" and "Completed Passed" — connection lost

**No card's description or list was modified.** No partial/duplicate content was written to any
card. This file is the complete, exact record of what remains to be applied once the Trello MCP
integration is confirmed healthy again.

## Retry instruction

Per owner instruction: do not retry Trello repeatedly during the outage. Retry once, as a single
batch, after Batch 7 reaches its checkpoint.

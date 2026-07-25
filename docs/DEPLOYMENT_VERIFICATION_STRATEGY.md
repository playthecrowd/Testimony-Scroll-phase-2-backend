# Deployment Verification Strategy

**Status: standard operating procedure for all pushes to `Production`, effective the Repair
Phase Batch 6 deployment (commit `b1262e0`).**

## Origin

During Batch 6 (Accessibility) of the QA repair phase, a chunk-fingerprint poll that tracked only
`.js` filenames ran for 30 minutes without detecting any change, even though the deployment had
in fact already landed -- the commit's only material asset change was a re-hashed `.css` chunk
(`--accent-blue`'s new value), which the JS-only poll was blind to. A fresh, cache-busted,
behavior-based check (grepping the live HTML/CSS for the actual DOM markers and CSS values the
commit introduced) immediately confirmed the deploy was live. This document generalizes that
successful recovery into the standard verification procedure, so future sessions check real
behavior first instead of drawing conclusions from one incomplete fingerprint signal.

## Standard deployment verification

After pushing to `Production`:

### 1. Initial automatic monitoring

- Allow AWS Amplify's automatic deployment to run.
- Poll the deployed QA site (`production.quest4thekingdom.com`) at a reasonable interval.
- Do not immediately ask the owner to inspect AWS.

### 2. Verify actual feature behavior

- Do not rely exclusively on one JS chunk fingerprint -- Next.js may re-hash only a `.css` chunk,
  only a subset of `.js` chunks, or (for server/migration-only changes) no client asset at all.
- Identify the exact routes/components changed by the commit.
- Request those routes using unique cache-busting query strings (e.g. `?verify=<short-sha>`).
- Verify the specific DOM, accessibility, functional, or visual markers introduced by the commit
  (an `id`/`aria-label` attribute, a heading tag, a `tabindex`, a CSS custom-property value, etc.)
  -- not just "the page returned 200."
- Inspect response headers, HTML, route-specific assets (including CSS chunk URLs, not only JS),
  console, and network results where relevant.

### 3. Second verification pass

- If the first check still appears old, wait approximately five minutes.
- Run one additional fresh behavior-based verification pass.
- Compare the expected code changes against the deployed DOM/behavior, not just against the
  previous poll's asset list.

### 4. Escalate to the owner only after both automated passes fail

Ask the owner to inspect AWS only when:

- The build is still not observable after both verification passes, or
- A definite deployment/build failure is detected, or
- The site remains on the old behavior beyond the agreed timeout, or
- AWS configuration, build logs, or manual redeployment are required.

### 5. Never assume

- An unchanged unrelated chunk means deployment failed.
- A successful `git push` means deployment succeeded.
- A 200 response means the new commit is live.
- A cache-busting query always bypasses every cache layer.

### 6. Required evidence before live retesting

- The expected changed behavior is present.
- Relevant routes load successfully.
- No new serious console/network errors appear.
- The deployed environment still has required configuration.
- Any required migration is confirmed applied.

### 7. Safety

- Do not push again merely to retrigger deployment.
- Do not change AWS or invalidate CloudFront without approval.
- Do not begin live defect retesting against an unconfirmed build.
- Stop after the defined retry window instead of polling indefinitely.

## Default escalation order

1. Fresh behavior/DOM verification
2. Cache-busted route verification
3. Five-minute wait
4. Second verification pass
5. Only then request owner AWS inspection

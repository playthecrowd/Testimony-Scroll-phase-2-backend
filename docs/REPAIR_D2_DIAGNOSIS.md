# D2 Diagnosis — /login and /signup do not redirect signed-in visitors on AWS

Trello: https://trello.com/c/mCY4Thmo/42

**Status: diagnosis only. No code, config, or infrastructure changed. No instrumentation deployed.**

## What was checked (all non-mutating)

1. Read `proxy.ts` in full (route matching, `getClaims()`/`isAuthed` logic, `PROTECTED_PATHS`/
   `AUTH_PATHS`).
2. Read `lib/supabase/server.ts` and `lib/supabase/client.ts` (cookie plumbing for the SSR client).
3. Searched the repo for any AWS deployment manifest (Dockerfile, Amplify/App Runner/ECS config) —
   none exists in-repo; `docs/QA_ISOLATED_PROJECT_SETUP.md` documents environment-variable scoping
   in terms of **Vercel** Preview/Production environments, meaning the project's normal deployment
   path is Vercel, and `production.quest4thekingdom.com` on AWS is a separate, non-standard
   deployment target for this branch specifically — consistent with `proxy.ts`'s own comment
   ("this milestone... assumes Vercel's native runtime").
4. No AWS CLI/console access is available in this environment (`aws` command not found) — AWS
   configuration itself could not be inspected directly.
5. Sent plain, unauthenticated `curl -I` requests (no cookies, no secrets, read-only GET) to 4
   routes on the live production domain, and compared against this repo's local production build
   output (`npm run build`'s static/dynamic route markers).

## Finding

| Route | Local build | Live response |
|---|---|---|
| `/login` | `○` Static (prerendered) | `200`, `x-nextjs-cache: HIT`, `Cache-Control: s-maxage=31536000` (1 year), served via CloudFront |
| `/signup` | `○` Static (prerendered) | Same as `/login` |
| `/dashboard` | `ƒ` Dynamic | `200`, `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate` — correctly uncached |
| `/experience-builder` (signed-out) | `ƒ` Dynamic | `307` → `/login` — **`proxy.ts`'s redirect fires correctly here** |

This directly rules out "`proxy.ts` never executes on this AWS deployment at all" — the
`PROTECTED_PATHS` redirect for `/experience-builder` demonstrably works live, right now, so
`proxy.ts` does run and `getClaims()` is capable of returning real claims in at least the
signed-out case.

The more precise, better-supported hypothesis: `/login` and `/signup` are **statically prerendered
pages** (confirmed both locally and by the live `x-nextjs-cache`/`s-maxage=31536000` headers), and
this AWS deployment's request pipeline appears to serve static/prerendered HTML through a path that
either (a) skips or short-circuits before `proxy.ts`'s `AUTH_PATHS` check for those specific
responses, or (b) caches the pre-redirect response at a layer `proxy.ts` doesn't get a chance to
re-run against on cache hits. This is a known category of limitation with several non-Vercel
Next.js-on-AWS hosting adapters (e.g., OpenNext/SST-style deployments, or AWS Amplify Hosting's
compute layer): static/ISR pages are often served via a distinct asset/cache path from the one that
invokes the middleware/server runtime, whereas fully dynamic routes (`force-dynamic`, no
prerendering) always go through the server runtime where middleware executes on every request —
exactly matching the working `/experience-builder` redirect vs. the non-working `/login` redirect.

This reframes D2 from "cookie-forwarding gap" (the QA-time hypothesis) to "static-page caching
bypasses the AUTH_PATHS middleware check" — a meaningfully different and more actionable diagnosis.

## What this doesn't yet establish

- Which specific AWS service/adapter serves this deployment (no AWS access available to confirm).
- Whether the fix belongs in application code (e.g., force `/login`/`/signup` to
  `export const dynamic = "force-dynamic"` so they're never prerendered/cached and always hit the
  server runtime where `proxy.ts` runs) or requires an AWS-side cache/routing configuration change.
  The code-only option (marking these two pages dynamic) is the lower-risk, more likely candidate
  and would not require any AWS/infrastructure change — but this still needs a live retest to
  confirm before treating it as the fix, since the exact AWS request-routing behavior couldn't be
  directly observed.

## Recommended next action

Not implementing further without approval. Recommend: as part of Batch 1 (or a fast-follow), test
adding `export const dynamic = "force-dynamic"` to `app/login/page.tsx`/`app/signup/page.tsx` (a
plain code change, no AWS/env config involved) and retest live whether the `AUTH_PATHS` redirect
then fires correctly. If it does, this closes D2 with a code-only fix. If it still doesn't
redirect, that would isolate the problem to the AWS request-routing/middleware-execution layer
itself, which would then need AWS-side investigation (deployment/config change, requiring separate
approval per the operating rules) rather than a code fix.

No temporary production logging or diagnostic instrumentation was added or deployed, per
instruction to stop and propose before doing so. If that becomes necessary, the proposal will be:
a single `console.log` in `proxy.ts` immediately after the `getClaims()` call, logging only
`{ pathname, isAuthed, hasClaimsError: !!error }` (no cookie values, no tokens, no PII) for requests
matching `AUTH_PATHS`, removed in the very next commit after the retest confirms or rules out the
hypothesis.

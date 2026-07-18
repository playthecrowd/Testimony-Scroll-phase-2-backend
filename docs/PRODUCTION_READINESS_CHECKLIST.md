# Production Readiness Checklist

Status snapshot as of Phase 9.5 (2026-07-18). This is a **status record only** — nothing on this
list was configured, provisioned, or changed as part of producing it. Items marked "Unknown /
needs manual verification" require checking the live Supabase/Vercel dashboards directly; they
cannot be confirmed from the repo alone.

| Area | Status | Notes |
|---|---|---|
| **Environment variables** | ⚠️ Not configured in this dev environment | `.env.example` lists `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`. No `.env.local` exists here (confirmed absent). Whether these are set correctly in Vercel's project settings is unverified from this session — Vercel env management wasn't touched. |
| **Supabase migrations** | ✅ 21 migrations present locally (`0001`–`0021`) | Whether all 21 have actually been applied to the live Supabase project is **unverified** — no live DB connection in this environment. Confirm via `supabase migration list` or the dashboard's migration history before go-live. |
| **RLS verification** | ✅ Static analysis only | `tests/rlsChurchIsolation.test.ts` — 79 tests, statically parses every migration's policy text (no `using(true)` leaks, correct `private.is_church_manager`/`is_platform_admin` reuse, business-rule invariants). This is **not** a live-database read/write test with real users. A manual "sign in as Host A, confirm Host B's data is invisible" pass against the live project has not been run in this environment. |
| **Authentication redirect URLs** | ❓ Unknown / needs manual verification | Supabase Auth's "Redirect URLs" allowlist (Studio → Authentication → URL Configuration) must include the production domain's `/auth/confirm` and `/auth/error` paths. Not checked this session — no dashboard access. |
| **Branded authentication emails** | ❌ Not implemented | Confirmed in Phase 1's audit and unchanged since: auth emails (confirmation, magic link, password reset) use Supabase's stock templates, not app-branded ones. |
| **Storage policies** | ✅ Two buckets have RLS-backed migrations | `0005_lesson_thumbnails.sql` and `0016_lesson_documents_storage.sql` define `storage.objects` policies for lesson thumbnails and documents. Whether the buckets themselves exist with matching names/settings in the live project is **unverified**. |
| **Error logging** | ❌ Console-only | All server-side errors are `console.error(...)`'d (visible in Vercel Runtime Logs) with a generic user-facing message. No structured error tracking (Sentry or equivalent) is wired up anywhere in the repo. |
| **Analytics** | ❌ None found | No analytics SDK, tag, or pageview tracking exists in the codebase. |
| **Backups** | ❓ Unknown / needs manual verification | Supabase project-level backup configuration (PITR, daily backups) is a dashboard/plan setting, not something this repo controls. Not checked this session. |
| **Custom domain** | ❌ Not configured | Confirmed via the Vercel MCP connection this session: the project's only domains are `*.vercel.app` aliases (`testimony-scroll-phase-2-backend-qx.vercel.app` and two `-git-main-`/project-slug variants). No custom domain attached. |
| **Admin accounts** | ⚠️ Needs at least one real admin before go-live | `profiles.is_platform_admin` has no self-service path to become `true` (blocked by trigger, by design — confirmed Phase 1). At least one real user must be manually flagged `is_platform_admin = true` directly in the database before any `/admin/*` page is usable in production. |
| **Seed content** | ⚠️ Demo/seed only | `scripts/seed.ts` populates demo churches/lessons/speakers/etc. for local development. Whether real production churches/lessons/content exist in the live project is outside this repo's knowledge. |
| **Manual QA** | ⚠️ Partial (see `docs/PHASE9_5_STABILIZATION.md` §10) | Code-reviewed and route-level (HTTP 200) verified this phase. No browser-automation tool was available, and no live Supabase credentials exist in this environment, so interactive click-through QA and real-Supabase-flow QA are still outstanding. |
| **Deployment approval** | ⏸️ Not requested / not given this phase | Phase 9.5's instructions explicitly say not to deploy. No deploy was performed or requested. |
| **Merge-to-main approval** | ⏸️ Not requested / not given this phase | Per project convention, `main` is the approved live release branch; nothing was merged into it, and no merge was requested this phase. |

## How to keep this current

Re-run this checklist's Supabase/Vercel-dependent rows (migrations, RLS, redirect URLs, storage
buckets, backups, custom domain) whenever a live Supabase project or Vercel dashboard becomes
accessible from a session, since they can't be confirmed from the repo alone. Everything else
(admin accounts, seed content, error logging, analytics, branded emails) should be re-checked
whenever those specific features are built or the go-live date approaches.

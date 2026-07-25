# Kingdom Economy & Progression — Production Release Checklist

Companion to `docs/PHASE11_5_AUDIT.md`. Do not mark an item complete unless it has actually been
verified — several items below require information or access this development sandbox does not
have, and are marked accordingly rather than assumed.

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | Branch state | ✅ Verified | `Production`, clean working tree, all Phase 11.1–11.5 commits present (`d69c928`, `de71257`, `f13ec98`, `2ad7228`, `0a0960a`, and this phase's commit). |
| 2 | Migration state | ✅ Verified, all live | `0001`–`0035` all live and matching local/remote. `0034` (trigger rename) and `0035` (reconciliation diagnostic) were pushed on explicit owner authorization and re-verified live (`docs/PHASE11_5_AUDIT.md` §18). `npx supabase db push --dry-run` reports "Remote database is up to date." |
| 3 | Database backup recommendation | ⚠️ Owner action required (standing) | `0034`/`0035` have already been pushed (low-risk: a trigger rename, a new read-only function — no data was altered). This remains a standing recommendation for *any future* production database change, not an outstanding action for these two. |
| 4 | Supabase verification | ✅ Verified | All 10 economy/progression tables, both leaderboard views, all 16 public RPCs + 5 private helpers (including the new `diagnose_wallet_balance_drift`), all 7 triggers (each under its correct, non-truncated name), RLS on all 10 tables, correct grants — all confirmed live post-push (`docs/PHASE11_5_AUDIT.md` §18). |
| 5 | Environment variables | ⚠️ Not verifiable in this sandbox | This sandbox has no `.env.local`. Before release, confirm the production environment (Vercel) has the correct `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` pointing at the linked project (`ytnftubajizhuylhmsib`), and that no service-role key is exposed to any client-reachable environment variable (`NEXT_PUBLIC_*`). |
| 6 | Vercel configuration | ⚠️ Owner action required | This phase made no Vercel changes and has no access to verify Vercel project settings. Confirm the production deployment target still points at `main` (not `Production`) per this project's standing branch convention, and that no preview-only environment variable is accidentally required for the economy/progression routes. |
| 7 | Smoke-test accounts | ⚠️ Owner action required | No real or disposable test accounts exist in this sandbox. Before release, prepare at least: one brand-new member (zero-state), one existing member with real Lesson/Experience/testimony history, one church host, and one platform admin, to exercise the workflows in `docs/PHASE11_5_AUDIT.md` §12. |
| 8 | Wallet checks | ✅ Verified (code/DB level) | Lazy creation, balance reads, history — all RPC-backed and re-verified this phase. Live functional click-through requires item 7's accounts. |
| 9 | Credit request checks | ✅ Verified (code/DB level) | Full state machine re-audited (`docs/PHASE11_5_AUDIT.md` §4) — no unsafe transition found. Live click-through requires item 7. |
| 10 | Registration charge checks | ✅ Verified (code/DB level) | Charging trigger re-audited (§5) — waitlist-safe, idempotent, atomic. Live click-through requires item 7. |
| 11 | Refund checks | ✅ Verified (code/DB level) | Member-cutoff and church-cancellation refund paths re-audited (§5) — idempotent, ledger-backed. Live click-through requires item 7. |
| 12 | Lesson reward checks | ✅ Verified (code/DB level) | `lesson_studied` trigger + real completion feedback re-audited (§6, §12 of the Phase 11.4 audit). Live click-through requires item 7. |
| 13 | Badge checks | ✅ Verified (code/DB level) | All 5 v1 badges confirmed active and correctly seeded (§7); duplicate-award-proof. Live click-through requires item 7. |
| 14 | Leaderboard checks | ✅ Verified (code/DB level) | Points-only ranking, privacy opt-out, church scoping all re-audited (§8). Live click-through requires item 7. |
| 15 | Privacy checks | ✅ Verified | No email/wallet/credit field ever exposed on a leaderboard or badge surface (§8, §9); `leaderboard_opt_out` enforced inside the view itself, not application code. |
| 16 | Rollback considerations | ✅ Documented | Every Phase 11 migration (`0027`–`0035`) is purely additive (new tables/views/functions/triggers, or a rename) — none alters an existing table's data or drops anything. A rollback of any single migration is a straightforward reverse-order `drop`/re-rename, since no other migration's data depends on these existing. No migration in this system has ever required a data migration/backfill that would complicate a rollback. |
| 17 | Owner acceptance testing | ⚠️ Not started | Requires the owner (or a delegated tester) to actually use the real dashboard/badges/leaderboard/credit-request/Experience-registration flows against a real or staging environment with real accounts. Not possible from this sandbox. |
| 18 | Deployment approval gate | ⚠️ Awaiting explicit approval (app deployment only) | Migrations `0034`/`0035` were explicitly authorized and pushed. Per standing project convention, application deployment (merge to `main`, Vercel release) still requires the owner's own separate, explicit go-ahead — this checklist does not constitute that approval. |

## Summary

Everything within this sandbox's ability to verify (code correctness, live database schema/RLS/
RPC/trigger state, financial and progression invariants, security posture) has been checked and
passes. All 35 migrations, including the two corrective ones from this final verification pass, are
now live and confirmed synchronized, with a live reconciliation check finding zero wallet drift.
The items marked ⚠️ above are not gaps in this phase's work — they are the specific, honestly-named
set of things that can only be verified by the owner, in an environment this sandbox does not have
access to (a real Vercel project, real Supabase environment variables, real test accounts, a real
browser session), plus the standing requirement that application deployment itself always needs
its own separate approval. Release readiness from this phase's own scope is **conditional on those
owner-side items**, not blocked by any known code or database defect.

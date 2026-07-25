# Phase 10 Final Release Checklist — Experience Platform

Do not mark an item complete unless it has actually been verified (against real code, a real live
database query, or a real command's output) this phase or a prior one. See
`docs/PHASE10_4_AUDIT.md` for the detailed evidence behind each row below.

| # | Item | Status | Evidence |
|---|---|---|---|
| 1 | `Production` branch, clean working tree, required commits present | ✅ Verified | `git status`/`git log` this phase (section 1) |
| 2 | `npm run lint` — 0 errors | ✅ Verified | Re-run after all Phase 10.4 fixes (section 14) |
| 3 | `npx tsc --noEmit` — clean | ✅ Verified | Re-run after all Phase 10.4 fixes (section 14) |
| 4 | `npm test` — all passing | ✅ Verified | 137/137 (section 13) |
| 5 | `npm run build` — succeeds, all Experience routes present | ✅ Verified | Section 1, section 14 |
| 6 | Local migrations `0001`–`0026` match the linked remote project exactly | ✅ Verified | `supabase migration list`, section 2 |
| 7 | Migration `0018`'s CASE-syntax fix is committed and remains in place | ✅ Verified | Commit `d4ad6dd`; migration content unchanged since, per immutability rule |
| 8 | All Experience RPCs are `SECURITY DEFINER` with `search_path` locked, on the live database | ✅ Verified | Direct `pg_proc` query, section 2 |
| 9 | `church_experience_registrations` has no INSERT/DELETE RLS policy (RPC-only writes) | ✅ Verified | Direct `pg_policies` query, section 2; structural test in `rlsChurchIsolation.test.ts` |
| 10 | Ownership-reassignment protection (`church_id`/`created_by`) is active on the live database | ✅ Verified | `protect_church_experience_ownership` confirmed via `pg_proc`, trigger confirmed attached |
| 11 | Journey integration (`experienced` → `applied`) fires only for `required` links, only once | ✅ Verified | Trigger body inspected live + structural test asserting the exact guard conditions |
| 12 | Security review: forged-id and bypass vectors attempted, none exploitable | ✅ Verified | Section 5 — 8 vectors reasoned through against actual code/live grants |
| 13 | Performance review: no unaddressed N+1 pattern in Experience code paths | ✅ Verified | One found and fixed this phase (section 6), regression-tested; no other found |
| 14 | Manual QA checklist produced, honestly distinguishing tested vs. reviewed-only vs. blocked | ✅ Verified | Section 4 — full browser click-through blocked by missing `.env.local` in this sandbox, explicitly noted rather than claimed |

**Not yet possible in this environment:** a true end-to-end click-through as a real signed-in user
(rows 1, 2, 3, 4, 6, 7, 8, 9, 11, 12, 13, 14, 15 of the manual QA table in
`docs/PHASE10_4_AUDIT.md` section 4) requires either `.env.local` populated in this sandbox or a
deployed Vercel Preview URL with real auth. This is a pre-existing environment limitation
documented since Phase 1, not something Phase 10.4 could resolve, and is not silently marked done
above.

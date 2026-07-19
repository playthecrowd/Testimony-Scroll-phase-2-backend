# Page & Verification Matrix

Legend: **REAL** = queries Supabase with RLS today. **MOCK** = `data/*.ts` + `localStorage`
only, no Supabase table exists. **PHASE1** = touched by the Phase 1 change described in
`docs/PHASE1_AUDIT.md`.

| Product page | Actual route | Real/Mock | Roles | DB tables | RLS impact | Mobile | Regression risk | Phase 1? |
|---|---|---|---|---|---|---|---|---|
| Sign In | `/login` | REAL (auth) | Public | `auth.users`, `profiles` | none | Existing `AuthScreen` responsive; light branding pass | Low | Light touch |
| Create Account | `/signup` | REAL (auth) | Public | `auth.users`, `profiles`, `church_memberships` | none | same | Low | Light touch |
| Church Setup | `/onboarding/church` | REAL | Host (no church yet) | `churches`, `church_memberships` via `create_church_with_host` RPC | none | Not touched | Low | No |
| Member Dashboard | `/dashboard` | MOCK | Member | none (mock only) | none | CTA/empty-state copy only | Med (large mock page) | Naming/CTA only |
| Host Dashboard | `/host-dashboard` | **MOCK → REAL (this phase)** | Host/Admin | `churches`, `church_memberships`, `lessons` (real); testimonies stay mock/"coming soon" | Read-only queries, all already RLS-scoped via `is_church_manager` | New empty-state components need mobile check | **High — core Phase 1 change** | **Yes, primary** |
| Church Members | *(does not exist yet)* | — | Host | `church_memberships` | Phase 2 | — | — | No (link stubbed "coming soon") |
| Church Profile | `/churches/[churchId]` | REAL | Public/Host | `churches` | none | Not touched | Low | No |
| User/Profile Settings | `/profile` | REAL (partial) | Member/Host | `profiles` | none | Not touched | Low | No |
| Build Lesson | `/experience-builder` | REAL | Host/Admin | `lessons`, `lesson_media`, `lesson_hosts`, `speakers`, `ministries` | none (already correct) | Not touched | Must not regress (CLAUDE.md-protected) | No, verify only |
| Host Lessons (list) | inline in `/experience-builder` via `HostLessonManagementList` | REAL | Host/Admin | `lessons` (church-scoped) | none | Feed into host-dashboard "recent lessons" card | Reused, not modified | Consumed by Phase 1 |
| Main Lessons | `/lessons` | REAL | Public | `lessons`, `churches` | none | Not touched | Low | No |
| Lesson Detail/Study | `/lessons/[lessonId]` (slug) | REAL (+ mock Questions tab) | Public/Member | `lessons`, `lesson_media`, `lesson_hosts` | none | Not touched | Must not regress (CLAUDE.md-protected) | No, verify only |
| Journey (Studied) | `/journey/[lessonId]/studied` | REAL | Member | `lesson_journeys`, `lesson_journey_items` | none | Not touched | **Must not regress — explicitly protected by repo CLAUDE.md** | No, verify only |
| Journey (other stages) | `/journey/[lessonId]/{captured,experienced,applied,added-to-story}` | MOCK, falls back to `StageComingSoon` for real lessons | Member | none | none | Not touched | Low (already degrades safely) | No |
| Experience Selection | *(no experiences/catalog table exists)* | — | Member | none | Phase 3/4 | — | — | No |
| Credits | *(no schema exists)* | — | Member | none | Phase 4 | — | — | No |
| Leaderboard | `/leaderboard` | MOCK | Member | none | none | Not touched | Low | No |
| Lesson Requests | *(does not exist)* | — | Member | none | Phase 5 | — | — | No |
| Kingdom Scroll | `/kingdom-scroll` | MOCK | Public/Member | none | none | Not touched | Low | Link-to-lesson verified, not rebuilt |
| Testimony Submission | `/journey/[lessonId]/applied` (reached via `/contribute`) | MOCK | Member | none | Phase 6 | Not touched | Low | No |
| Testimony Review | inline card on `/host-dashboard` ("Dev: Approve Testimony") | MOCK | Host | none | Phase 6 | Kept as explicitly-labeled dev stub | Low — untouched internals | Card relabeled "coming soon" stat only |
| Characters | `/characters`, `/characters/[characterId]` | MOCK | Public | none | Phase 7 | Not touched | Low | No |
| Character Detail | `/characters/[characterId]` | MOCK | Public | none | Phase 7 | Not touched | Low | No |
| Full Story | `/story` | MOCK (Book/Timeline render identically) | Public | none | Phase 7 | Not touched | Low | No |
| Episodes | `/episodes`, `/episodes/[episodeId]` | MOCK | Public | none | Phase 7 | Not touched | Low | No |
| Events | `/events` | MOCK, one hardcoded event | Public | none | Phase 8 | Not touched | Low | No |
| Host an Event | *(does not exist)* | — | Host | none | Phase 8 | — | — | No |
| Production Admin | *(does not exist)* | — | Admin | `profiles.is_platform_admin` exists, no UI | Phase 9 | — | — | No |

## Notes on items marked "No" for Phase 1

These are correctly out of scope per the prompt's own phased rollout (Part 22) — building any
of them now would violate rule #13 ("Do not implement the entire roadmap in one uncontrolled
change") and several have no backing schema at all yet, so building real functionality would
require inventing new tables/migrations without a settled product decision (rule #12).

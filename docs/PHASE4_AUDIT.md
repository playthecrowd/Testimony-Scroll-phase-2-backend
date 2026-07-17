# Phase 4 Audit — Member Study Experience & Journey Continuation

Date: 2026-07-17. Read-only audit, no code changed. Re-read `docs/REQUIRED_FEATURES.md` and
`docs/REGRESSION_CHECKLIST.md` first per this repo's CLAUDE.md (journey code is explicitly
protected). Covers `app/journey/[lessonId]/**`, `StudiedClient.tsx`, `lib/journeyChecklist.ts`,
and the `lesson_journeys`/`lesson_journey_items` schema.

## Current state — Studied stage (already real, better than expected)

`/journey/[lessonId]/studied` is genuinely solid and Supabase-backed:

- Persistent checklist (`lesson_journeys`/`lesson_journey_items`, 0008), content-driven via
  `lib/journeyChecklist.ts` (never a media-row id or title — survives Host edits).
- Real tabs (Overview/Notes/Video/Audio/Slides/Documents/Questions), a live progress bar,
  "Mark Study Complete" gated on 100% checklist completion with confirmation, "Save and Exit"
  (touches `last_opened_at`, doesn't complete the stage).
- Every regression-checklist item for Studied (`docs/REGRESSION_CHECKLIST.md`) currently holds.

**Gaps against Part 11 of the prompt:**

1. **Video tab doesn't embed** — it's a plain "Open" link (`MediaLink` component) that sends the
   member away from the study flow. `LessonDetailClient.tsx` already solved this
   (`getYouTubeEmbedUrl`, iframe embed) — not reused here.
2. **No persistent scripture panel** — primary/supporting scripture only appears inside the
   Overview tab, not visible alongside other tabs' content on desktop, and there's no mobile
   drawer/bottom-sheet equivalent.
3. **Questions tab is still the mock catalog** (`data/questions.ts`'s `getStudyQuestionsForLesson`)
   — flagged in this exact file's own comment as a known placeholder ("PHASE 9 audit finding" in
   this repo's own historical numbering, not this audit's Phase numbering). Phase 3 built real,
   per-lesson `lesson_questions` specifically so this could be wired up — not done yet.
4. **No per-question response/acknowledgement** — the "Complete reflection questions" checklist
   item is a single manual toggle covering all questions collectively; there's no acknowledgement
   or response captured per question, and nothing here is completion-gated question-by-question.
5. **`LessonDetailClient.tsx`'s "Your Host Selection" card still has the unexplained "Change"
   link** (Part 11 explicitly asks to remove it) — confirmed still present since the Phase 1
   audit first flagged it; this file hasn't been touched since.

All five are achievable now, using only what already exists (`lesson_questions` from Phase 3,
`lesson_journey_items`, the embed helper already written for the public lesson page) — no new
schema required.

## Current state — Experienced / Applied / Added-to-Story / Captured (still fully mock)

Confirmed unchanged since the Phase 1 audit: `app/journey/[lessonId]/{experienced,applied,
added-to-story,captured}/page.tsx` all call `getLesson()` against the **mock** lesson catalog
(`services/lessonService.ts`/`data/lessons.ts`), and show `StageComingSoon` for any real
(Supabase, UUID) lesson id — which is every lesson actually built through Experience Builder.

- `experienced/page.tsx`: a "Simulate Quest Completion" dev button, a fake score/leaderboard
  system (`services/questService.ts`, mock), a completely separate "Quest Experience Badge" —
  none of this reads real data.
- `applied/page.tsx`: the testimony submission wizard — mock `services/testimonyService.ts`, no
  real table (confirmed in Phase 1 audit; unchanged).

**This is where Part 12 ("Experience Selection, Credits, Scheduling") would need to live**, and it
requires inventing schema that doesn't exist anywhere in this project today:

- No `credits` concept at all (no balance/ledger/request table, no column on `profiles` or
  `church_memberships`).
- No `points` concept separate from credits (the only quantitative reward is `lessons.xp_reward`,
  a static per-lesson number never accumulated per member).
- No scheduling model (on-demand vs. specific date/time vs. time-slots vs. speaker-led) anywhere.
- The "Experience Connection" data Phase 3 just built (`lesson_experiences` → `experiences`) is
  the right foundation for "show all eligible connected experiences after completing a lesson"
  (Part 12 requirement #1-3), but nothing consumes it yet outside the read-only display added to
  the public lesson page.

Building all of Part 12 for real is a comparable amount of new-schema work to an entire prior
phase (Phase 2 or 3), not a small extension of the Studied-stage polish above.

## Recommendation

Split this pass in two, matching how Part 11 and Part 12 are two distinct sections of the original
prompt:

- **Now (Phase 4a): Member Study Experience polish.** Items 1-5 above. No new migration needed —
  purely UI/data-wiring using tables that already exist.
- **Separately (Phase 4b, needs a scope decision before starting): Experience Selection, Credits,
  Scheduling.** Requires designing and confirming a real credits/points/scheduling schema first —
  same category of decision as Phase 3's experiences-catalog question. Recommend treating this as
  its own follow-up rather than folding it into the same pass as 4a.

Confirmed with the user: proceed with Phase 4a now; Phase 4b is its own future phase (tracked in
memory alongside the deferred AI-extraction phase).

---

## Phase 4a implementation summary

- **Video embed**: extracted `getYouTubeEmbedUrl` out of `LessonDetailClient.tsx` into
  `lib/videoEmbed.ts` (with a unit test, `tests/videoEmbed.test.ts`) so `StudiedClient.tsx` could
  reuse the exact same logic. The Studied Video tab now embeds a YouTube video inline instead of
  linking away; non-YouTube URLs still fall back to a plain link.
- **Persistent scripture panel**: a new `ScripturePanel` component (local to `StudiedClient.tsx`)
  renders primary + supporting scripture. Shown as an always-expanded card in the desktop aside
  (`hidden lg:block`, visible regardless of active tab) and as a collapsible accordion positioned
  above the tab content on mobile (`lg:hidden`), following the same `hidden lg:flex`/`lg:hidden`
  responsive split `AuthScreen.tsx` already uses elsewhere in this codebase. The duplicate
  "Supporting Scriptures" block that used to live inside the Overview tab was removed to avoid
  showing the same content twice.
- **Real questions + per-question acknowledgement**: the Questions tab now reads `lesson.questions`
  (real, Phase 3) instead of `data/questions.ts`'s mock fallback bank. Each question renders its own
  checkbox (local UI state); checking every question calls the existing
  `setChecklistItemCompletion` to mark the single persisted "questions" checklist item complete
  (explicit target boolean, not a blind toggle), unchecking any un-marks it. No new schema —
  `lesson_questions` rows are recreated wholesale on every Host edit (Phase 3's `replaceLessonQuestions`
  is delete-then-insert), so there's no stable per-question id to hang *durable* per-question
  progress off of; the sidebar's "Complete reflection questions" checklist row becomes a read-only
  status (not a manual toggle) once real questions exist, so the two can never drift out of sync.
  When a lesson has zero questions, the row stays exactly as it always was — a plain manual toggle.
- **Removed the "Change" link** in `LessonDetailClient.tsx`'s "Your Host Selection" card — it only
  switched tabs and had no persisted meaning; no valid business reason was found for keeping it.

## Manual QA checklist

1. Open Studied for a lesson with a YouTube video link — confirm it plays inline, not a link-out.
2. Open Studied for a lesson with a non-YouTube video URL — confirm it still shows the "Watch
   Video" link fallback (not a broken embed).
3. Confirm the Scripture panel is visible on desktop regardless of which tab is active, and that on
   a narrow/mobile width it appears as a collapsed accordion above the tab bar that expands on tap.
4. Open Studied for a lesson with 2-3 real questions (added via Build Experience). Check each one
   off in the Questions tab; confirm the "Complete reflection questions" row in the sidebar flips to
   complete only once every question is checked, and that unchecking one flips it back.
5. Reload the page after checking all questions and marking them complete — confirm the Questions
   tab re-shows all checkboxes as checked (not reset), matching the persisted state.
6. Confirm "Mark Study Complete" still requires every checklist item complete, including questions,
   exactly as before.
7. Open a lesson with zero questions — confirm the Questions tab shows "No questions were provided"
   and the sidebar's "Complete reflection questions" row is still a normal manual toggle.
8. Open `/lessons/[slug]` for any lesson — confirm the "Your Host Selection" card no longer shows a
   "Change" link, and the Hosts tab itself still works.

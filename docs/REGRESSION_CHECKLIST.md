# Regression Checklist

Manual/automated checks to run before shipping a change that touches lessons, churches, or
authorization. See `tests/` for the automated subset (`npm test`).

## Lesson editing

- [ ] Hosts can edit lessons they manage.
- [ ] Editing updates the existing lesson and never creates a duplicate.
- [ ] Draft and published status is preserved unless the Host explicitly changes it.
- [ ] Unauthorized users (Kingdom Member, anonymous, Host of another church) cannot access or
      submit the editing form.
- [ ] Existing thumbnail and media remain intact when no replacement is submitted.
- [ ] Authorized Host can open `/experience-builder/[lessonId]/edit`.
- [ ] A Host from another church is denied.
- [ ] A Kingdom Member is denied.
- [ ] An anonymous visitor is redirected to `/login`.
- [ ] Existing lesson values (all fields, speaker, media, thumbnail) prefill the edit form.
- [ ] Save Draft keeps a draft lesson a draft.
- [ ] Save Changes keeps a published lesson published.
- [ ] Publish moves a draft lesson to published only after required-field validation passes.
- [ ] Unpublish moves a published lesson to draft, after confirmation.
- [ ] A failed thumbnail replacement preserves the original thumbnail.
- [ ] Media items can be added, edited, reordered, and removed without affecting other lessons'
      media.
- [ ] Public `/lessons`, `/lessons/[slug]`, `/churches`, and `/churches/[slug]` reflect an edit to
      a published lesson without a redeploy.

## Preserved-functionality baseline (do not regress)

- [ ] Host church onboarding (`/onboarding/church`) still works end to end.
- [ ] "Build Experience" / "Experience Builder" terminology has not reverted to "Capture".
- [ ] Authenticated profile name/avatar/email still come from the real `profiles` table, not mock
      data.
- [ ] `/churches` shows published churches, an empty state, or a friendly error -- never a crash.
- [ ] `/lessons` shows published lessons, an empty state, or a friendly error -- never a crash.
- [ ] Lesson thumbnails render consistently (fallback, loading, broken-image handling) everywhere
      `LessonThumbnail` is used.
- [ ] Media links only ever accept `http:`/`https:` -- `javascript:`, `data:`, and `file:` are
      rejected.
- [ ] RLS is never bypassed and the service-role key is never used from the browser.

## Member journey (Studied stage and beyond)

- [ ] The original full Studied experience remains available (content tabs, checklist, visible
      progress, stage stepper, Mark Study Complete, Save and Exit) -- not a stripped-down page.
- [ ] Studied includes persistent checklist progress (Supabase-backed, not `localStorage`).
- [ ] Start Your Journey creates or retrieves one persistent journey record; repeated visits never
      duplicate it.
- [ ] Continue Your Journey returns to the member's existing progress, at the same URL as Start.
- [ ] One journey record exists per `(member, lesson)`; one member cannot read or write another
      member's progress.
- [ ] The shared Studied route works for every published lesson, including a brand-new one
      created through Build Experience with no code change.
- [ ] No `/journey/` link ever points at a missing route.
- [ ] Missing future stages (Experienced/Applied/Added-to-Story/Captured) show a branded
      coming-soon state, not a 404.
- [ ] Save and Exit preserves progress and `last_opened_at` without completing Studied.
- [ ] Mark Study Complete advances `current_stage` only to `experienced`, never further, and
      requires confirmation.
- [ ] Build Experience remains Host-only in both desktop and mobile navigation (same source of
      truth, `lib/navigation.ts`) and the route stays server-protected regardless of nav
      visibility.
- [ ] Existing lesson editing, Churches, Lessons, onboarding, thumbnails, and profiles do not
      regress.

## Study questions (multiple choice, member-facing)

- [ ] Questions never appear on a lesson card, preview, the public lesson detail page, or a
      pre-lesson modal -- only inside the Study flow's Questions tab.
- [ ] Selecting an answer without submitting never marks a question (or the aggregate item)
      complete; opening the tab never does either.
- [ ] An incorrect answer gives clear feedback and allows retry without penalty or lockout.
- [ ] A correct answer marks that question complete; the aggregate `questions` checklist item
      completes only once every question in the lesson is correct.
- [ ] `is_correct` is not present in the page source/RSC payload of the public lesson page or the
      Study page, and a direct REST read of `lesson_question_choices.is_correct` is denied.
- [ ] Host/admin editing still shows and preserves each question's chosen correct answer across a
      save-and-reload.
- [ ] A reload after genuinely completing all questions does not re-demand answering them again;
      a reload before completion does not silently grant credit.

## Password recovery

- [ ] "Forgot password?" is reachable from the Sign In tab and survives switching between Sign
      In/Create Account.
- [ ] Submitting `/forgot-password` shows the same success message for a registered and an
      unregistered email.
- [ ] The email's reset link signs the visitor in and lands them on `/reset-password`, where a new
      password (matching existing password rules, with confirmation) can be set and takes effect.
- [ ] Visiting `/reset-password` without a valid recovery session shows an error state, not a
      crash, with a way back to `/forgot-password` and `/login`.
- [ ] Member/Church/Organization accounts all authenticate identically after a password reset.

# Required Features

Behaviors that must keep working across future changes. Add to this list rather than removing
entries when a feature is extended.

## Lesson editing

- Hosts can edit lessons they manage (a `host` or `admin` `church_memberships` row for the
  lesson's `church_id`). Kingdom Members, anonymous visitors, and Hosts of a different church
  cannot open or submit the editing form.
- Editing updates the existing lesson row by `id` and never creates a duplicate lesson.
- Draft and published status must be preserved unless the Host explicitly changes it via
  Publish/Unpublish -- Save Draft never publishes, Save Changes never unpublishes.
- Unauthorized users cannot access or submit the editing form (server-side church_memberships
  check in `app/experience-builder/[lessonId]/edit/page.tsx` and again in
  `updateLessonExperience`, independent of RLS and of any client-side check).
- The existing thumbnail and media items remain intact when no replacement is submitted --
  `featured_image_url`/`featured_image_alt` are only written when the Host actually staged a
  replacement or an explicit (confirmed) removal, and a `lesson_media` row is only deleted when
  the Host explicitly removed it.

## Member journey (Studied stage and beyond)

Every lesson created through Build Experience must automatically work with the shared member
journey and Studied-stage system. Journey routes, checklist generation, progress persistence, and
My Journey integration must be dynamic and must never require lesson-specific code, routes,
migrations, or manual developer setup.

- The shared route `/journey/[lessonId]/studied` (keyed by `lessons.id`, a UUID) works for every
  published lesson and every authorized draft preview, present or future -- no per-lesson route,
  migration, or hard-coded id/slug/church is ever required.
- Checklist items are derived from the lesson's actual available content (`lib/journeyChecklist.ts`)
  using a small fixed vocabulary of stable, content-category keys -- never a `lesson_media` row id
  and never a displayed title -- so completion survives a Host editing the lesson later.
- Starting a journey creates or retrieves exactly one `lesson_journeys` row per `(user_id,
  lesson_id)` (upsert-based); reopening never duplicates it.
- One member's progress is never visible or writable by another member (RLS on `lesson_journeys`
  / `lesson_journey_items`, scoped to `auth.uid()`), and Hosts have no automatic read access to
  it.
- No `/journey/` link may ever point at a missing route -- a stage whose page isn't built yet
  (`experienced`, `applied`, `added-to-story`, `captured`) shows a branded coming-soon state
  instead of a 404.

## Study questions (multiple choice, member-facing)

- Choice-based questions render only inside the Study flow (`StudiedClient.tsx`'s Questions tab),
  never on a lesson card, preview, the public lesson detail page, or any pre-lesson modal.
- The correct answer (`lesson_question_choices.is_correct`) is never sent to a learner's browser
  in any form -- not in page props, not in a client JS bundle, not in a public API response.
  Grading happens only via the `check_lesson_question_answer` SECURITY DEFINER RPC (migration
  0043), which takes just `(question_id, choice_id)` and returns a bare boolean. Column-level
  SELECT on `is_correct` is revoked from `anon`/`authenticated` at the database level, not just
  avoided by app code -- reading it directly via the REST API is not possible either.
- A question is marked complete only after a genuine correct server verdict; opening the tab or
  selecting an answer without submitting never completes it. The aggregate `questions` checklist
  item completes only once every question in the lesson is answered correctly.
- Host/admin editing (`QuestionsEditor`, via `get_lesson_questions_for_edit`) is the only other
  reader of `is_correct`, gated on `private.is_church_manager` inside that same RPC.

## Password recovery

- "Forgot password?" on the Sign In tab (`/login`) leads to `/forgot-password`, which always shows
  the same neutral "check your email" response regardless of whether the address is registered
  (Supabase's own `resetPasswordForEmail` never reveals this either).
- The recovery link reuses the existing `/auth/confirm` callback (`type=recovery`) and hands off to
  `/reset-password`, which requires an active (recovery-established) session -- visiting it
  without one shows an invalid/expired-link state, never a crash, with a path back to
  `/forgot-password` or `/login`.

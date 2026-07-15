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

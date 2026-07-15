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

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

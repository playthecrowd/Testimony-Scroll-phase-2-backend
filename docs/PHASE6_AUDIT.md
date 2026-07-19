# Phase 6 Audit — Kingdom Scroll (Testimonies)

Date: 2026-07-17. Read-only audit, no code changed.

## Current state: entirely mock, no schema

Confirmed via Phase 1 audit (unchanged since): `public.testimonies` doesn't exist in any
migration. Everything lives in `data/testimonies.ts` + `localStorage` (`services/testimonyService.ts`),
mock type `Testimony` (`types/index.ts`):

```
userId, primaryLessonId, supportingLessonIds, whatLearned, howApplied, situation, actionTaken,
howHelpsOthers, writtenTestimony, applicationScenario?, videoUrlPlaceholder?, audioUrlPlaceholder?,
transcript?, visibility (public|church-only|private), identityDisplay (full-name|first-name|
username|anonymous), storyGenerationPermission, futureEpisodePermission, voiceLikenessPermission,
status (awaiting-review|approved|rejected), title, topic, scripture, thumbnailUrl, submittedAt,
approvedAt?, likeCount, commentCount, shareCount, durationLabel
```

This mock shape is actually a solid reference — `identityDisplay` and the three permission flags
already anticipate exactly what Part 14 asks for ("consent and publication acknowledgement"). The
real schema below keeps that shape, drops `commentCount` (Part 14: avoid unrestricted comments) and
`shareCount` (no share feature requested), and adds the church-review step the mock never had
(mock only has a single `status`, no church-then-platform two-stage flow).

**Where mock testimonies are read/written today** (all stay mock, all still work — nothing here is
being removed, only added alongside):
- `app/kingdom-scroll/page.tsx` — public landing, reads `getApprovedTestimonies()`.
- `app/journey/[lessonId]/applied/page.tsx` — 5-step submission wizard, entirely mock-lesson-scoped
  (`getLesson()`, shows `StageComingSoon` for any real Supabase lesson — same gap as Experienced).
- `app/contribute/page.tsx` — entry point listing the member's mock "experienced"/"applied"
  journeys, links to `/journey/{id}/applied`.
- `components/host-dashboard/TestimonyReviewPreview.tsx` — the Phase 1 "preview" card on
  `/host-dashboard`, explicitly labeled a mock-data preview, approve button unscoped to any church.
- `services/storyService.ts` — `generateCharacterAndStory()` auto-creates a mock `StoryCharacter` +
  `StoryEntry` the instant a testimony is approved, with zero admin control. Part 14/16 both say
  official character/story assignment must be production-admin controlled, not automatic — this
  mock behavior should not be the model for the real version.

## Schema needed

`public.testimonies`:

```
id, submitted_by (profiles.id), church_id (churches.id, required -- every testimony is
  associated with a church for review per Part 14's workflow),
primary_lesson_id (lessons.id), supporting_lesson_ids (uuid[]),
title, topic, scripture, written_testimony, video_url, audio_url,
visibility ('public' | 'church_only' | 'private'),
identity_display ('full_name' | 'first_name' | 'username' | 'anonymous'),
suggested_character text (free-text suggestion only -- see decision below),
story_generation_permission, future_episode_permission, voice_likeness_permission (booleans),
church_status ('pending' | 'approved' | 'rejected'),
platform_status ('not_submitted' | 'pending' | 'approved' | 'rejected'),
created_at, updated_at
```

Two separate status columns (not one) because the workflow genuinely has two independent
decisions: a church can approve a testimony for its own church-level use without that testimony
ever becoming part of the public Kingdom Scroll — only production admin approval
(`platform_status = 'approved'`) does that, and only for `visibility = 'public'` testimonies.

**Lesson association rule (Part 14: "a member may only attach lessons they have actually
completed")**: enforced with a real constraint, not just a hidden dropdown — a trigger (or a
`check`-friendly RPC, mirroring `submit_lesson_draft`'s shape) validates `primary_lesson_id` and
every id in `supporting_lesson_ids` against the caller's own `lesson_journeys` rows before insert.
This is the one place server-side enforcement is non-negotiable per the prompt's own instruction.

RLS, following this repo's established shape:
- A member can insert their own testimony and read their own (any visibility/status).
- A church manager (`private.is_church_manager(church_id)`) can read/update `church_status` for
  testimonies submitted to their church — same reused-helper pattern as Phase 5's
  `lesson_requests`.
- A platform admin (same helper, `church_id`-independent branch) can read/update `platform_status`
  for any testimony with `visibility = 'public'`.
- Public read: only `visibility = 'public' AND church_status = 'approved' AND platform_status =
  'approved'` — the real two-stage privacy gate Part 14 describes ("must not become publicly
  visible immediately").

## Two decisions before implementation

1. **Video**: Part 14 lists "video upload or supported video source." No video file upload
   pipeline exists anywhere (only image thumbnails and small documents have real Storage buckets).
   Recommend **URL-only** (YouTube/hosted link, reusing the `lib/videoEmbed.ts` helper from Phase
   4a) rather than building raw video file upload — a real upload bucket sized for video, with no
   transcoding available, is a meaningfully bigger and separate technical undertaking (bucket
   limits, cost, format handling) than the rest of this phase.
2. **Suggested character**: Part 14/16 are explicit that members can only *suggest* a character,
   never create official canon, and production admin controls the real character/story system —
   which doesn't exist as real schema yet (still `data/characters.ts` mock, that's Phase 7's job).
   Recommend **free-text only** for now (a `suggested_character` text field, shown to the church/
   admin reviewer, not linked to any real character record) rather than inventing a bare
   `characters` catalog table this phase — unlike Phase 3's `experiences` catalog (simple,
   independent, no other phase depends on its exact shape), Phase 7 needs to design the real
   character schema itself (archetype, backstory, related episodes/timeline per Part 16), and a
   half-shaped placeholder table now would likely need reworking then anyway.

## Scope for this phase

**In scope**: real schema + RLS; a new real submission flow (separate from the mock
`/journey/[lessonId]/applied` wizard, which stays untouched — same reasoning as Phase 4's decision
to leave Experienced/Applied alone); member's own testimony history; a real church review queue
(replacing `TestimonyReviewPreview.tsx`'s mock preview on Host Dashboard); a new
`/admin/testimonies` platform-moderation page (second real admin page, same pattern as Phase 5);
`app/kingdom-scroll/page.tsx` rewritten to read real approved testimonies instead of the mock
catalog; a new real public testimony detail route (Part 14 flags the current inline-drawer-only
approach as unable to deep-link — the real version gets `/kingdom-scroll/[id]`); fixing "View
Related Lesson" to point at the real lesson (works automatically once testimonies reference real
`lessons.id`); a simple real Likes reaction (Part 14: likes/predetermined reactions only, no
unrestricted comments).

**Out of scope, deferred**: the mock `/journey/[lessonId]/applied` wizard and `/contribute` stay as
they are (still useful for the mock-lesson demo catalog, not touched); automatic character/story
generation on approval is **not** carried over to the real version (no character record is created
automatically — that's Phase 7's production-admin-controlled job); Phase 4b-style
credits/points/badge rewards tied to testimony stages (Part 15) are not part of this pass.

Confirmed with the user: URL-only video (no upload pipeline), free-text-only character suggestion
(no bare characters catalog this phase).

---

## Implementation summary

**Migration**: `0018_testimonies.sql` — `testimonies` + `testimony_likes`. Three real pieces of
enforcement, none of them just UI:

1. `testimonies_before_insert` (BEFORE INSERT, `SECURITY DEFINER`) derives `church_id` from the
   primary lesson (never trusts client input for it) and checks the caller's own `lesson_journeys`
   for `studied_completed_at is not null` on the primary lesson *and every* supporting lesson id —
   the real "you can only attach a lesson you completed" rule, enforced in the database, not a
   hidden dropdown.
2. The same trigger resolves `display_name` once, at submission time, from the submitter's real
   profile and their chosen `identity_display` — this is what lets a public testimony show "First
   Name" or "Anonymous" per the submitter's own choice *without* needing a new profiles RLS policy
   that would expose more than that one already-consented-to string to arbitrary public visitors.
3. `protect_testimony_status_columns` (BEFORE UPDATE) keeps the two-stage review honest: a church
   manager can only ever change `church_status`; a platform admin can only ever change
   `platform_status`; neither can reassign ownership/association fields after submission.

RLS reuses `private.is_church_manager(church_id)` for the review-queue policy exactly like Phase
5's `lesson_requests` (same church_id-independent admin branch). Public visibility requires
`visibility='public' AND church_status='approved' AND platform_status='approved'` — never a bare
`using(true)` — the actual two-stage privacy mechanism.

**Routes added**:
- `/kingdom-scroll/submit` — real submission form, lesson picker built from the member's actual
  completed lessons (`getUserJourneysWithLessons` filtered by `studiedCompletedAt`).
- `/kingdom-scroll/my-testimonies` — member's own history, both status tracks shown.
- `/host-dashboard/testimonies` — replaces `TestimonyReviewPreview.tsx`'s mock preview (deleted,
  no longer used anywhere) with a real, church-scoped review queue. Linked from a new compact
  "Testimony Review" card on the main Host Dashboard.
- `/admin/testimonies` — second real admin page (same `is_platform_admin` gate as Phase 5's
  `/admin/lesson-requests`; the two admin pages now cross-link to each other).
- `app/kingdom-scroll/page.tsx` rewritten to read `getApprovedPublicTestimonies()` instead of the
  mock catalog — the automatic mock character/story generation on approval was **not** carried
  over (Phase 7's job, production-admin-controlled).
- `/kingdom-scroll/[id]` — new, real, deep-linkable public detail page (the old inline-drawer
  approach couldn't be shared/linked to directly). Embeds YouTube video via the Phase 4a helper,
  shows a real Like button, and "View Related Lesson" links to the real lesson — works
  automatically since testimonies now reference real `lessons.id`.

**Deliberately not touched**: `/journey/[lessonId]/applied` and `/contribute` (still mock, still
useful for the demo catalog); `services/storyService.ts`'s automatic character generation (not
reused for real testimonies).

## Manual QA checklist

1. Complete a lesson's Studied stage, then submit a testimony about it as a public testimony.
   Confirm it does **not** appear on `/kingdom-scroll` yet, and shows "Church: pending" /
   "Platform: pending" on `/kingdom-scroll/my-testimonies`.
2. As that church's Host, see it on `/host-dashboard/testimonies`, approve it. Confirm it still
   does not appear publicly (church-approved only, not platform-approved yet), and the member's
   history now shows "Church: approved" / "Platform: pending".
3. As a platform admin, see it on `/admin/testimonies` (only after church approval — confirm it's
   invisible there beforehand), approve it. Confirm it now appears on `/kingdom-scroll` and at
   `/kingdom-scroll/[id]`.
4. Submit a `church_only` testimony. Confirm it never appears on `/admin/testimonies` or the public
   Kingdom Scroll, only in the church's own review queue and the member's history.
5. Attempt to submit a testimony for a lesson you have *not* completed (e.g. via a crafted request)
   — confirm the database rejects it, not just the form's lesson picker hiding the option.
6. Confirm the displayed name on an approved public testimony matches the submitter's chosen
   `identity_display` (test each of full name / first name / anonymous) and never leaks their real
   name when anonymous was chosen.
7. Click "View Related Lesson" on a testimony detail page — confirm it opens the real lesson, not
   a 404.
8. Like and unlike a testimony as two different accounts — confirm the count updates correctly and
   an unauthenticated visitor cannot like (sees a sign-in prompt, not a silent failure).
9. Confirm a Kingdom Member cannot reach `/host-dashboard/testimonies` or `/admin/testimonies`, and
   a Host from a different church cannot see another church's testimonies.

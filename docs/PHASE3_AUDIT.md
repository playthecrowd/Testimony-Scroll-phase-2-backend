# Phase 3 Audit — Lesson Builder

Date: 2026-07-17. Read-only audit, no code changed. Covers `app/experience-builder/**`,
`app/lessons/**`, `components/lessons/**`, `lib/lesson*.ts`, and the relevant migrations.

## 1. Existing routes

| Route | File | Notes |
|---|---|---|
| `/experience-builder` | `app/experience-builder/page.tsx` (server) + `ExperienceBuilderForm.tsx` (client) | Create flow. Server component does the auth/church-membership guard and loads the host's own managed lessons list; the form itself is 100% client. |
| `/experience-builder/[lessonId]/edit` | `edit/page.tsx` + `EditExperienceForm.tsx` | Edit flow. `[lessonId]` is actually the lesson **slug** (naming predates slugs being the lookup key — same quirk noted in Phase 1). |
| (no separate list route) | `components/lessons/HostLessonManagementList.tsx`, rendered inline at the top of `/experience-builder` | Create/Edit/Preview/Publish/Unpublish list, already real and church-scoped (Phase 1 audit confirmed this). |
| `/lessons/[lessonId]` | `app/lessons/[lessonId]/page.tsx` + `LessonDetailClient.tsx` | Public lesson detail **and** the only "preview" surface — no separate preview-only route exists (see §9). `[lessonId]` is also actually the slug. |

No experience/catalog browsing route exists anywhere (confirmed again this pass — no `experiences`,
`quests`, or similar table/route in the whole repo).

## 2. Existing lesson schema

`public.lessons` (`0001_tables.sql`, unchanged through `0007`):

```
id, slug (unique), title, short_description, about_text, topic, subject, ministry_category,
church_id, speaker_id, date, duration_label,
lesson_type (check: sermon|bible-study|youth|devotional|series),
primary_scripture, supporting_scriptures text[], tags text[],
featured_image_url, featured_image_alt,
quest_url, quest_level, xp_reward,
status (draft|published), created_by, contributors_count, is_demo, created_at, updated_at
```

`public.lesson_media`: `id, lesson_id, media_type (notes|video|audio|slides|document|transcript),
url, content, title, sort_order, is_demo, created_at` + unused-by-code review columns from 0006
(`provider, normalized_url, validation_status, reviewed_at, reviewed_by`).

`public.lesson_hosts`: `id, lesson_id, church_id, status (live|scheduled), participant_count,
schedule_label, quest_url, is_demo, created_at`. **This is not an "experience" relationship** — it
records which church(es) are running a live/scheduled session of this lesson, each with their own
participant count and quest link. Easy to confuse with Part 8's "Experience Connection" concept;
they are different things today.

**No `questions` table exists.** The Study page's Questions tab (`LessonDetailClient.tsx`) reads
from `data/questions.ts` (`getStudyQuestionsForLesson(lesson.id)`) — a static, mock, hand-authored
catalog keyed by lesson id, entirely disconnected from real Supabase lessons. Any real lesson
created through the builder gets `questions.length === 0` on its public detail page today.

**No `experiences`/catalog table exists.** The only "experience" data on a lesson is the free-text
`quest_url`/`quest_level`/`xp_reward` columns plus `lesson_hosts.quest_url` (per-host-session).

## 3. Existing lesson editor components

Two independent forms, not shared, and at different levels of sophistication:

- **Create** (`ExperienceBuilderForm.tsx`, ~615 lines): one long single-page form (not a wizard —
  `JourneyStepper` is rendered above it purely decoratively, `linkBase={() => "/experience-builder"}`
  makes every stage link to itself). One fixed URL/textarea field per media type (`notesUrl`,
  `videoUrl`, `audioUrl`, `slidesUrl`, `documentUrl`, `transcript`) — **cannot** add a second video
  or a second document. A "Save Draft" button (`type="button"`, no `onClick`) is **dead/inert** —
  clicking it does nothing; only "Save Experience Draft" (`type="submit"`) actually saves, always
  as a draft (there is no "save vs. publish" choice at creation time — publishing only happens
  after creation, from the success screen or the edit page). A "AI Processing Preview" panel is
  static marketing copy (see §5). An inert file-upload dropzone (`<input type="file" />` with no
  `onChange`) sits next to "Transcript" — purely decorative.
- **Edit** (`EditExperienceForm.tsx` + `components/lessons/MediaItemsEditor.tsx`, ~520 + ~170
  lines): meaningfully more advanced. Uses `MediaItemsEditor` — a real add/remove/reorder,
  multi-item-per-type media list (already supports multiple videos, multiple documents, etc., the
  exact capability Phase 3's "support multiple lesson videos" needs). Has additional fields the
  create form lacks entirely: About This Lesson, Subject, Duration, Quest Level, XP Reward. Proper
  draft-vs-published action set (Save Draft/Publish Lesson, or Save Changes/Unpublish), a dirty-
  state guard (`beforeunload` + Cancel-button confirm), and a "re-fetch and reset from the saved
  row" pattern after every save so a second save in the same session updates existing
  `lesson_media` rows instead of duplicating them.
- Shared pieces both forms already use: `ThumbnailUploadField` (drag-drop/replace/remove/alt-text,
  fully wired to real Supabase Storage), `Field` (label wrapper), `Button`/`LinkButton`.
- `components/lessons/ThumbnailEditorPanel.tsx` — a third, smaller thumbnail-only editor rendered
  on the **public lesson detail page itself** for a host who manages that lesson's church (lets a
  host swap the thumbnail without opening the full edit page).

**Practical implication for Phase 3**: the edit form is already close to what the prompt's
multi-step redesign wants for its "Questions"/"Experience Connection" steps' media handling — the
create form is the one that's behind and duplicates logic the edit form already solved better.

## 4. Existing upload pipeline

**Only thumbnails have a real upload pipeline.** `services/supabase/lessonThumbnails.ts`
(`buildThumbnailPath`, `uploadLessonThumbnail`, `deleteLessonThumbnailByUrl`) + `lib/lessonThumbnail.ts`
(file-type/size validation, aspect-ratio warning, filename sanitization) write to the real,
RLS-protected `lesson-thumbnails` Supabase Storage bucket (`0005_lesson_thumbnails.sql`), keyed
`{churchId}/{lessonId}/{uniqueId}-{filename}`.

**Every other "content source" is a URL or pasted text, never a file upload.** Notes/video/audio/
slides/documents are all just `lesson_media.url` (or `.content` for transcript) pointing at
wherever the host already hosts that file (YouTube, Google Drive, their own site, etc.) — there is
no Supabase Storage bucket, no upload UI, and no server code anywhere for PDFs/DOCX/other document
uploads. The "Upload Notes (PDF, DOCX, TXT)" dropzone in the create form (§3) is the only UI that
even gestures at this, and it's inert.

## 5. Existing AI/content extraction pipeline

**None. Confirmed again this pass — zero AI/LLM integration exists anywhere in the repo.** No AI
SDK, no OpenAI/Anthropic/other provider client, no PDF-parsing library, no YouTube-transcript
fetching code, in `services/`, `lib/`, `app/experience-builder/**`, or `package.json` dependencies.
The "AI Processing Preview" panel in `ExperienceBuilderForm.tsx` (§3) is static UI copy — "When you
submit, our AI will help prepare your lesson," four bullet items (Topic Detection, Scripture
Extraction, Summary Generation, 25 Question Generation) — with **zero backing implementation**;
`submitLessonDraft` never calls any external service, never parses uploaded content, never derives
anything from the video/document URLs. This exactly matches the Phase 1 audit's finding and hasn't
changed.

## 6. Existing experience/quest relationship model

A single free-text `quest_url` field (plus `quest_level` integer, `xp_reward` integer) on
`lessons`, edited as a plain `<input>` in both forms (labeled "Quest Launch URL"). A second,
independent `quest_url` exists on `lesson_hosts` (per-church-session launch link — see §2). There
is **no structured relationship** — no experience/catalog table, no many-to-many join, no preview
cards, no "reason this lesson relates to this experience" note. Building Part 8's "Experience
Connection" step as specified (select one-or-more existing experiences from a catalog, with
previews and a relationship note) requires new schema — this doesn't exist to "reuse," only the
raw `quest_url`/`quest_level` columns do, and those would need to be superseded or kept as a
fallback/manual-entry option.

## 7. Existing draft/publish workflow

Real and working, governed by `lib/lessonStatus.ts` (`resolveNextStatus`/`isValidActionForStatus`,
unit-tested in `tests/lessonStatus.test.ts`): `draft` lessons offer `save-draft`/`publish`;
`published` lessons offer `save-changes`/`unpublish`. `updateLessonExperience`
(`app/experience-builder/[lessonId]/edit/actions.ts`) computes the next status server-side from
this fixed mapping — never trusts a status the client sends directly. `publishLesson`/
`unpublishLesson` (`app/lessons/[lessonId]/actions.ts`) are the actual RLS-gated status-flip
actions, also used directly from the public lesson detail page (§9) and the create-flow success
screen. This entire workflow is solid and should not be rebuilt, only extended (e.g. if Phase 3
adds new required-before-publish steps like questions).

## 8. Existing validation

`lib/lessonForm.ts`: `isValidMediaUrl` (http/https only, rejects `javascript:`/`data:`/`file:`),
`validateRequiredLessonFields` (title, topic, shortDescription, speakerName, date,
ministryCategory, primaryScripture), `hasAtLeastOneContentSource`. `lib/mediaDiff.ts`:
`computeMediaDiff` — pure insert/update/delete bucketing for edited media lists, prevents
duplicate/lost rows on repeated saves. All are unit-tested (`tests/lessonForm.test.ts`,
`tests/mediaDiff.test.ts`) and enforced **both** client-side (fast feedback) and server-side in the
actions (defense in depth) — this is a good, already-correct pattern to keep.

**Gap**: the create form's content-source validation only fires on submit (`handleSubmit`'s check
at line ~208 in `ExperienceBuilderForm.tsx`), with no inline/early warning as the host fills out
the form — exactly the gap Part 8 calls out ("Add clear text before submission... Show inline
validation before the user reaches the final submission").

## 9. Existing lesson preview implementation

**There is no separate preview-only route or component.** "Preview" always means: open the real
`/lessons/[slug]` public detail page. For a draft lesson, RLS (`lessons_select_published_or_managed`)
still returns the row to its own church's host/admin, and `LessonDetailClient.tsx` shows a
"This lesson is a draft" banner with an inline Publish button when `lesson.status === 'draft'`. Both
forms' "Preview"/"Preview Draft"/"Preview Lesson" buttons are just `<LinkButton href="/lessons/{slug}">`.
This is a deliberate, reasonable pattern (one real rendering path, not two to keep in sync) and is
a strong reuse candidate for Phase 3's "Preview" step — no new preview component needs to be built.

## 10. What can be reused vs. replaced

**Reuse as-is (no changes needed):**
- `lib/lessonForm.ts`, `lib/lessonStatus.ts`, `lib/mediaDiff.ts`, `lib/lessonAuth.ts` — all correct, tested, framework-agnostic to whatever UI wraps them
- `submitLessonDraft` / `updateLessonExperience` / `publishLesson` / `unpublishLesson` server actions and the `submit_lesson_draft` RPC — the persistence layer is sound
- `ThumbnailUploadField`, `ThumbnailEditorPanel`, the thumbnail Storage pipeline
- `/lessons/[slug]` as the one and only preview surface
- `HostLessonManagementList` (host's lesson list/actions)
- `MediaItemsEditor` — promote this from edit-only to shared between create and edit (it already does what a "multiple items per type" step needs)

**Reuse with extension:**
- `lessons`/`lesson_media` schema — no columns need to change for a multi-step UI reorganization; only a real experience-relationship and a real questions model need new tables (see plan below)
- `EditExperienceForm.tsx`'s field set/validation timing — closer to the "required-first, all fields visible, save-draft/publish" model than a wizard; becomes the reference the multi-step create flow should match, not the other way around

**Replace/rebuild:**
- `ExperienceBuilderForm.tsx`'s fixed one-field-per-media-type inputs → `MediaItemsEditor`
- The dead "Save Draft" button (either wire it or remove it — currently misleading)
- The inert "Upload Notes" dropzone → either remove it (if document upload stays out of scope) or wire it to a real Storage bucket (new migration + service, mirroring the thumbnail pipeline exactly)
- The static "AI Processing Preview" panel → must not ship as-is per the prompt's own rule against
  fake AI behavior; needs a product decision (see Phase 3 plan)
- The raw "Quest Launch URL" text field → a real experience-selection UI, which needs new schema (no experiences/catalog table exists to select from)
- `data/questions.ts`-backed Questions tab → a real, lesson-scoped, host-editable questions model, if Phase 3 is meant to include the builder's Questions step per the original spec (Part 8 Step 3)

---

## Phase 3 implementation plan (proposed)

Scoped to stay inside "lesson builder redesign," per the roadmap's own phase boundary — not
pulling in Phase 4 (study experience), Phase 8 (events), or Phase 9 (production admin/full
experience-catalog CMS) work.

### 3a. Multi-step create flow, built from what already works

- Turn `/experience-builder`'s create form into an actual multi-step flow (Input Method → Lesson
  Info → Questions → Experience Connection → Review/Publish), using real step state (not the
  decorative `JourneyStepper`) — a plain local `step` index is enough, no new library needed.
- Bring the create form up to parity with the edit form first: swap the fixed one-field-per-type
  inputs for `MediaItemsEditor` (already supports multiple items/type), add the fields the edit
  form has that create is missing (About This Lesson, Subject, Duration, Quest Level/XP), and wire
  up or remove the dead "Save Draft" button.
- Reorder fields required-first (title, short description, speaker, church, date, lesson type,
  ministry category, main topic, primary scripture, at least one content source) with
  thumbnail/alt-text and other optional metadata moved down, per Part 8's field-organization ask.
- Add early, inline "at least one content source is required" messaging (a small status line that
  updates as media items are added/removed), not just an on-submit error.
- Clarify "Lesson Date" in the UI copy — confirmed against the schema, `lessons.date` has no
  separate "recorded/published" concept; it's a single date column. Recommend labeling it "Date
  Taught" in the UI (matches how every existing page already displays it) rather than changing the
  schema.
- "Upload Notes (PDF, DOCX, TXT)" dropzone: either wire it to a real Storage bucket (new
  `lesson-documents` bucket + service module mirroring `lessonThumbnails.ts`/`lib/lessonThumbnail.ts`
  exactly, RLS mirroring `0005`) so it actually creates a `lesson_media` "document" row, or remove
  it if file upload is out of scope for this pass. Recommend building it — it's a small, low-risk,
  well-understood mirror of a pipeline that already works.

### 3b. Questions (schema only in this phase)

- New `lesson_questions` table (`id, lesson_id, question, sort_order, created_at`), RLS mirroring
  `lesson_media` exactly (`is_church_manager` for write, published-or-managed for read).
- Builder gets a real "Questions" step: add/remove/reorder, same interaction pattern as
  `MediaItemsEditor`.
- **Not in this phase**: replacing the Study page's `data/questions.ts`-backed Questions tab with
  these real rows, or any completion tracking — that's Phase 4 (member study experience), which
  already owns `lesson_journeys`/`lesson_journey_items` and should decide how questions plug into
  the completion gate as one piece of that work, not bolted on ahead of it here.
- No auto-generated question *suggestions* (would require the AI pipeline that doesn't exist —
  see below); manual add/edit only for now.

### 3c. Experience Connection — decided: build the bare catalog now

Confirmed with the user: add a bare `experiences` table now (`id, name, description,
preview_image_url, is_demo, created_at`) with public read access (like `speakers`/`ministries`)
and no admin UI yet — rows are added directly via the Supabase dashboard or a seed script until
Phase 9 builds real production-admin management. A new `lesson_experiences` join table
(`lesson_id, experience_id, relationship_note`) replaces the raw `quest_url` picker with a real
multi-select + preview-card UI + reason note, per spec. The existing `quest_url`/`quest_level`
columns stay untouched as a manual-fallback/legacy field.

### 3d. AI processing panel — decided: deferred to its own future phase

Confirmed with the user: real AI/content extraction is **not** part of Phase 3. The user is writing
up full requirements for a dedicated AI/content-extraction phase separately, later. For Phase 3:
remove the fake "AI Processing Preview" panel and replace it with an honest guidance panel (what
source materials produce better manual results, per Part 8's own fallback instruction) — fully
manual flow, no new credentials or dependencies. **Reminder placeholder: bring this back up once
Phase 3 (or the broader roadmap work) wraps up** — the user has this written down for later and
asked to be reminded rather than have it built or re-decided unprompted.

### Migrations anticipated

- `lesson_questions` table + RLS (3b)
- `experiences` + `lesson_experiences` tables + RLS (3c)
- `lesson-documents` Storage bucket + RLS (3a, only if document upload is built)

### Explicitly out of scope for Phase 3

- Study-page Questions tab / completion tracking (Phase 4)
- Real AI extraction service (deferred to its own future phase — see above)
- Production-admin experience catalog management UI (Phase 9)
- Removing the "Change" host-selection link on the lesson detail page (Part 11 — Phase 4, member study experience, not the builder)

---

## Implementation summary

Migrations added: `0014_lesson_questions.sql`, `0015_experiences_catalog.sql`,
`0016_lesson_documents_storage.sql`. All additive, all gated through `private.is_church_manager`
where write access matters, mirroring `lesson_media`'s exact RLS shape.

- **Create flow** (`ExperienceBuilderForm.tsx`) is now a real 5-step wizard (Source Materials →
  Lesson Information → Questions → Experience Connection → Review & Publish) with real step state,
  required-first field ordering, `MediaItemsEditor` reuse (multi-item-per-type, matching the edit
  form), a working document upload (deferred to a follow-up phase after lesson creation, same
  pattern as the existing thumbnail upload), inline "at least one content source" status text, and
  the fake "AI Processing Preview" panel replaced with an honest "Getting Better Results" guidance
  panel. The dead no-op "Save Draft" button is gone.
- **Edit flow** (`EditExperienceForm.tsx`) gained the same Questions and Experience Connection
  sections, persisted alongside the existing save action.
- **Public lesson page** (`LessonDetailClient.tsx`) now shows real per-lesson questions (previously
  a static mock catalog disconnected from real lessons) and a new "Connected Experiences" display —
  list-only, no launch/credits/scheduling logic (that's Phase 12). The Studied journey page
  (`StudiedClient.tsx`) was deliberately **not** touched — it's explicitly protected by this repo's
  CLAUDE.md and already has its own documented note about the mock question fallback being a known
  Phase 4 item.
- `lib/lessonThumbnail.ts`'s `sanitizeFileName` was promoted to `lib/utils.ts` so the new document
  upload pipeline (`services/supabase/lessonDocuments.ts`, mirroring `lessonThumbnails.ts` exactly)
  could reuse it instead of duplicating it.

## Manual QA checklist

1. Build a new lesson through the full 5-step wizard: upload a document file, add a link and a
   transcript, fill required lesson info, add two questions, connect one experience with a note,
   review, and save as draft. Confirm the draft appears correctly on `/host-dashboard` and
   `/experience-builder`'s list.
2. Preview the draft (`/lessons/[slug]`) — confirm the uploaded document appears in the Notes tab,
   the two questions appear in the Questions tab, and the connected experience appears in the
   sidebar with its note.
3. Publish the lesson, then edit it: remove a question, remove the experience connection, add a
   new media link, save. Confirm the preview reflects all three changes and no duplicate media/
   question/experience rows were created (re-open the edit page and confirm counts are still
   correct after a second save in the same session).
4. Try to advance the wizard past Step 1 with no content source added — confirm it's blocked with
   the inline message. Try to jump directly to Step 5 via the step pills before filling required
   Lesson Information fields — confirm it's still blocked (not just the immediate-next-step check).
5. Confirm a Kingdom Member (non-host) account cannot reach `/experience-builder` at all, and that
   a Host from a different church cannot load `/experience-builder/[otherHostsLessonSlug]/edit`.
6. Confirm `/lessons` and `/churches/[slug]` still work exactly as before for lessons with no
   questions/experiences (empty states, no crashes).

# Phase 7 Audit — Story Engine (Characters, Episodes, Full Story)

Date: 2026-07-17. Read-only audit, no code changed.

## Current state: entirely mock, and one confirmed defect

Confirmed via Phase 1 audit (unchanged since) plus a fresh read this pass:

- `/characters`, `/characters/[characterId]`, `/backstories/[characterId]` — mock
  (`data/characters.ts`, direct array reads, no service layer even).
- `/episodes`, `/episodes/[episodeId]` — mock (`data/episodes.ts`, `services/episodeService.ts`).
- `/story` — mock (`services/storyService.ts`'s `getAllStoryEntries`). **Confirmed defect** (Part
  17): `app/story/page.tsx`'s render branch is `mode === "characters" ? (...) : mode === "topics" ?
  (...) : (...)` — there is no `mode === "book"` case. Both "Book View" and "Timeline View" fall
  into the same final `else` block and render byte-for-byte identical markup (a vertical
  chronological list with connector line and episode-number badges). Selecting either tab only
  changes which pill is highlighted.
- `services/storyService.ts`'s `generateCharacterAndStory()` auto-creates a mock character +
  story entry the instant a testimony is approved, with **zero admin control** — Part 16 is
  explicit that official character/story assignment must be production-admin controlled, not
  automatic. Confirmed this function is now called **only** from the still-mock
  `/journey/[lessonId]/applied` wizard (not from anything Phase 6 touched) — it stays exactly as
  it was, isolated to that mock flow, not reused for the real version below.

Mock type shapes (`types/index.ts`) — a solid reference for the real schema, same as previous
phases' mock types have been:

```
StoryCharacter: id, name, role, description, imageUrl, quote, quoteSource, storyArc, arcLabel,
  isKeyCharacter, testimonyId?
StoryEntry: id, episodeNumber, date, title, storyText, characterId, topic, scripture, arcLabel,
  contributorIds, testimonyId, lessonIds, imageUrl
Episode: id, season, episodeNumber, title, description, durationLabel, topic, scripture,
  mainCharacterId, mainCharacterRole, storyArc, contributorIds, releaseDate, thumbnailUrl,
  quote?, quoteSource?, featured?, upcoming?
```

## Schema for the real version

Characters and Episodes are **platform-wide, not church-scoped** — the first content type in this
app with no church dimension at all. Managed exclusively by `is_platform_admin` (same gate as
Phase 5/6's admin pages); no host/church involvement anywhere.

```
public.characters: id, name, role, description, image_url, quote, quote_source, is_key_character,
  created_at, updated_at

public.episodes: id, season, episode_number, title, description, duration_label, topic, scripture,
  thumbnail_url, quote, quote_source, status ('draft'|'published'), featured boolean,
  release_date, created_at, updated_at

public.episode_characters: episode_id, character_id, role_note   -- join, admin-curated
public.episode_lessons: episode_id, lesson_id                    -- join, admin-curated
public.character_testimonies: character_id, testimony_id, note   -- "approved testimonies
  contribute to a character's developing story" (Part 16) -- admin-curated, never automatic
```

**Character suggestion review (Part 16's "add an admin review process for character
suggestions")**: Phase 6 already captures this as free-text `testimonies.suggested_character`,
visible to admin on `/admin/testimonies`. No separate suggestion queue/table is needed — the
review process *is* an admin reading that field and, if they act on it, using the new character/
episode admin tools below to create or connect a real character. Inventing a second parallel
queue for the same input would be redundant.

RLS: `characters`/`episodes` (and their join tables) are `SELECT` public for
`status = 'published'` (episodes) — characters have no draft concept themselves, only
`is_key_character` as display curation; write access is `is_platform_admin`-only via a direct
profiles check (same pattern already used in `app/admin/*/actions.ts`), not
`private.is_church_manager` (there's no church dimension to reuse it against here — this is the
first genuinely church-independent admin-only table).

## Two scope calls made without re-asking (same category already confirmed twice this project)

1. **Admin UI stays plain/functional** — text-input forms and checkbox-list relationship pickers
   (same shape as Phase 3's `ExperienceConnectionSelector`), not a rich media/drag-drop editor.
   Matches how every other admin surface built so far (lesson requests, testimonies) stayed
   utilitarian rather than polished.
2. **"Schedule publication" gets a stored field, not real automation.** `episodes.release_date`
   exists and can be set to a future date, but there is no cron/scheduled-task infrastructure
   anywhere in this app (confirmed — nothing resembling a job runner exists), so nothing will
   auto-publish an episode at that date. An admin still has to click Publish. This is the same
   "store the field honestly, don't fake the automation" pattern as Phase 6's video-URL-only and
   Phase 3's AI-panel decisions.

## Scope for this phase

**In scope**: real schema + RLS; `/admin/characters` (list + create/edit) and `/admin/episodes`
(list + create/edit, connect characters/lessons, draft/publish, set featured) — third and fourth
real admin pages; public `/characters`, `/characters/[id]`, `/episodes`, `/episodes/[id]` rewritten
to read real data; `/story` rewritten with **actually distinct** Book View (sequential
chapter-style reading, one episode at a time with prev/next) and Timeline View (the existing
chronological list, kept as-is); character detail shows related episodes, related approved
testimonies (via `character_testimonies`), and — through those testimonies — the lessons they
connect to; public users never see draft episodes (RLS).

**Out of scope, deferred**: real scheduled-publish automation (no infra exists — documented
above); `/backstories/[characterId]` stays mock (a lightweight "play a backstory" extra, not core
to the character/episode/story relationship model this phase builds); the mock
`generateCharacterAndStory()` auto-generation path is not carried over or removed — it stays
exactly as-is, isolated to the untouched mock `/journey/[lessonId]/applied` flow.

---

## Implementation summary

**Migration**: `0019_story_engine.sql` — `characters`, `episodes`, `episode_characters`,
`episode_lessons`, `character_testimonies`. First tables in this schema with write access gated
by a **direct** `profiles.is_platform_admin` check rather than `private.is_church_manager` reuse —
there's no church dimension here to reuse that helper against. `character_testimonies`' SELECT
policy re-checks the linked testimony's full approval state (`visibility='public' AND
church_status='approved' AND platform_status='approved'`) at read time, not just at link time, so
revoking a testimony's approval later stops it surfacing through this relationship automatically.

A small shared helper, `lib/adminAuth.ts` (`requirePlatformAdmin` for actions,
`getPlatformAdminGate` for pages) and `components/admin/NotAuthorized.tsx`, replaced the
duplicated inline admin-check boilerplate that had accumulated across Phase 5/6's two admin pages
— applied retroactively to `/admin/lesson-requests` and `/admin/testimonies` too, not just the two
new pages this phase adds.

**Routes added**:
- `/admin/characters` (list + new + edit, third real admin page) — edit page also manages
  `character_testimonies` connections via a checkbox-list picker over approved public testimonies.
- `/admin/episodes` (list + new + edit, fourth real admin page) — edit page manages
  `episode_characters` and `episode_lessons` connections the same way, plus draft/publish.
- `/characters`, `/characters/[id]` rewritten to real data — character detail shows contributing
  testimonies (linked to `/kingdom-scroll/[id]`) and related episodes.
- `/episodes`, `/episodes/[id]` rewritten to real published-only data, featured episode surfaced
  from the real `featured` column.
- `/story` rewritten with the confirmed defect actually fixed: **Book View** is now a real
  sequential chapter reader (one episode at a time, Previous/Next, "View Episode Page" link) and
  **Timeline View** keeps the chronological list — genuinely different presentations of the same
  data, not the same markup behind two tab labels.

**Deliberately not touched**: `/backstories/[characterId]` (still mock); `/journey/[lessonId]/applied`
and its `generateCharacterAndStory()` call (still mock, still isolated).

## Manual QA checklist

1. As a platform admin, create a character on `/admin/characters`, confirm it appears on
   `/characters` immediately (characters have no draft state).
2. Create an episode on `/admin/episodes` — confirm it does **not** appear on `/episodes` or
   `/story` while still a draft, even though you (the admin) can see it on `/admin/episodes`.
3. Connect the character and a published lesson to the episode, then Publish. Confirm it now
   appears on `/episodes`, `/story` (both views), and the character's own detail page shows the
   episode under "Related Episodes."
4. Approve a public testimony (Phase 6 flow), then connect it to a character via
   `/admin/characters/[id]/edit`. Confirm the character's detail page shows it under
   "Contributing Testimonies," linking correctly to `/kingdom-scroll/[id]`.
5. Revoke that testimony's platform approval — confirm it no longer appears on the character's
   page (the join row still exists, but RLS stops surfacing it).
6. Confirm a non-admin (including a Host) gets "You don't have access to this page" on
   `/admin/characters` and `/admin/episodes`, not the management UI.
7. On `/story`, switch between Book View and Timeline View — confirm they visibly render
   differently (one episode with Prev/Next vs. a scrollable chronological list), not the same
   markup under two labels.
8. Set an episode's `featured` flag — confirm it becomes the highlighted banner on `/episodes`.

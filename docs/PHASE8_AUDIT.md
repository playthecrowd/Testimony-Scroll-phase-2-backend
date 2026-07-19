# Phase 8 Audit — Events

Date: 2026-07-18. Read-only audit, no code changed.

## Current state: one static mock page, nothing else

Confirmed via Phase 1 audit (unchanged since) plus a fresh read this pass: `/events`
(`app/events/page.tsx`) is a single page with one hardcoded featured event
(`data/featuredEvent.ts`), whose CTA links to a **static HTML file**
(`public/road-to-passion-week/q4k-landing.html`), not a Next.js route. No calendar, no event
detail route, no "Host an Event" form, no admin queue, no categories — none of it exists.

**Confirmed again this pass: no Square (or any payment provider) integration exists anywhere.**
`.env.example` has no payment-related variable planned at all (only Supabase + app URL). Every
"square" hit in the codebase is Tailwind's `aspect-square` utility class, unrelated. This matches
the Phase 1 audit's finding exactly — nothing has changed.

## The hard blocker: payment cannot be built, not just deferred by choice

Every other phase's "defer this piece" decision (AI extraction, video upload, characters
catalog admin UI, scheduled-publish automation) was a scope choice — the infrastructure could be
built, it just wasn't worth building yet. **Payment is different: it cannot be built at all in
this environment**, regardless of scope choice, because there is no Square merchant account, API
key, or webhook signing secret available anywhere. This is exactly the "missing credentials/
third-party service" case Rule #12 exists for, not a judgment call about effort. Building a
checkout flow without real credentials would mean one of:

- Faking a successful payment client-side (explicitly forbidden — "Do not fake successful
  payments," and "Prevent client-side trust of payment status").
- Wiring real Square SDK calls that will simply fail at runtime with no way to verify them (nothing
  to test against without an account).

Neither is acceptable. **Recommendation, matching the pattern already used for video/AI/etc.**:
build everything in Part 18 that doesn't require money changing hands — request form, admin
approval workflow, categories, calendar, publication — and store pricing/payment fields honestly
(a `requires_payment` flag, a price, a `payment_status` that can only ever be `not_applicable` or
`pending`, never `paid`, since nothing can ever set it to `paid`). The approval flow's "payment, if
required" step becomes a manual, offline arrangement between admin and requester until a real
Square integration is a separate, credentialed follow-up phase — same category as the deferred
AI-extraction phase.

## Schema

`public.events` — one table covers the whole lifecycle described in Part 18 (submission → review →
approval → calendar publication); a request *becomes* the event, it isn't a separate object that
gets copied into a new row on approval:

```
id, requested_by (profiles.id, nullable -- a platform-admin-created event has no requester),
church_id (nullable -- null means platform-wide, not church-specific),
title, description, category ('pop_up_virtual' | 'pop_up_physical' | 'ticketed' | 'game_day' |
  'church_hosted' | 'kingdom_scroll'),
format ('virtual' | 'physical'), location, starts_at, ends_at, image_url,
contact_name, contact_email, expected_attendance, requested_experience, equipment_notes, notes,
requires_payment boolean, price_cents integer, payment_status ('not_applicable' | 'pending'),
status ('submitted' | 'under_review' | 'approved' | 'published' | 'declined'),
featured boolean, created_at, updated_at
```

RLS: same shape already established twice (Phase 5 `lesson_requests`, Phase 7 `episodes`) —
`private.is_church_manager(church_id)` for a church-directed request's own church (when
`church_id` is set), a direct `is_platform_admin` check for platform-wide moderation (works for
`church_id = null` rows the same way it did for public `lesson_requests`), and public read only for
`status = 'published'`.

## Scope for this phase

**In scope**: real schema; a "Host an Event" request form (any signed-in user — the requester field
Part 18 wants is "requesting church or organization" as free text, not necessarily an existing
church, since not every requester will be an existing Church Host); admin approval queue
(`/admin/events`, fifth admin page) with status transitions and a "featured" toggle; a real
`/events` landing page with category filtering and a calendar-style date list (a simple grouped-
by-month list, not a full interactive month-grid calendar widget — see note below); a real
`/events/[id]` detail page. `lib/navigation.ts`'s Events entries move earlier in both the sidebar
and top nav arrays (Part 18 #1, "move Events to a more visible location").

**Deferred (documented, not silently skipped)**: real Square checkout — no credentials exist;
`payment_status` is stored honestly as `not_applicable`/`pending` only, `requires_payment`/
`price_cents` are captured so the schema is ready whenever a credentialed follow-up phase wires up
real Square. A full interactive month-grid calendar widget is also trimmed to a simpler grouped-
by-date list for this pass (Part 18 says "calendar presentation," which a grouped/sorted date list
satisfies functionally; a full drag/click month-grid UI is a meaningfully bigger frontend build
with no bearing on the RLS/schema work this phase is actually about).

Confirmed with the user: build everything except payment (Recommended option above).

---

## Implementation summary

**Migration**: `0020_events.sql` — one `events` table covers the whole submission-to-published
lifecycle. RLS reuses the same `private.is_church_manager(church_id)` pattern as Phase 5's
`lesson_requests` and Phase 7's admin tables for **read** access (a church sees its own directed
request, a platform admin sees everything including platform-wide requests with `church_id =
null`), but **status changes are deliberately admin-only** (`is_platform_admin` checked directly,
not via `is_church_manager`) — unlike `lesson_requests`, where a church could fulfill its own
directed request, Part 18's approval flow requires production review for every event regardless
of who requested it, so a church cannot self-approve or self-publish its own submission.
`payment_status` can only ever be `not_applicable` or `pending` at the schema level (a `check`
constraint) — there is no code path anywhere that could set it to `paid`, which is the honest
version of "don't fake a successful payment."

**Routes added**:
- `/events/host` — request form (any signed-in user; church picker shown only if the user manages
  one, but a request can also be independent of any church).
- `/admin/events` — fifth real admin page: status queue (submitted → under review → approved →
  published, or declined at any point) plus a featured toggle.
- `/events` rewritten: real featured-event banner (falls back gracefully to no banner if nothing
  is marked featured, instead of showing stale hardcoded content), category filter buttons, and a
  grouped-by-month list as the "calendar presentation" (see the trimmed-scope note above).
- `/events/[id]` — new detail page.
- `lib/navigation.ts`: Events moved from last to right after Lessons in both sidebars and the top
  nav (Part 18 #1).

**Deliberately not touched**: the **homepage's `FeaturedEventBanner`** — it still reads the old
mock `data/featuredEvent.ts`. The homepage as a whole (lessons, testimonies, and now the event
banner) is still 100% mock across every prior phase; making just the event banner real would show
real content next to mock content on the same page, which is more confusing than leaving it
consistent. This is a known limitation, not an oversight — the homepage itself has never been in
scope for any phase so far.

## Manual QA checklist

1. Submit an event request via `/events/host` (as a church host, with a church selected, and
   separately as a plain member with no church). Confirm both appear in the requester's own view
   and in `/admin/events`'s queue.
2. As a Host, confirm you can see your own church's request's status but have **no** button to
   approve/publish it yourself — only an admin does.
3. As a platform admin, move a request through Under Review → Approved → Published. Confirm it
   appears on `/events` only after Published, not before.
4. Decline a different request — confirm it never appears publicly and disappears from the
   pending queue view.
5. Mark a published event Featured — confirm it becomes the `/events` banner, and unfeaturing it
   removes the banner (not a fallback to old mock content).
6. Filter `/events` by category — confirm only matching published events show.
7. Confirm `/events/[id]` for a draft/unpublished event 404s for a non-admin visitor.
8. Confirm Events appears earlier in the sidebar (both member and host) and top nav than before.
9. Confirm no UI anywhere claims a payment was processed — an event marked `requires_payment` only
   ever shows a "contact us for pricing" message, never a checkout button or a fake "Paid" badge.

# Phase 5 Audit — Lesson Requests

Date: 2026-07-17. Read-only audit, no code changed.

## Current state: nothing exists

Confirmed via repo-wide search — no route, table, service, or type mentions "lesson request" /
"request a lesson" anywhere except this audit's own docs. This is genuinely new territory, unlike
Phases 1-4 which mostly repaired or extended something real. The closest existing (and easily
confused) concept is "Capture" (`app/capture/page.tsx`), which is a **Host submitting a new
lesson**, not a **Member requesting one** — unrelated.

Also confirmed unchanged since Phase 1: `profiles.is_platform_admin` is a real DB column, wired
into `private.is_church_manager()` as a global-manager bypass, but **zero app code reads it and no
`/admin` route group exists.** This matters for Phase 5 specifically: Part 13 requires "public
requests first enter production-admin moderation" — that moderation step has nowhere to happen
today.

## Schema needed

New `public.lesson_requests` table:

```
id, requested_by (profiles.id), topic, notes,
scope ('church' | 'public'),               -- directed vs. broader platform request
church_id (nullable, set only when scope='church'),
status ('submitted' | 'under_review' | 'approved' | 'declined' | 'fulfilled'),
created_at, updated_at
```

RLS, following this repo's established shape:

- A member can insert their own request (`requested_by = auth.uid()`) and read their own requests.
- A church-directed request (`scope='church'`) is also readable by that church's manager
  (`private.is_church_manager(church_id)`) — mirrors every other church-scoped table.
- A public request (`scope='public'`) becomes readable platform-wide **only once approved**
  (`status = 'approved'`) — before that, only the requester and a platform admin can see it. This
  is what "Protect member privacy on public requests" (Part 13 #9) actually means at the RLS layer:
  a pending public request naming a member isn't broadcast while still unmoderated.
- Status changes: a church manager may update status only for their own church's directed requests
  (e.g. marking fulfilled); moving a **public** request through
  submitted → under_review → approved/declined is restricted to `is_platform_admin` — the one
  status transition this feature can't function without.

## The one real decision: does approving a public request need real admin UI now?

`is_platform_admin` has existed in the schema since Milestone One with no UI anywhere. Lesson
Requests is the first feature that can't function at all without someone actually being able to
flip a public request from submitted to approved/declined — unlike Phase 3's experiences catalog
(rarely changes, fine to edit via the Supabase dashboard for now), a request queue is meant to be
used routinely.

- **Option A (recommended)**: build one small, real, `is_platform_admin`-gated page —
  `/admin/lesson-requests` — server-protected the same way every other role gate in this repo
  works (server-side membership/flag check, not just hidden UI), showing pending public requests
  with Approve/Decline actions. This is a first, narrow slice of Phase 9's "Production Admin
  Completion," not a preemption of it — Phase 9 would still need to unify this with testimony
  moderation, episode management, event approvals, etc. into one consistent admin experience, and
  would reuse the same `is_platform_admin` gate this establishes.
- **Option B (defer entirely)**: build member submission + church-directed requests only this
  phase. Public requests get created with `status='submitted'` and sit there with no way to ever
  become `approved` until Phase 9 exists — meaning the "public request" path would be genuinely
  non-functional (not just admin-less-but-usable) until then.

Recommend Option A — a single, small, real admin page, not the wholesale admin portal.

## Everything else needed (no further decisions, just scope)

- `/lessons` and member dashboard: a visible "Request a Lesson" entry point.
- New request form: topic + notes, a scope toggle (church-directed vs. public), a church picker
  when directed (reusing `getPublishedChurches`).
- Member-facing "My Requests" list with status.
- Host-facing "Lesson Requests" queue on the Host Dashboard, scoped to their own church
  (church-directed requests only), with a fulfill/decline action.
- A public "Lesson Requests"/"Scroll Requests" area showing approved public requests (Part 13 #6-7).

Confirmed with the user: build the small real admin page now (Option A above).

---

## Implementation summary

**Migration**: `0017_lesson_requests.sql` — new `lesson_requests` table. RLS elegantly reuses
`private.is_church_manager(church_id)` as both "this church's manager can see their directed
request" *and* "a platform admin can see any request, including public ones awaiting moderation" —
the function's `is_platform_admin` branch doesn't reference its `church_id` argument, so calling it
with `church_id = null` (every public request) still correctly resolves for an admin. No separate
admin-only policy was needed. Public visibility is scoped to `scope='public' AND status='approved'`
only — never a bare `using(true)` — which is the actual privacy mechanism behind "protect member
privacy on public requests."

**Routes added**:
- `/request-lesson` — member-facing form (topic, notes, church-directed vs. public toggle) + the
  member's own request history.
- `/host-dashboard/lesson-requests` — church-scoped queue (Under Review/Fulfilled/Declined),
  linked from a new "Lesson Requests" card on the main Host Dashboard.
- `/admin/lesson-requests` — **the first real Production Administrator page in this repo**,
  server-gated by `profiles.is_platform_admin` (a column that's existed since Milestone One with
  no UI until now). `proxy.ts`'s `PROTECTED_PATHS` gained `/admin` for the edge-level "signed in at
  all" redirect; the real authorization check happens server-side in the page itself, same pattern
  as every other role gate in this repo.
- `/lesson-requests` — public list of approved public requests only, no requester identity shown.

Entry points added on `/lessons` and `/dashboard`.

**Tests**: 5 new RLS regression checks for `lesson_requests` (no bare `using(true)`, the
public-approved policy is properly narrowed, the manager-policy reuse, and the self-service insert
constraint). All existing tests still pass.

## Manual QA checklist

1. As a member, submit a church-directed request. Confirm it appears in that church's Host's
   `/host-dashboard/lesson-requests` queue, and in the member's own "Your Requests" list.
2. As a different church's Host, confirm they do **not** see that request.
3. As a member, submit a public request. Confirm it does **not** appear on `/lesson-requests`
   (unmoderated), does **not** appear in any Host's queue, but does appear in "Your Requests" and
   in `/admin/lesson-requests` for a platform admin.
4. As a non-admin (including a Host), confirm `/admin/lesson-requests` shows the "not authorized"
   message, not the queue.
5. As a platform admin, approve the public request. Confirm it now appears on the public
   `/lesson-requests` page, and its status updates to "Approved" in the member's own list.
6. As a platform admin, decline a different public request. Confirm it never appears publicly.
7. As a Host, mark a church-directed request "Fulfilled." Confirm the member sees "Fulfilled" in
   their own list.
8. Confirm `is_platform_admin` still has no self-service way to be granted (unchanged from
   Milestone One) — only a direct database/service-role action can set it.

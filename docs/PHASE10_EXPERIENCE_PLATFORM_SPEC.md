# Phase 10A — Experience Platform: Repository Discovery, Product Specification & Technical Design

Date: 2026-07-18. This is a **design document only**. No migrations, services, components, or
routes were created in Phase 10A. All recommendations below are proposals for review; nothing is
final until approved and implemented stage-by-stage per `docs/PHASE10_IMPLEMENTATION_PLAN.md`.

## 1. Executive summary

The repository has **no existing registration/capacity/waitlist/attendance/check-in system** —
confirmed by a repo-wide search (§2). The closest structural precedents are `events` (Phase 8: a
single-table request→review→publish workflow with no occurrences/registrations at all) and
`lesson_journeys`/`testimonies` (Phases 5–6: real per-member persistent state with
trigger-enforced server-side truth). Phase 10 is building a genuinely new subsystem, not
extending a half-built one.

The most important finding is a **naming collision, not a technical one**: the word "Experience"
already means two different things in this codebase today —

1. `app/experience-builder/*` and the nav label **"Build Experience"** — the tool a Host uses to
   create a **lesson**. This is deeply embedded in shipped UI copy and `docs/REQUIRED_FEATURES.md`.
2. `public.experiences` (migration `0015`) — a small, static, cross-church **catalog of "quest
   experience types"** (e.g., "3D Quest") that a lesson can be tagged with via `lesson_experiences`.
   Already has a real `Experience` TypeScript interface and `services/supabase/experiences.ts`.

Phase 10 introduces a **third** meaning: "Experience" = a scheduled, church-owned discipleship
activity (event/gathering/service project) with registration and attendance. This is the
product's actual intended term (per this phase's brief) and — encouragingly — it aligns with
something already latent in the schema: `lesson_journeys.current_stage` already has an
`'experienced'` stage value, and `docs/REGRESSION_CHECKLIST.md` already states "Mark Study
Complete advances `current_stage` only to `experienced`, never further" — i.e., the real Journey
was already designed assuming something would eventually *complete* that stage. Phase 10's
Experience system is very likely exactly that something.

The recommendation (detailed in §21/decision log) is: keep "Experience" as the **product-facing**
term throughout (matches this phase's brief), but give every new **database table**, **TypeScript
type**, and **service module** a distinguishing prefix (`church_experience*` / `ChurchExperience*`)
so nothing collides with the existing catalog — mirroring this codebase's own established
"Published" prefix convention (used repeatedly in Phases 6–7 for the same reason). The
`experience-builder` (lesson-creation) naming collision is a **product/UX decision**, not a code
one — flagged for the owner in §29/§30, not resolved unilaterally here.

## 2. Repository audit — Experience-adjacent code

Repo-wide search for `registration|capacity|waitlist|attendance|check-in` across `*.ts,*.tsx,*.sql`
returned exactly one real hit family: `events.expected_attendance` (a plain integer field on the
Host-an-Event *request form* — not a real attendance system, never read back anywhere). **No
registration, capacity, waitlist, or check-in concept exists anywhere in this repository.**

### What already exists and is production-backed (real Supabase)

| Item | Where | Relevance to Phase 10 |
|---|---|---|
| `public.experiences` + `lesson_experiences` (migration `0015`) | Table + `services/supabase/experiences.ts` | **Naming collision only** — an unrelated static catalog. Do not touch, do not reuse the table name. |
| `public.events` (migration `0020`) | Table + `services/supabase/events.ts` + `/events`, `/events/[id]`, `/events/host`, `/admin/events` | **Strongest structural precedent**: church-scoped-or-platform-wide (`church_id` nullable), `starts_at`/`ends_at` as plain `timestamptz` with **no timezone metadata column anywhere**, single-table status lifecycle, admin-only status transitions. No occurrences, no registrations, no capacity — Phase 10 is a superset in complexity, not a copy. |
| `public.lesson_journeys` / `public.lesson_journey_items` (migration `0008`) | Table + `services/supabase/journeys.ts` + `/journey/[lessonId]/studied` | The **real** Journey system (partially). `current_stage` CHECK constraint already spans all 5 stage names (`captured, studied, experienced, applied, added-to-story`), but only `studied` is genuinely wired to real data today. Strictly member-owned RLS, no host/admin read policy by design ("hosts must not automatically gain access to private member progress" — `docs/REQUIRED_FEATURES.md`). |
| `public.testimonies` (migration `0018`) | Table + `services/supabase/testimonies.ts` | Best precedent for **trigger-enforced completion gating**: `testimonies_before_insert` raises an exception unless `lesson_journeys.studied_completed_at is not null` for every referenced lesson. Directly reusable pattern for "you can only register for/complete an Experience tied to a lesson you've studied" if that rule is ever wanted. Also the best precedent for **two independent status columns owned by different roles**, enforced by a `protect_*_status_columns` trigger. |
| `private.is_church_manager(church_id)` (migration `0003`) | SECURITY DEFINER SQL function | The universal church-scoped RLS gate used by every church-owned table in this schema. Its `is_platform_admin` branch ignores its own argument, so it resolves correctly for both "manager of this church" and "any platform admin" — reused by `lessons`, `lesson_requests`, `testimonies`, `events`, `church_memberships`. **Phase 10 should reuse this directly, not invent a parallel check.** |
| `lib/lessonAuth.ts`'s `hasChurchEditAccess(role)` | UX-layer mirror of `is_church_manager` | Reusable pattern for server actions' fast-fail check (RLS is still the real gate). |
| `lib/adminAuth.ts` (`requirePlatformAdmin`, `getPlatformAdminGate`) | Shared admin gate | Reusable if/when a platform-wide Experience moderation surface is ever needed (not in Phase 10's scope). |
| `lib/lessonThumbnail.ts`, `lib/lessonDocument.ts`, `lib/utils.ts`'s `sanitizeFileName` | Storage upload pipeline | Directly reusable pattern for an Experience cover-image upload (same shape: sanitize filename, church/entity-scoped Storage path, `next.config.ts`'s already-whitelisted Supabase Storage `remotePattern`). |
| `getMyHostChurches()` (`services/supabase/churches.ts`) + the `churches[0]` convention | Every `/host-dashboard/*` page, `/experience-builder`, `/events/host` | The established (imperfect, acknowledged) single-church-selection pattern — see §4/§29 for how Phase 10 should follow it without making the multi-church problem worse. |
| `tests/rlsChurchIsolation.test.ts` | Static per-migration RLS-policy-text parser, 79 tests | Reusable test harness shape — new Experience tables should get equivalent entries, not a new test file pattern. |

### What is mock/demo-only (no real backing)

| Item | Where | Relevance |
|---|---|---|
| `services/journeyService.ts`, `services/testimonyService.ts` (mock), `services/storyService.ts` | `app/journey/[lessonId]/{applied,experienced,added-to-story}/page.tsx`, `app/dashboard`, `app/badges`, `app/notifications`, `app/profile`, `app/contribute`, `app/leaderboard` | The **entire** `experienced`/`applied`/`added-to-story` Journey stage UI is still mock, localStorage-backed, and explicitly deferred for "a later member-journey phase" (confirmed again in Phase 9.5). Phase 10 must not rebuild these pages; it only needs to design the data Phase 12 will eventually consume (§16). |
| `services/notificationService.ts` (mock) | Sidebar/TopBar unread badge, `/notifications` | No real notification delivery system exists at all. Any "notify the promoted waitlist member" behavior in Phase 10 has nothing real to plug into yet — must be explicitly deferred, not faked. |

### Incomplete / partially-built, relevant to Phase 10

- **`public.ministries`** (migration `0001`) has no owner/leader concept whatsoever — just
  `id, church_id, name`. There is no "ministry leader" role anywhere in the schema or app.
  `church_memberships.role` is a hard `CHECK (role in ('member', 'host', 'admin'))` — three values,
  nothing else. A "ministry leader" role does not exist today and is out of scope to invent in
  Phase 10 (§4).
- **No timezone field exists anywhere in the schema** — not on `churches`, not on `lessons.date`
  (a bare `date`, no time-of-day at all), not on `events.starts_at/ends_at` (`timestamptz`, UTC
  under the hood, but no IANA zone name stored to know how to *display* it correctly for
  daylight-saving-aware local time). Phase 10 will be the **first** feature to need real
  timezone-aware scheduling display (§9).
- **Multi-church hosts are already a known, documented gap** (`docs/PHASE1_AUDIT.md`): every
  `/host-dashboard/*` page (and `/experience-builder`, `/events/host`) calls `getMyHostChurches()`
  (which correctly returns *every* church a host manages) and then just takes `churches[0]`.
  Fixing this globally is out of scope for Phase 10, but Phase 10's new code must not add a
  *fourth* independent occurrence of this same shortcut in a way that makes a future fix harder
  (§4, §29).

### Naming/schema conflicts to actively avoid

1. Do not name a new table `experiences` or `experience_occurrences` — `public.experiences`
   already exists and means something unrelated.
2. Do not name a new TypeScript type `Experience`, `ExperienceOccurrence`, etc. bare — `Experience`
   already exists in `types/index.ts` and means the catalog-tag shape.
3. Do not add a file at `services/supabase/experiences.ts` — already taken.
4. Do not confuse `/experience-builder` (lesson creation) with the new Experience feature's routes
   in either code or user-facing copy without a clear disambiguating label (§6, §29).

### Technical debt noted, not fixed here (out of scope for Phase 10A)

- `components/lessons/LessonCard.tsx` is fully orphaned (flagged in Phase 9.5, not deleted).
- The mock `SessionContext` and real Supabase auth continue to coexist (Phase 9.5 finding,
  unrelated to Phase 10 except that Phase 10 must be built entirely on the **real** Supabase auth
  side, matching `/host-dashboard`/`/lessons`/`/admin`, not the mock side).

## 3. Product definition

An **Experience** is a reusable definition of an actionable discipleship opportunity owned by a
church (optionally tagged to a ministry), which can be scheduled as one or more **occurrences**
that members **register** for, **attend**, and **complete**.

## 4. Terminology

| Term | Meaning in this spec | Collision risk |
|---|---|---|
| Experience (product term) | A church's reusable activity definition (this phase's new concept) | Collides in plain English with the two existing meanings above — always say "Experience" the discipleship-activity sense in this doc; disambiguated in code via `ChurchExperience*`/`church_experience*` naming. |
| Occurrence | One scheduled instance of an Experience | No collision. |
| Registration | A member's request to attend an occurrence | No collision. |
| Experience catalog / catalog tag | The **existing**, unrelated `public.experiences` table | Never call this an "Experience" without the word "catalog" in this document, to keep the two apart. |
| Build Experience / Experience Builder | The **existing** lesson-creation tool and its nav label | Flagged as an unresolved product-naming question (§29), not renamed in Phase 10. |

## 5. User roles (as they exist today — no new role added)

Confirmed from `public.profiles.is_platform_admin` and `public.church_memberships.role
CHECK (role in ('member','host','admin'))`:

1. **Platform administrator** — `profiles.is_platform_admin = true`. Cross-church, gated by
   `lib/adminAuth.ts`.
2. **Church admin** — `church_memberships.role = 'admin'` for a given church.
3. **Church host** — `church_memberships.role = 'host'` for a given church. Today, host and admin
   are treated identically everywhere (`hasChurchEditAccess`/`is_church_manager` both accept
   either) — Phase 10 follows the same convention; there is no finer-grained host-vs-admin split
   anywhere in this codebase to inherit.
4. **Ministry leader** — **does not exist**. No role, no table linking a profile to a ministry as
   its leader. Explicitly out of scope to invent in Phase 10 (§29) — ministry-tagging an Experience
   is available to any church host/admin, same as ministry-tagging a lesson today.
5. **Member** — `church_memberships.role = 'member'`, or no membership row at all (a signed-in
   user with no church).
6. **Signed-out visitor** — no session.

## 6. Permissions matrix

All church-scoped actions gate on `private.is_church_manager(church_id)` (host or admin of *that*
church, or any platform admin) — never a bare "is this user a host anywhere" check.

| Action | Platform admin | Church host/admin (own church) | Member | Signed-out |
|---|---|---|---|---|
| Create Experience | ✅ (as any church, rare) | ✅ own church only | ❌ | ❌ |
| Edit Experience | ✅ | ✅ own church only | ❌ | ❌ |
| Publish/archive Experience | ✅ | ✅ own church only | ❌ | ❌ |
| Schedule/cancel occurrence | ✅ | ✅ own church only | ❌ | ❌ |
| Link Experience to lesson(s) | ✅ | ✅ own church only | ❌ | ❌ |
| View registrations list | ✅ | ✅ own church only | ❌ (only their own) | ❌ |
| Approve/reject registration | ✅ | ✅ own church only | ❌ | ❌ |
| Take attendance | ✅ | ✅ own church only | ❌ | ❌ |
| Mark completion | ✅ | ✅ own church only | ❌ (self-attested case only, §16) | ❌ |
| View a registrant's private notes | ✅ | ✅ own church only | own notes only | ❌ |
| Register for an occurrence | — | ✅ (as a member, if also a member) | ✅ | ❌ (must sign in) |
| Cancel own registration | — | ✅ | ✅ | ❌ |
| View a `church_only` Experience | ✅ | ✅ own church | ✅ if member of that church | ❌ |
| View a `published`, non-`church_only` Experience | ✅ | ✅ | ✅ | see §8 (signed-out workflow) |

## 7. Domain model

### A. Experience definition

Reusable, church-owned. See proposed table `church_experiences`, §10.

### B. Experience occurrence

A scheduled instance. **Recommendation: separate objects, not one merged table** (see decision
log §30 — this mirrors the existing `lessons` vs. `lesson_hosts` split and `events`' own
simplicity is exactly *because* it never needed recurring/multiple scheduled instances of the same
definition; Phase 10 explicitly does).

### C. Lesson relationships

**Recommendation: a join table**, `church_experience_lessons`, mirroring `lesson_experiences`'/
`lesson_ministries`' existing shape exactly (many-to-many, `unique(experience_id, lesson_id)`,
`relationship` required/recommended, `sort_order`, `host_notes`, optional
`reflection_prompt_override`). Never a single `lesson_id` column on the Experience.

### D. Registrations

One row per (occurrence, member). See `church_experience_registrations`, §10. Status vocabulary
exactly as suggested in the brief: `pending | confirmed | waitlisted | cancelled | rejected`;
attendance `not_recorded | attended | absent | excused`; completion `not_started | completed` —
**`disputed`/`revoked` deliberately omitted from v1** (adding a CHECK-constraint value later is a
one-line additive migration; no reason to carry unused states now — "do not overcomplicate v1").

### E. Journey connection

**What Phase 10 records:** attendance and completion status on
`church_experience_registrations`, and the Experience↔lesson link on
`church_experience_lessons`. That's the complete surface Phase 10 owns.

**What Phase 12 will consume:** a future service/trigger that, given a member's `attended`/
`completed` registration for an occurrence whose Experience is linked to a lesson the member has
an existing `lesson_journeys` row for (`current_stage = 'studied'`, `studied_completed_at is not
null`), advances `current_stage` to `'experienced'`. This is **exactly** the gap
`docs/REGRESSION_CHECKLIST.md` already describes ("Mark Study Complete advances `current_stage`
only to `experienced`, never further").

**Phase 10 does not write to `lesson_journeys` at all.** Reasons: (1) the brief explicitly says
"must not fully rebuild the Journey yet unless a minimal integration is essential" and no
integration is essential for Phase 10's own CRUD/registration/attendance goals to work; (2) CLAUDE.md's
explicit rule against modifying Journey routes/tables more than necessary; (3) keeping the write
boundary clean means Phase 12 can design the *exact* advancement rule (e.g., does one attended
Experience suffice, or must every `required`-relationship Experience linked to the lesson be
attended?) without Phase 10 having already guessed wrong and left a half-right trigger to unwind.

**Self-guided Experiences (`format = 'self_guided'`):** completion is self-attested by the member
(no host action required) — this is why `completion_method` is a column on the Experience
definition (`host_marked` vs `self_attested`), not inferred from `format` at read time, since a
church might want an in-person gathering to also be self-attested (e.g., a prayer walk with no
formal check-in).

**Host approval requirement:** governed by `church_experiences.approval_required` — if true, new
registrations start at `pending` and a host must move them to `confirmed`/`rejected`; if false,
registrations that pass capacity go straight to `confirmed` (or `waitlisted` if full).

## 8. Signed-out workflow

**Recommendation: signed-out visitors see nothing** — no public Experience discovery in Phase 10.
Reasoning: `visibility = 'public'` is explicitly marked "future-compatible" in the brief itself,
`church_only`/`invited_only` are the only two visibilities Phase 10 actually needs to serve real
church members, and there is no precedent anywhere in this app for anonymous-visible,
per-church-scoped content that isn't already fully public by definition (churches/lessons list are
public because *all* published lessons are meant to be discoverable; Experiences are explicitly
church-internal discipleship activities, not marketing content). `/experiences` for a signed-out
visitor should behave like `/dashboard`/`/my-journey` do today: redirect to `/login` (or show a
sign-in prompt), not a 404 and not a public list. `visibility = 'public'` and cross-church
discovery are explicitly future work (§21).

## 9. Timezone design

No timezone field exists anywhere in this schema today (verified — see §2). Recommendation:

- **Storage**: `starts_at`/`ends_at` as `timestamptz` (matches `events.starts_at/ends_at`
  exactly) — Postgres stores this as UTC internally regardless of session timezone, satisfying
  "prefer UTC storage" with zero new column needed for the instant-in-time itself.
- **New column, `churches.timezone`** (`text`, IANA name, e.g. `'America/Chicago'`), nullable,
  defaulting to `null` (a church that hasn't set one yet) — used only as a **default to pre-fill**
  a new occurrence's timezone field in the Host UI, never read directly for display.
- **New column, `church_experience_occurrences.timezone`** (`text` **not null**, IANA name) — the
  single source of truth for how to *display* that occurrence's `starts_at`/`ends_at` to anyone
  viewing it. Stored per-occurrence (not inherited live from the church) so: (a) a later change to
  a church's default timezone never silently re-displays historical occurrences at the wrong local
  time, and (b) a specific occurrence (e.g., a joint online gathering coordinated with a
  different-timezone partner church) can explicitly differ.
- **Display**: always render via the occurrence's stored IANA name (e.g.
  `date.toLocaleString("en-US", { timeZone: occurrence.timezone, ... })`), never the visitor's
  browser-local timezone by default — a member should see "7:00 PM Central," not a value that
  silently shifts depending on who's looking.
- **Daylight saving**: handled automatically by using a real IANA zone name (not a fixed UTC
  offset) — this is exactly why an offset-only column would be wrong and an IANA name is required.
- **Date-only vs. timestamp**: occurrences always need a specific time (`starts_at` is never
  date-only, unlike `lessons.date`, which has no time-of-day at all) — this is a deliberate
  divergence from `lessons.date`'s shape, not an oversight; a "recurring all-day event" is not a
  Phase 10 use case (§13 — recurrence is off-hours specific occurrences only).

## 10. Proposed schema

Every new table is prefixed `church_experience*` to avoid the naming collisions in §2/§4. This is
a **proposal for review**, not a finalized migration — exact column list may be adjusted during
Phase 10.1's implementation based on final approval of this spec.

```sql
-- New column on an existing table (timezone default, see §9)
alter table public.churches add column timezone text;

-- ---------------------------------------------------------------------------
-- church_experiences -- the reusable Experience definition.
-- ---------------------------------------------------------------------------
create table public.church_experiences (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  ministry_id uuid references public.ministries (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  title text not null,
  summary text,
  full_description text,
  type text not null check (type in (
    'volunteer', 'outreach', 'prayer_gathering', 'worship_gathering', 'small_group',
    'bible_study', 'service_project', 'community_event', 'online_gathering', 'custom'
  )),
  custom_type_label text,
  format text not null check (format in ('in_person', 'online', 'hybrid', 'self_guided')),
  location_name text,
  address_line1 text,
  city text,
  region text,
  country text,
  online_url text,
  cover_image_url text,
  age_guidance text,
  accessibility_notes text,
  preparation_instructions text,
  what_to_bring text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  visibility text not null default 'church_only' check (visibility in ('church_only', 'invited_only', 'public')),
  registration_required boolean not null default true,
  approval_required boolean not null default false,
  default_capacity integer,
  default_duration_minutes integer,
  completion_method text not null default 'host_marked' check (completion_method in ('host_marked', 'self_attested')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  archived_at timestamptz,
  constraint church_experiences_custom_type_label_check
    check (type <> 'custom' or custom_type_label is not null)
);

create index church_experiences_church_id_idx on public.church_experiences (church_id);
create index church_experiences_ministry_id_idx on public.church_experiences (ministry_id);

-- ---------------------------------------------------------------------------
-- church_experience_occurrences -- one scheduled instance.
-- church_id is denormalized here exactly like lesson_hosts.church_id alongside lesson_id
-- (0001_tables.sql) -- simplifies RLS/index without a join back through church_experiences.
-- ---------------------------------------------------------------------------
create table public.church_experience_occurrences (
  id uuid primary key default gen_random_uuid(),
  experience_id uuid not null references public.church_experiences (id) on delete cascade,
  church_id uuid not null references public.churches (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz,
  timezone text not null,
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  capacity integer,
  location_name text,
  online_url text,
  host_contact_name text,
  host_contact_email text,
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled', 'completed')),
  cancellation_reason text,
  check_in_enabled boolean not null default false,
  attendance_finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index church_experience_occurrences_experience_id_idx on public.church_experience_occurrences (experience_id);
create index church_experience_occurrences_church_id_idx on public.church_experience_occurrences (church_id);
create index church_experience_occurrences_starts_at_idx on public.church_experience_occurrences (starts_at);

-- ---------------------------------------------------------------------------
-- church_experience_lessons -- join table, mirrors lesson_experiences' shape exactly.
-- ---------------------------------------------------------------------------
create table public.church_experience_lessons (
  id uuid primary key default gen_random_uuid(),
  experience_id uuid not null references public.church_experiences (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  relationship text not null default 'recommended' check (relationship in ('required', 'recommended')),
  sort_order integer not null default 0,
  host_notes text,
  reflection_prompt_override text,
  created_at timestamptz not null default now(),
  unique (experience_id, lesson_id)
);

create index church_experience_lessons_experience_id_idx on public.church_experience_lessons (experience_id);
create index church_experience_lessons_lesson_id_idx on public.church_experience_lessons (lesson_id);

-- ---------------------------------------------------------------------------
-- church_experience_registrations -- one row per (occurrence, member).
-- ---------------------------------------------------------------------------
create table public.church_experience_registrations (
  id uuid primary key default gen_random_uuid(),
  occurrence_id uuid not null references public.church_experience_occurrences (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'waitlisted', 'cancelled', 'rejected')),
  waitlist_position integer,
  attendance_status text not null default 'not_recorded' check (attendance_status in ('not_recorded', 'attended', 'absent', 'excused')),
  completion_status text not null default 'not_started' check (completion_status in ('not_started', 'completed')),
  notes text,
  cancellation_reason text,
  registered_at timestamptz not null default now(),
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (occurrence_id, profile_id)
);

create index church_experience_registrations_occurrence_id_idx on public.church_experience_registrations (occurrence_id);
create index church_experience_registrations_profile_id_idx on public.church_experience_registrations (profile_id);
```

## 11. Table relationships

```
churches ──< church_experiences >── ministries (optional)
church_experiences ──< church_experience_occurrences
church_experiences ──< church_experience_lessons >── lessons
church_experience_occurrences ──< church_experience_registrations >── profiles
```

- `church_experiences.church_id` → `churches.id` (cascade delete — an Experience cannot outlive
  its church, matching every other church-owned table's convention).
- `church_experiences.ministry_id` → `ministries.id` (set null — losing a ministry tag doesn't
  destroy the Experience, matching `lessons.speaker_id`'s `on delete set null` convention).
- `church_experience_occurrences.experience_id` → cascade (an occurrence cannot outlive its
  definition).
- `church_experience_lessons` → cascade both directions (pure join row, no independent meaning).
- `church_experience_registrations.occurrence_id` → cascade (a registration cannot outlive its
  occurrence — see §20 for why cancelling/archiving instead uses status, not deletion, at the
  *occurrence* and *Experience* level; the registration row itself only disappears if the
  occurrence itself is hard-deleted, which this design never does in normal operation).

## 12. Constraints and indexes

- `church_experiences_custom_type_label_check` — `type = 'custom'` requires `custom_type_label`
  (mirrors the existing `events.category`-style CHECK pattern of enforcing data shape at the
  database, not just the form).
- `unique(experience_id, lesson_id)` on the join table — prevents duplicate lesson links (same
  shape as `lesson_experiences.unique(lesson_id, experience_id)`).
- `unique(occurrence_id, profile_id)` on registrations — the **first line of duplicate-registration
  defense**, enforced at the database level, not just checked in application code.
- Indexes on every foreign key used in an RLS policy or a common list-view filter
  (`church_id`, `experience_id`, `occurrence_id`, `profile_id`, `starts_at` for "upcoming"
  queries) — matches this schema's existing indexing convention (`0002_indexes.sql` did the same
  retroactively for Phase 1's tables).
- **Capacity is explicitly not a CHECK constraint** — a `CHECK` cannot count sibling rows, so
  capacity enforcement must be a `SECURITY DEFINER` RPC function, not a table constraint (§14/§18).

## 13. RLS design

Every table's read/write policy reuses `private.is_church_manager(church_id)` exactly like
`lessons`/`lesson_requests`/`testimonies`/`events` already do:

```sql
alter table public.church_experiences enable row level security;
alter table public.church_experience_occurrences enable row level security;
alter table public.church_experience_lessons enable row level security;
alter table public.church_experience_registrations enable row level security;

-- church_experiences: publicly readable once published+church_only-or-better *to a member of
-- that church*; always readable by the managing church/admin (draft included).
create policy "church_experiences_select_published_or_managed"
  on public.church_experiences for select
  to authenticated
  using (
    private.is_church_manager(church_id)
    or (
      status = 'published'
      and exists (select 1 from public.church_memberships cm where cm.church_id = church_experiences.church_id and cm.profile_id = auth.uid())
    )
  );
-- (visibility='public' future-compatible branch intentionally omitted from v1 -- see §8/§21)

create policy "church_experiences_write_managed"
  on public.church_experiences for all
  to authenticated
  using (private.is_church_manager(church_id))
  with check (private.is_church_manager(church_id));

-- church_experience_occurrences: follows the parent Experience's visibility, same shape as
-- episode_characters/episode_lessons following their parent episode (0019_story_engine.sql).
create policy "church_experience_occurrences_select_follows_experience"
  on public.church_experience_occurrences for select
  to authenticated
  using (
    exists (
      select 1 from public.church_experiences e
      where e.id = church_experience_occurrences.experience_id
        and (
          private.is_church_manager(e.church_id)
          or (e.status = 'published' and exists (
            select 1 from public.church_memberships cm where cm.church_id = e.church_id and cm.profile_id = auth.uid()
          ))
        )
    )
  );

create policy "church_experience_occurrences_write_managed"
  on public.church_experience_occurrences for all
  to authenticated
  using (private.is_church_manager(church_id))
  with check (private.is_church_manager(church_id));

-- church_experience_lessons: readable by anyone who can already read the lesson OR the Experience
-- (same "follows the parent" pattern as lesson_experiences); write is host/admin of the Experience's
-- church only.
create policy "church_experience_lessons_select_follows_parents"
  on public.church_experience_lessons for select
  to authenticated
  using (
    exists (select 1 from public.church_experiences e where e.id = church_experience_lessons.experience_id and private.is_church_manager(e.church_id))
    or exists (select 1 from public.lessons l where l.id = church_experience_lessons.lesson_id and l.status = 'published')
  );

create policy "church_experience_lessons_write_managed"
  on public.church_experience_lessons for all
  to authenticated
  using (exists (select 1 from public.church_experiences e where e.id = church_experience_lessons.experience_id and private.is_church_manager(e.church_id)))
  with check (exists (select 1 from public.church_experiences e where e.id = church_experience_lessons.experience_id and private.is_church_manager(e.church_id)));

-- church_experience_registrations: a member sees only their own row; a host/admin sees every
-- registration for occurrences belonging to their church (exact shape of
-- profiles_select_managed_church_members, 0012).
create policy "church_experience_registrations_select_own"
  on public.church_experience_registrations for select
  to authenticated
  using (profile_id = auth.uid());

create policy "church_experience_registrations_select_managed"
  on public.church_experience_registrations for select
  to authenticated
  using (
    exists (
      select 1 from public.church_experience_occurrences o
      where o.id = church_experience_registrations.occurrence_id and private.is_church_manager(o.church_id)
    )
  );

-- Direct INSERT is NOT granted -- registration/cancellation go through SECURITY DEFINER RPCs
-- (§14, §18) so capacity/waitlist logic is atomic and can't be bypassed by a raw insert. Hosts'
-- write access (approve/reject/attendance/completion) is a normal UPDATE policy, since those
-- actions don't have the same race condition.
create policy "church_experience_registrations_update_managed"
  on public.church_experience_registrations for update
  to authenticated
  using (exists (select 1 from public.church_experience_occurrences o where o.id = church_experience_registrations.occurrence_id and private.is_church_manager(o.church_id)))
  with check (exists (select 1 from public.church_experience_occurrences o where o.id = church_experience_registrations.occurrence_id and private.is_church_manager(o.church_id)));
```

No `using(true)` anywhere. `tests/rlsChurchIsolation.test.ts` gets a new section covering all
four tables (Phase 10.10, §12/testing strategy below).

## 14. Host workflows

1. **Create an Experience** — `/host-dashboard/experiences/new`. Draft by default.
2. **Save as draft** — default `status`; no occurrence required to save a draft.
3. **Link to lessons** — `church_experience_lessons` editor (mirrors `ExperienceConnectionSelector.tsx`'s existing lesson-builder UI shape, reused as a pattern, not the same component).
4. **Publish** — `status → 'published'`, stamps `published_at`. Requires: title, type (+
   `custom_type_label` if `custom`), format, and if `format` requires a location/URL, that field
   present — validated server-side in the action, not just the form.
5. **Schedule an occurrence** — `/host-dashboard/experiences/[experienceId]/schedule`. Requires
   `starts_at` + `timezone` at minimum (defaults `timezone` from `churches.timezone` if set).
6. **Review registrations** — `/host-dashboard/experiences/[experienceId]/registrations`, one
   list scoped to a selected occurrence.
7. **Approve/reject** (`approval_required = true` only) — moves `pending → confirmed` (triggers
   capacity/waitlist check via RPC, §18) or `pending → rejected`.
8. **Record attendance** — per-registrant `attendance_status` update, bulk "mark all confirmed as
   attended" convenience action.
9. **Finalize completion** — sets `completion_status = 'completed'` for `host_marked` Experiences;
   stamps `church_experience_occurrences.attendance_finalized_at` once done (locks further
   attendance edits from becoming silently stale — a soft convention, not a hard block, in v1).
10. **Cancel an occurrence** — `status → 'cancelled'` + `cancellation_reason`; registrations are
    **not** deleted (§20).
11. **Archive an Experience** — `status → 'archived'`, stamps `archived_at`. Does not cancel
    future occurrences automatically (§20 — explicit host decision either way is safer than an
    implicit cascade).
12. **Basic participation reporting** — `/host-dashboard/experiences/[experienceId]` overview tab
    (§19).

## 15. Member workflows

1. **Discover Experiences** — `/experiences`, filtered to the member's own church(es)
   (`church_memberships`), `status = 'published'`.
2. **Filter** — by `type`, `format`, `ministry_id`, linked lesson, and date range.
3. **View details** — `/experiences/[experienceId]`, shows all upcoming occurrences.
4. **Register** — via RPC (§18), immediate `confirmed` or `waitlisted`/`pending` depending on
   capacity/approval settings.
5. **Join a waitlist** — automatic outcome of registering into a full occurrence, not a separate
   action.
6. **Cancel registration** — any time before the occurrence's `status` becomes `completed`;
   triggers waitlist promotion if applicable (§18).
7. **View upcoming registrations** — `/my-experiences`.
8. **Attend/complete** — host-marked for most Experiences; self-attested button for
   `completion_method = 'self_attested'` ones, visible only after the occurrence's `starts_at` has
   passed.
9. **See completion reflected in the Journey** — **out of scope for Phase 10** (§7/E) — this is
   Phase 12's job once this data exists to consume.
10. **Continue to reflection** — out of scope, same reason.

## 16. Journey integration

Covered in full in §7/E. Summary: Phase 10 is a **producer** of attendance/completion facts;
Phase 12 is the **consumer** that writes to `lesson_journeys`. No `lesson_journeys` write occurs
in Phase 10.

## 17. UI routes and screens

Following the **existing** `/host-dashboard/*` convention (not a new `/church-management/*`
prefix, which does not exist anywhere in this app today):

### Member routes

| Route | Purpose | Roles | Key components/data |
|---|---|---|---|
| `/experiences` | Discover published Experiences at the member's church(es) | Member (signed-in only, §8) | Filter bar (type/format/ministry/lesson/date) + card grid. Loading: skeleton grid. Empty: "No Experiences yet" + link back to `/lessons`. Error: `ErrorState`. Mobile: stacked filters above single-column grid. Data: `getPublishedExperiencesForMember(churchIds)`. |
| `/experiences/[experienceId]` | Full detail + all upcoming occurrences + register action | Member, signed-in | Detail header, occurrence list, register button per occurrence (disabled/waitlist-labeled per capacity). Loading: skeleton. Empty (`no occurrences`): "Check back soon." Error: `ErrorState` or 404-equivalent if not visible under RLS. Data: `getExperienceById`, `getUpcomingOccurrences`. |
| `/my-experiences` | Member's own registrations, upcoming + past | Member, signed-in | Two sections (Upcoming / Past), cancel action on upcoming. Empty: "You haven't registered for anything yet" + link to `/experiences`. Data: `getMyRegistrations()`. |

`/experiences/[experienceId]/register` from the brief is **not recommended as a separate route** —
registration is a single RPC call from a button on the detail page (§6 instruction: "avoid
creating unnecessary pages when tabs or nested sections are more coherent"); a full page reload
for a one-click action adds friction with no benefit.

### Host routes (under the existing `/host-dashboard` prefix)

| Route | Purpose | Roles | Key components/data |
|---|---|---|---|
| `/host-dashboard/experiences` | List/manage this church's Experiences | Host/admin of that church | Table/card list with status pills, "New Experience" button. Empty: "Create your first Experience." Data: `getManagedExperiences(churchId)`. |
| `/host-dashboard/experiences/new` | Create form | Host/admin | Same field set as edit, saves as draft. |
| `/host-dashboard/experiences/[experienceId]` | Overview: summary, lesson links, occurrence list, basic reporting (§19) | Host/admin, own church | Tabs: Overview / Occurrences / Lessons — **not separate pages**, per the "avoid unnecessary pages" instruction. |
| `/host-dashboard/experiences/[experienceId]/edit` | Edit form | Host/admin | Reuses the create form component. |
| `/host-dashboard/experiences/[experienceId]/schedule` | Create/edit an occurrence | Host/admin | Occurrence form (starts_at, timezone, capacity override, etc.). |
| `/host-dashboard/experiences/[experienceId]/registrations` | Registration list for a selected occurrence, approve/reject | Host/admin | Occurrence picker + registrant table with status actions. |
| `/host-dashboard/experiences/[experienceId]/attendance` | Attendance/completion recording for a selected occurrence | Host/admin | Registrant table with attendance/completion toggles + bulk action. |

Every host page follows the existing `getMyHostChurches()` → `churches[0]` convention at the page
boundary (§4/§29) — **not** a new pattern — while every service function underneath takes an
explicit `churchId`/`experienceId` parameter, never assuming "the current host's only church," so
a future multi-church switcher only has to change the page-level selection, not any Experience
service function's signature.

## 18. Scheduling and timezone design

Covered fully in §9. Recurrence approach: **Option A for v1** — individual, manually created
occurrences only. Reasoning: the brief's own instruction is "recommend the smallest reliable
option appropriate for the current platform," and this is a genuinely new subsystem with zero
existing recurrence infrastructure to build on (no cron/scheduled-function infra exists in this
repo at all — confirmed no `pg_cron`/Edge Function/Vercel Cron usage anywhere). Option B (simple
weekly/biweekly/monthly generation) is a reasonable **Phase 11+** follow-up once Option A's data
model has real usage to validate against; recommend generating a fixed batch of individual
`church_experience_occurrences` rows client/server-side at creation time (not a live RRULE
expansion) if/when that phase happens, to avoid ever needing runtime recurrence-rule evaluation.
Option C (full RRULE) is explicitly rejected as disproportionate ("do not implement full calendar
recurrence merely because it is technically possible").

## 19. Capacity and waitlist rules

**Capacity enforcement must happen server-side inside a transaction, never client-side and never
as a naive check-then-insert.** Recommendation: two `SECURITY DEFINER` RPC functions, matching
this codebase's existing `accept_church_invite` (migration `0011`) pattern for "a mutation with a
race condition that a plain RLS-gated INSERT/UPDATE can't safely express":

- **`register_for_experience_occurrence(p_occurrence_id uuid)`** — locks the occurrence row
  (`select ... for update`), re-validates `status = 'scheduled'` and the registration window
  (`registration_opens_at`/`registration_closes_at`, if set), counts existing `confirmed`
  registrations, and:
  - if under capacity (or capacity is `null` = unlimited) → insert `confirmed` (or `pending` if
    `approval_required`);
  - if at/over capacity → insert `waitlisted` with `waitlist_position = (select coalesce(max(waitlist_position), 0) + 1 from ... where status = 'waitlisted')`.
  - **Duplicate registration**: the `unique(occurrence_id, profile_id)` constraint is the hard
    backstop; the RPC checks first and raises a friendly error, matching `testimonies_before_insert`'s
    style of raising a clear exception rather than a raw constraint-violation message.
  - **Concurrent registrations**: the row lock on the occurrence serializes concurrent callers,
    so two simultaneous registrations for the last open seat can't both succeed as `confirmed`.
- **`cancel_experience_registration(p_registration_id uuid)`** — sets the caller's own row to
  `cancelled`; if the cancelled row was `confirmed`, locks the occurrence and promotes the
  earliest `waitlisted` row (lowest `waitlist_position`) to `confirmed` atomically in the same
  transaction. **Notifying** the promoted member is explicitly deferred (§2 — no real notification
  system exists to plug into; do not fake one).
- **Cancelled occurrences**: registrations are left as-is (still `confirmed`/`waitlisted`) but the
  UI treats a `cancelled`-occurrence's registrations as inert (no attendance/completion action
  available) — never auto-transitioned to `registrations.status = 'cancelled'`, since that would
  destroy the historical "who was actually signed up when it got cancelled" fact.
- **Walk-in/unregistered attendance**: v1 does **not** support marking attendance for someone with
  no registration row — the brief's rule list mentions it but a walk-in-attendance feature implies
  either a lightweight ad-hoc registration row (created by the host, `status = 'confirmed'`,
  `registered_at = now()`) or a separate walk-in concept; recommend the former (host can add a
  registration on the attendance screen, same table, no new concept) — flagged as v1-in-scope-but-
  minimal, not deferred, since it's just "host creates a registration row on someone else's
  behalf," which the existing RLS write policy (host/admin of that church) already permits without
  any new policy.

## 20. Data retention and auditability

Nothing is hard-deleted in normal operation. Every lifecycle event is a status change:

| Event | Behavior |
|---|---|
| Experience archived | `status = 'archived'`, `archived_at` stamped. Existing occurrences/registrations untouched — a host must explicitly cancel any still-`scheduled` occurrences separately (no implicit cascade, per §14/11). |
| Occurrence cancelled | `status = 'cancelled'` + `cancellation_reason`. Registrations untouched (see §19). |
| Registration cancelled | `status = 'cancelled'`, `cancelled_at` stamped, row retained (needed for reporting/future credits/audit). |
| Attendance corrected | Plain `UPDATE` on `attendance_status` by a host/admin — no separate audit log table in v1 (no equivalent exists for lesson/testimony edits either; `admin_moderation_log`, Phase 9, only covers **platform-admin** moderation actions, not host-level data corrections — consistent scope). |
| Member leaves a church (`church_memberships` row deleted) | Registration rows are **not** cascade-deleted (registrations reference `profiles`, not `church_memberships`) — history is preserved even if church affiliation changes later. |
| Lesson unpublished | `church_experience_lessons` join row is untouched (mirrors `lesson_experiences`' own behavior — an unpublished lesson simply stops being independently visible; its Experience link is a historical fact, not something to sever). |
| Church deactivated | Out of scope — no "deactivate a church" feature exists anywhere in this app today to hook into. |

No hard-delete path is added for any of these tables beyond the `on delete cascade` that already
exists structurally (e.g., deleting a church deletes its Experiences, exactly like deleting a
church already deletes its lessons today).

## 21. Reporting for v1

Minimal, per-occurrence and per-Experience only, computed live via query (no warehouse/rollup
table):

- Registrations per occurrence (count by status).
- Attendance count (`attended` count / confirmed count).
- Completion count.
- Capacity utilization (`confirmed count / capacity`, or "Unlimited").
- Cancellation/no-show count (`cancelled` registrations; `absent` attendance).
- Participation by linked lesson (join through `church_experience_lessons`).
- Participation by ministry (join through `church_experiences.ministry_id`).
- Upcoming occurrences list (church-wide, across all the church's Experiences).

Advanced reporting (trends over time, cross-church benchmarking, export) is explicitly future
work, not part of Phase 10.

## 22. Notifications: now vs. later

**Now (Phase 10 needs none beyond in-app state)**: registration confirmation is just the updated
UI state after the RPC call returns — no email/push needed for v1 to be usable.

**Later**: waitlist-promotion notification, registration-approved/rejected notification,
occurrence-cancelled notification, upcoming-occurrence reminder. All blocked on a real
notification delivery system existing at all (today `services/notificationService.ts` is
localStorage-mock only) — building real notifications is its own future phase, not something to
bolt onto Phase 10.

## 23. Future AI integration (ChatGPT)

Per this phase's explicit instruction, **no OpenAI code is added in Phase 10**. Extension point to
document, not build: a future centralized, server-side AI service layer (e.g.
`lib/ai/openaiClient.ts`, never called from client components, mirroring how
`SUPABASE_SERVICE_ROLE_KEY` is already server-only) could generate:
- Draft Experience descriptions from a short host prompt.
- Suggested reflection prompts per lesson↔Experience link (`reflection_prompt_override` already
  has a slot for this — designed now, populated later).
- Suggested Experience↔lesson pairings based on lesson content.

No schema change is needed to add this later — `full_description`, `reflection_prompt_override`,
etc. are already plain nullable text columns any future AI feature can fill in.

## 24. Future Credits integration

Per this phase's explicit instruction, no credit cost/reward logic or schema is added. Extension
points documented, not built: a credit cost on `church_experiences` (e.g., `credit_cost integer`)
and a credit reward on completion are both single-column additive migrations whenever Phase 4b
(already deferred, tracked in memory as its own future phase) is ready. No speculative column is
added now.

## 25. Future Square integration

Per this phase's explicit instruction and the existing `events.payment_status` precedent
(constrained so it can never lie about a payment that didn't happen), any future paid-registration
feature should follow the exact same honest-constraint pattern: a `payment_status` column
constrained to values that are actually reachable without live Square credentials, widened only
once real credentials exist (same as Phase 8's documented approach). Not built in Phase 10.

## 26. Testing strategy

| Area | Test type |
|---|---|
| RLS policies (no `using(true)`, correct `is_church_manager` reuse, church isolation) | Static analysis — extend `tests/rlsChurchIsolation.test.ts` with a `church_experience*` section, same pattern as every prior phase. |
| Database constraints (`unique(occurrence_id, profile_id)`, custom-type-label check) | Static analysis (grep the migration text) — same file. |
| `register_for_experience_occurrence`/`cancel_experience_registration` RPC logic (capacity, waitlist promotion, duplicate prevention, concurrency) | **Integration test against a real (local/test) Supabase instance** — cannot be meaningfully unit-tested without a real Postgres transaction; flagged as needing live credentials, same limitation Phase 9.5 documented for every real-Supabase-backed flow. |
| Experience CRUD, publishing, occurrence creation, lesson links | Manual QA + code review in this environment (no live credentials); integration tests once credentials exist. |
| Authorization (host of church A cannot manage church B's Experience) | RLS static analysis + manual QA once credentials exist. |
| Timezone display | Unit test on the pure display-formatting helper (no Supabase needed) — e.g. `tests/experienceTimezone.test.ts` using `node:test`, matching this repo's existing plain-function unit-test style (`tests/youtubeEmbed.test.ts` precedent). |
| Logged-out behavior (`/experiences` redirects to login) | Manual QA (dev server, HTTP-level, same limitation Phase 9.5 hit — no browser automation tool in this environment). |
| Church isolation, capacity, waitlist, cancellation, attendance end-to-end | **Manual QA / future browser automation** — explicitly deferred until either credentials or a browser tool exist in-session. |

## 27. Migration strategy

One migration per stage of `docs/PHASE10_IMPLEMENTATION_PLAN.md` (matching this repo's existing
one-migration-per-phase convention — never one giant migration), sequential numbering continuing
from `0021_admin_completion.sql` → `0022_church_experiences.sql`, `0023_...`, etc. Each migration
is additive only (new tables/columns), consistent with "never remove migrations" and "create new
sequential migrations for schema changes."

## 28. Rollback considerations

Every new table is independent of existing tables except for foreign keys *into* `churches`,
`ministries`, `lessons`, `profiles` (never the reverse) — so rolling back Phase 10 entirely (should
that ever be needed) means dropping four new tables and one new column
(`churches.timezone`), with zero impact on any existing table's data or behavior. No existing
table's column is altered, renamed, or dropped at any point in this design.

## 29. Risks and unresolved decisions requiring owner approval

1. **The "Experience" naming collision with `/experience-builder` (lesson creation)** — this spec
   resolves the *code-level* collision (distinct table/type names) but the *product-facing*
   collision (a Host will see both "Build Experience" in the nav and a new "Experiences" section)
   is unresolved and needs an explicit product decision: leave both, rename one, or add
   disambiguating copy (e.g., "Lessons" instead of "Build Experience" someday). **Not decided
   here.**
2. **Ministry leader role** — confirmed not to exist; Phase 10 proceeds without it (host/admin
   only). If the product actually needs finer-grained ministry-level ownership, that's a
   `church_memberships`-adjacent schema change bigger than Phase 10's scope.
3. **Multi-church hosts** — Phase 10 follows the existing `churches[0]` convention rather than
   fixing it, per explicit instruction that multi-church switching is a later phase. Confirm this
   is acceptable for a brand-new feature to inherit rather than being the first to fix it.
4. **Public/cross-church Experience discovery** — deliberately deferred (`visibility = 'public'`
   is schema-ready but unused in v1). Confirm no immediate product need before Phase 10 ships
   without it.
5. **Walk-in attendance** — recommended as "host creates a registration row," not a distinct
   concept; confirm this matches the intended UX before Phase 10.7 builds the attendance screen.

## 30. Recommended implementation sequence

See `docs/PHASE10_IMPLEMENTATION_PLAN.md` for the full stage breakdown (10.1–10.10).

## 31. Explicit out-of-scope list (Phase 10)

- Credits, badges, rewards (schema or logic).
- Any OpenAI/ChatGPT API call.
- Square/payment processing of any kind.
- Public, cross-church Experience discovery (`visibility = 'public'` unused).
- Recurrence beyond individually-created occurrences (Option B/C).
- Real notification delivery (email/push) for any Experience event.
- Any write to `lesson_journeys` (Phase 12's job).
- Rebuilding the mock `experienced`/`applied`/`added-to-story` Journey pages.
- A "ministry leader" role.
- Multi-church host switching.
- Fixing the pre-existing, unrelated `LessonCard.tsx` orphaned-file issue (Phase 9.5 finding).

## Documentation files created or updated

- **Created**: `docs/PHASE10_EXPERIENCE_PLATFORM_SPEC.md` (this file).
- **Created**: `docs/PHASE10_IMPLEMENTATION_PLAN.md`.
- **Not created** (none exist yet, and per Step 14's instruction not to invent extensive new docs
  beyond these two): `PROJECT_ROADMAP.md`, `PRODUCT_SPEC.md`, `ARCHITECTURE.md`, `CHANGELOG.md`.
  Recommend creating these as *living* documents once Phase 10 implementation actually begins
  (they'd be stale the moment they're written otherwise) — `ARCHITECTURE.md` in particular would
  benefit from being written after Phase 10.1's migration lands, not before.
- Recorded here per Step 14: **ChatGPT will be the platform's AI provider**, integrated through a
  centralized, server-side-only AI service layer in a later phase (§23). No OpenAI code exists or
  was added in Phase 10A.

## Decision log

| # | Decision | Alternatives considered | Recommendation | Reasoning | Future consequences |
|---|---|---|---|---|---|
| 1 | Definition vs. occurrence: **separate tables** | Single merged table (like `events`) | Separate | `events` works as one table only because it never needed multiple scheduled instances of the same definition; Phase 10 explicitly requires exactly that (brief: "do not treat these as the same object unless... compelling reason"). No compelling reason found. | Enables recurrence (§18) and per-occurrence overrides (capacity/location/timezone) without duplicating the whole definition. |
| 2 | Lesson relationship: **join table** (`church_experience_lessons`) | Single `lesson_id` column on the Experience | Join table | Brief explicitly requires evaluating this; existing `lesson_experiences`/`lesson_ministries` precedent is already a many-to-many join, not a single FK. An Experience realistically maps to multiple lessons (a service project might relate to several study topics). | Symmetric with existing join-table patterns; supports `required`/`recommended` + ordering + per-link notes without schema change later. |
| 3 | Registration model: **one row per (occurrence, member)**, status+attendance+completion as separate columns on the same row | Separate `attendance` table; single combined "status" field conflating registration/attendance/completion | One row, three status dimensions | Brief explicitly separates these into three vocabularies; conflating them (like `events.status` does for a totally different lifecycle) would make "confirmed but attendance not yet recorded" inexpressible. Splitting into a second table would require a join for every read with no isolation benefit (both are 1:1 with the registration, not independently created). | Three independent status transitions can be validated/updated independently without cross-table transactions except capacity/waitlist (§18, which already needs a transaction regardless). |
| 4 | Capacity enforcement: **SECURITY DEFINER RPC with row lock**, not a CHECK constraint or client-side check | Client-side count-then-insert; a `CHECK` constraint; a `BEFORE INSERT` trigger without locking | RPC with `select ... for update` | A `CHECK` constraint cannot count sibling rows. A trigger without an explicit lock has the same race condition as client-side checking (two concurrent transactions can both pass the count check before either commits). This repo already has exactly this pattern (`accept_church_invite`, migration `0011`) for a different race-prone mutation. | Registration/cancellation must go through the RPC, not a raw table insert — RLS deliberately does not grant direct `insert` on registrations (§13) to enforce this at the permission level, not just by convention. |
| 5 | Waitlist strategy: **FIFO by `waitlist_position`, promoted atomically inside the same cancellation transaction** | Manual host-triggered promotion; lottery/random selection | Automatic FIFO | Simplest deterministic rule that satisfies "do not overcomplicate v1"; matches the intuitive expectation of a waitlist. | Real notification of the promoted member is deferred (§22) — until real notifications exist, a promoted member only discovers their new status by revisiting `/my-experiences`, a known, accepted v1 limitation. |
| 6 | Recurrence scope: **Option A (manual occurrences only)** for v1 | Option B (simple weekly/biweekly/monthly generation); Option C (full RRULE) | Option A | Brief explicitly warns against building recurrence "merely because it is technically possible"; no recurrence infrastructure (cron/scheduled functions) exists anywhere in this repo to support B or C safely yet. | Option B is a reasonable, cheap follow-up (generate N individual rows at creation time, no live rule evaluation) once v1 has real usage data; C is not recommended even then. |
| 7 | Timezone storage: **UTC `timestamptz` + explicit IANA `timezone` text column per occurrence**, plus a new `churches.timezone` default | Store local wall-clock time + offset only; store only on the Experience, not per-occurrence | `timestamptz` + per-occurrence IANA name | No timezone field exists anywhere in this schema today (verified); an offset-only column can't handle daylight saving correctly, an IANA name can. Per-occurrence (not per-Experience) storage protects historical display accuracy if a church's default ever changes. | First timezone-aware feature in this codebase — the display helper built here (§9/§26) becomes the template for any future scheduling feature. |
| 8 | Attendance vs. completion: **two independent status columns**, not one | Single "completed" boolean inferred from attendance | Separate | Brief explicitly lists both vocabularies; a self-guided Experience can be "completed" with no formal attendance concept at all (`completion_method = 'self_attested'`), so conflating them would misrepresent self-guided completions as attendance records that never happened. | Directly enables the `completion_method` column's two branches (§7/E) without special-casing self-guided Experiences elsewhere in the schema. |
| 9 | Self-guided Experiences: **self-attested completion via `completion_method` column on the Experience**, not inferred from `format` | Infer completion method from `format = 'self_guided'` automatically | Explicit column | A church might want an in-person gathering to also be self-attested (e.g., a prayer walk with no check-in table) — `format` and `completion_method` are orthogonal concerns in practice. | Host UI must surface `completion_method` as its own field on the Experience form, not derive it silently from `format`. |
| 10 | Archival, never hard-delete | Hard-delete archived Experiences/cancelled occurrences after some retention period | Soft-delete via `status` everywhere | Brief explicitly requires this; this schema already has zero precedent for hard-deleting any content table (`lessons`, `testimonies`, `events` all use status columns, never row deletion, for exactly this reason — Journey/reporting/audit history). | Every future reporting/credit/audit feature can rely on historical rows always existing, never having been silently removed. |
| 11 | Single-church-host convention: **followed, not fixed** | Build real multi-church selection into Phase 10 now | Follow existing `churches[0]` pattern at the page layer only | Brief explicitly says multi-church switching is a later phase and Phase 10 "must not hardcode `churches[0]` into new architecture" — resolved by keeping the shortcut confined to the page component (matching every existing host page) while every Experience service function takes an explicit `churchId` parameter. | A future multi-church switcher changes only the page-level church selection; no Experience service/RPC signature needs to change. |

---

**Stop.** Phase 10A ends here. Do not begin Phase 10.1 implementation until this specification is
reviewed and approved.

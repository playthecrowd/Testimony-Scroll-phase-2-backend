-- Phase 10.1 (docs/PHASE10_EXPERIENCE_PLATFORM_SPEC.md, docs/PHASE10_IMPLEMENTATION_PLAN.md):
-- Experience Platform database foundation. Every new table is prefixed church_experience* to
-- avoid two real naming collisions already in this schema: public.experiences (0015, an unrelated
-- static catalog of "quest experience types") and app/experience-builder (the lesson-creation
-- tool's nav label, "Build Experience"). Neither is touched, renamed, or repurposed by this
-- migration -- see the spec's Executive Summary and Decision Log entry 1 (owner-approved
-- 2026-07-18) for the full reasoning.
--
-- Schema-only migration: no RPCs here (see 0023/0024), no application code reads/writes these
-- tables yet (Phase 10.1 is database-foundation-only, per this phase's explicit instructions).

-- ---------------------------------------------------------------------------
-- churches.timezone -- new default-prefill column (spec SS9, Decision Log entry 7). No timezone
-- field exists anywhere in this schema today (verified in Phase 10A's audit); this is the first.
-- Nullable: a church that hasn't set one yet simply has no default. Not read by any application
-- code yet -- occurrences always store their own authoritative timezone (below), independent of
-- this column, so a later change here never silently reinterprets a historical occurrence.
-- ---------------------------------------------------------------------------
alter table public.churches add column timezone text;

-- ---------------------------------------------------------------------------
-- church_experiences -- the reusable Experience definition. Church-owned, optionally
-- ministry-tagged (reuses the existing public.ministries table as-is -- owner decision 2 of 10,
-- 2026-07-18: no ministry-leader role or new ministries schema is introduced).
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
  -- 'public' is future-compatible only -- no RLS branch reads it yet (spec SS8, owner decision 4:
  -- church-scoped discovery only, no public/cross-church discovery in Phase 10).
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

create trigger church_experiences_set_updated_at
  before update on public.church_experiences
  for each row execute function public.set_updated_at(); -- defined in 0008_lesson_journeys.sql

-- ---------------------------------------------------------------------------
-- church_experience_occurrences -- one scheduled instance. Deliberately a separate table from
-- church_experiences (Decision Log entry 1) -- mirrors the existing lessons/lesson_hosts split.
-- church_id is denormalized here exactly like lesson_hosts.church_id alongside lesson_id
-- (0001_tables.sql) -- simplifies RLS/index without a join back through church_experiences.
-- ---------------------------------------------------------------------------
create table public.church_experience_occurrences (
  id uuid primary key default gen_random_uuid(),
  experience_id uuid not null references public.church_experiences (id) on delete cascade,
  church_id uuid not null references public.churches (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz,
  -- IANA zone name (e.g. 'America/Chicago'), not a fixed UTC offset -- required so display can
  -- correctly account for daylight saving. The authoritative source for how to *display*
  -- starts_at/ends_at; never re-derived from churches.timezone at read time (spec SS9).
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

create trigger church_experience_occurrences_set_updated_at
  before update on public.church_experience_occurrences
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- church_experience_lessons -- join table connecting an Experience to one or more lessons.
-- Mirrors lesson_experiences' shape exactly (0015_experiences_catalog.sql) -- many-to-many, never
-- a single lesson_id column on the Experience (Decision Log entry 2).
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
-- church_experience_registrations -- one row per (occurrence, member). Registration, attendance,
-- and completion are three independent status dimensions on the same row (Decision Log entry 3),
-- never conflated into one field.
--
-- registration_source distinguishes a member's own advance registration ('self') from a
-- host-recorded walk-in ('host_walk_in') -- owner decision 5 of 10, 2026-07-18. capacity_override
-- records when a host intentionally recorded a walk-in that pushed an occurrence over its
-- capacity (see record_experience_walk_in, 0024) -- both columns exist specifically so a walk-in
-- is auditable/reportable, never silently indistinguishable from a normal registration.
--
-- No direct INSERT grant is given below -- every insert (self-registration, walk-in) goes through
-- a SECURITY DEFINER RPC (0023/0024) so capacity/waitlist/membership checks are atomic and can't
-- be bypassed by a raw client insert (Decision Log entry 4).
-- ---------------------------------------------------------------------------
create table public.church_experience_registrations (
  id uuid primary key default gen_random_uuid(),
  occurrence_id uuid not null references public.church_experience_occurrences (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'waitlisted', 'cancelled', 'rejected')),
  registration_source text not null default 'self' check (registration_source in ('self', 'host_walk_in')),
  capacity_override boolean not null default false,
  waitlist_position integer,
  attendance_status text not null default 'not_recorded' check (attendance_status in ('not_recorded', 'attended', 'absent', 'excused')),
  -- 'disputed'/'revoked' deliberately omitted from v1 -- do not overcomplicate v1 (spec SS7/D).
  -- Adding a CHECK-constraint value later is a one-line additive migration if ever needed.
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

create trigger church_experience_registrations_set_updated_at
  before update on public.church_experience_registrations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS -- every policy reuses private.is_church_manager(church_id) exactly like
-- lessons/lesson_requests/testimonies/events already do. No using(true) anywhere. Church selection
-- is never hardcoded here -- every policy takes the row's own church_id (directly or via a join),
-- never assumes "the caller's only church" (owner decision 3 of 10, 2026-07-18).
-- ---------------------------------------------------------------------------
alter table public.church_experiences enable row level security;
alter table public.church_experience_occurrences enable row level security;
alter table public.church_experience_lessons enable row level security;
alter table public.church_experience_registrations enable row level security;

grant select, insert, update on public.church_experiences to authenticated;
grant select, insert, update on public.church_experience_occurrences to authenticated;
grant select, insert, update, delete on public.church_experience_lessons to authenticated;
-- Deliberately no insert grant -- see the table comment above. Update covers host/admin actions
-- (approve/reject, attendance, completion); insert only ever happens via a SECURITY DEFINER RPC.
grant select, update on public.church_experience_registrations to authenticated;

-- church_experiences: a church's own host/admin (or any platform admin, via is_church_manager's
-- admin branch) always sees every row including drafts; any member of that church sees it once
-- published.
create policy "church_experiences_select_published_or_managed"
  on public.church_experiences for select
  to authenticated
  using (
    private.is_church_manager(church_id)
    or (
      status = 'published'
      and exists (
        select 1 from public.church_memberships cm
        where cm.church_id = church_experiences.church_id and cm.profile_id = auth.uid()
      )
    )
  );

create policy "church_experiences_write_managed"
  on public.church_experiences for all
  to authenticated
  using (private.is_church_manager(church_id))
  with check (private.is_church_manager(church_id));

-- church_experience_occurrences: follows the parent Experience's visibility, same "follows the
-- parent" shape as episode_characters/episode_lessons following their parent episode
-- (0019_story_engine.sql).
create policy "church_experience_occurrences_select_follows_experience"
  on public.church_experience_occurrences for select
  to authenticated
  using (
    exists (
      select 1 from public.church_experiences e
      where e.id = church_experience_occurrences.experience_id
        and (
          private.is_church_manager(e.church_id)
          or (
            e.status = 'published'
            and exists (
              select 1 from public.church_memberships cm
              where cm.church_id = e.church_id and cm.profile_id = auth.uid()
            )
          )
        )
    )
  );

create policy "church_experience_occurrences_write_managed"
  on public.church_experience_occurrences for all
  to authenticated
  using (private.is_church_manager(church_id))
  with check (private.is_church_manager(church_id));

-- church_experience_lessons: readable by anyone who can already read the parent Experience (host/
-- admin, or a church member once published) or the linked lesson (once published); write is
-- host/admin of the Experience's church only.
create policy "church_experience_lessons_select_follows_parents"
  on public.church_experience_lessons for select
  to authenticated
  using (
    exists (
      select 1 from public.church_experiences e
      where e.id = church_experience_lessons.experience_id
        and (
          private.is_church_manager(e.church_id)
          or (
            e.status = 'published'
            and exists (
              select 1 from public.church_memberships cm
              where cm.church_id = e.church_id and cm.profile_id = auth.uid()
            )
          )
        )
    )
    or exists (select 1 from public.lessons l where l.id = church_experience_lessons.lesson_id and l.status = 'published')
  );

create policy "church_experience_lessons_write_managed"
  on public.church_experience_lessons for all
  to authenticated
  using (exists (select 1 from public.church_experiences e where e.id = church_experience_lessons.experience_id and private.is_church_manager(e.church_id)))
  with check (exists (select 1 from public.church_experiences e where e.id = church_experience_lessons.experience_id and private.is_church_manager(e.church_id)));

-- church_experience_registrations: a member sees only their own row; a host/admin sees every
-- registration for occurrences belonging to a church they manage (exact shape of
-- profiles_select_managed_church_members, 0012_church_members_profile_read.sql).
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

create policy "church_experience_registrations_update_managed"
  on public.church_experience_registrations for update
  to authenticated
  using (
    exists (
      select 1 from public.church_experience_occurrences o
      where o.id = church_experience_registrations.occurrence_id and private.is_church_manager(o.church_id)
    )
  )
  with check (
    exists (
      select 1 from public.church_experience_occurrences o
      where o.id = church_experience_registrations.occurrence_id and private.is_church_manager(o.church_id)
    )
  );

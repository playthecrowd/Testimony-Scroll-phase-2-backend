-- Phase 11.3 (docs/PHASE11_ECONOMY_PROGRESSION_SPEC.md SS11-SS17, docs/PHASE11_3_AUDIT.md):
-- Points, XP, Levels, Badges, and Trophies database foundation. Schema/RLS/seed data only; the
-- award-processing RPC and the real triggers that call it live in 0033, mirroring the
-- 0027/0028 and 0029/0030 schema-then-RPC split from earlier Phase 11 stages.
--
-- Points and XP are kept as independent columns (owner-approved, spec SS34.1/SS35 entry 11) --
-- Points is the lifetime, non-spendable ranking score; XP only ever feeds Level. Trophies are a
-- Badge category (spec SS15/SS35 entry 3), not a separate table. Fixed event types and a
-- database-backed award-definitions table, never an open rule engine (spec SS11/SS12, explicit
-- brief instruction).

-- ---------------------------------------------------------------------------
-- progression_award_rules -- one row per fixed event type. Server-side-only; no client ever
-- supplies its own point/XP amount. lesson_studied is the one event type that reads its XP amount
-- from the triggering lesson's own xp_reward column instead of a flat amount (owner-approved,
-- spec SS34.2) -- xp_reward_ceiling caps that value so an unrestricted host-entered xp_reward can
-- never translate into unlimited XP; xp_amount is the flat amount used by every other event type
-- (and is ignored for a row that has an xp_reward_ceiling set).
-- ---------------------------------------------------------------------------
create table public.progression_award_rules (
  id uuid primary key default gen_random_uuid(),
  event_type text not null unique check (event_type in (
    'lesson_studied', 'experience_completed', 'testimony_submitted',
    'testimony_church_approved', 'testimony_kingdom_scroll_published'
  )),
  points_amount integer not null default 0 check (points_amount >= 0),
  xp_amount integer not null default 0 check (xp_amount >= 0),
  xp_reward_ceiling integer check (xp_reward_ceiling > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger progression_award_rules_set_updated_at
  before update on public.progression_award_rules
  for each row execute function public.set_updated_at();

-- Seed the five v1 event types (spec SS11, brief candidate list) with a conservative starting
-- amount -- these are data, not code, and are expected to be tuned by a platform admin later
-- without a deploy (spec SS11: "a value can be tuned without a deploy").
insert into public.progression_award_rules (event_type, points_amount, xp_amount, xp_reward_ceiling) values
  ('lesson_studied', 10, 0, 300),
  ('experience_completed', 15, 15, null),
  ('testimony_submitted', 10, 10, null),
  ('testimony_church_approved', 15, 15, null),
  ('testimony_kingdom_scroll_published', 25, 25, null);

-- ---------------------------------------------------------------------------
-- progression_level_thresholds -- a fixed, versioned XP-threshold table. Level is always derived
-- from cumulative XP against this table, never stored as the sole source of truth on its own
-- (spec SS13) -- member_progression_summaries.current_level below is a reconciled cache, recomputed
-- every time XP changes, not an independently-editable value.
-- ---------------------------------------------------------------------------
create table public.progression_level_thresholds (
  id uuid primary key default gen_random_uuid(),
  level integer not null unique check (level > 0),
  min_xp integer not null check (min_xp >= 0),
  created_at timestamptz not null default now()
);

insert into public.progression_level_thresholds (level, min_xp) values
  (1, 0), (2, 50), (3, 120), (4, 220), (5, 350),
  (6, 520), (7, 730), (8, 990), (9, 1300), (10, 1700);

-- ---------------------------------------------------------------------------
-- member_progression_summaries -- one row per member: cumulative Points/XP, a reconciled Level
-- cache, and the leaderboard opt-out flag (spec SS17) -- kept on this summary row, not on
-- profiles, so profiles itself never needs to change for this phase.
-- ---------------------------------------------------------------------------
create table public.member_progression_summaries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  points_total integer not null default 0 check (points_total >= 0),
  xp_total integer not null default 0 check (xp_total >= 0),
  current_level integer not null default 1 check (current_level > 0),
  leaderboard_opt_out boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index member_progression_summaries_points_total_idx
  on public.member_progression_summaries (points_total desc, created_at asc);

create trigger member_progression_summaries_set_updated_at
  before update on public.member_progression_summaries
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- progression_award_log -- the database-level duplicate-award guard (brief: "unique constraints
-- preventing duplicate awards") and the historical audit trail for every Points/XP award (spec
-- SS11: "historical audit"). One row per (member, event type, specific triggering row) --
-- source_row_id is deliberately a single generic column (the lesson_journeys/
-- church_experience_registrations/testimonies row id that fired the award) rather than three
-- separate nullable typed columns, since this table's only job is uniqueness/audit, not reporting
-- (member_badge_awards below carries the typed related-row columns for that).
-- ---------------------------------------------------------------------------
create table public.progression_award_log (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id) on delete cascade,
  event_type text not null,
  source_row_id uuid not null,
  points_awarded integer not null default 0,
  xp_awarded integer not null default 0,
  created_at timestamptz not null default now(),
  unique (member_id, event_type, source_row_id)
);

create index progression_award_log_member_id_idx on public.progression_award_log (member_id);

-- ---------------------------------------------------------------------------
-- badge_definitions -- category='trophy' is a reserved value, not a separate table (spec SS15).
-- requirement_type is a fixed enum; threshold is only meaningful for 'threshold'-type badges.
-- ---------------------------------------------------------------------------
create table public.badge_definitions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  image_url text,
  category text not null default 'achievement' check (category in ('achievement', 'trophy')),
  requirement_type text not null check (requirement_type in ('event_count', 'single_event', 'threshold')),
  related_event_type text,
  threshold integer check (threshold > 0),
  is_active boolean not null default true,
  is_hidden_until_earned boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint badge_definitions_threshold_requires_type
    check (requirement_type <> 'threshold' or threshold is not null)
);

create trigger badge_definitions_set_updated_at
  before update on public.badge_definitions
  for each row execute function public.set_updated_at();

-- Seed the five named v1 badges (brief's candidate list, each a "first time" single-event
-- milestone mapped to a real, verifiable trigger event -- spec SS14).
insert into public.badge_definitions (slug, name, description, category, requirement_type, related_event_type, display_order) values
  ('first-lesson-completed', 'First Lesson Completed', 'Awarded the first time you complete the Studied stage of a lesson.', 'achievement', 'single_event', 'lesson_studied', 1),
  ('first-experience-completed', 'First Experience Completed', 'Awarded the first time you complete a church Experience.', 'achievement', 'single_event', 'experience_completed', 2),
  ('first-testimony-submitted', 'First Testimony Submitted', 'Awarded the first time you submit a testimony.', 'achievement', 'single_event', 'testimony_submitted', 3),
  ('church-approved-testimony', 'Church-Approved Testimony', 'Awarded the first time your church approves one of your testimonies.', 'achievement', 'single_event', 'testimony_church_approved', 4),
  ('kingdom-scroll-contributor', 'Kingdom Scroll Contributor', 'Awarded the first time one of your testimonies is published to the Kingdom Scroll.', 'trophy', 'single_event', 'testimony_kingdom_scroll_published', 5);

-- ---------------------------------------------------------------------------
-- member_badge_awards -- unique(member_id, badge_id): every v1 badge is a one-time, "first ever"
-- milestone (not a per-lesson-repeatable instance like the old mock badge system's per-lesson
-- badges) -- this is a deliberate simplification for v1, documented in docs/PHASE11_3_AUDIT.md.
-- Never deleted -- a revoked award is marked via revoked_at/revocation_reason, matching this
-- project's standing "no hard deletes" convention.
-- ---------------------------------------------------------------------------
create table public.member_badge_awards (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id) on delete cascade,
  badge_id uuid not null references public.badge_definitions (id) on delete cascade,
  award_source text not null,
  related_lesson_id uuid references public.lessons (id) on delete set null,
  related_experience_id uuid references public.church_experiences (id) on delete set null,
  related_testimony_id uuid references public.testimonies (id) on delete set null,
  awarded_at timestamptz not null default now(),
  awarded_by uuid references public.profiles (id) on delete set null,
  revoked_at timestamptz,
  revocation_reason text,
  unique (member_id, badge_id)
);

create index member_badge_awards_member_id_idx on public.member_badge_awards (member_id);
create index member_badge_awards_badge_id_idx on public.member_badge_awards (badge_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.progression_award_rules enable row level security;
alter table public.progression_level_thresholds enable row level security;
alter table public.member_progression_summaries enable row level security;
alter table public.progression_award_log enable row level security;
alter table public.badge_definitions enable row level security;
alter table public.member_badge_awards enable row level security;

grant select on public.progression_award_rules to authenticated;
grant select on public.progression_level_thresholds to authenticated;
grant select on public.member_progression_summaries to authenticated;
grant select on public.progression_award_log to authenticated;
grant select on public.badge_definitions to authenticated;
grant select on public.member_badge_awards to authenticated;

-- progression_award_rules / progression_level_thresholds: public read (members need to see rule/
-- threshold catalogs to render progress toward a level), admin-only write -- checked directly via
-- profiles.is_platform_admin, never via a role string, matching every other admin-only table in
-- this app (admin_moderation_log, 0021).
create policy "progression_award_rules_select_all"
  on public.progression_award_rules for select
  to authenticated
  using (true);

create policy "progression_award_rules_write_admin"
  on public.progression_award_rules for all
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_platform_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_platform_admin));

create policy "progression_level_thresholds_select_all"
  on public.progression_level_thresholds for select
  to authenticated
  using (true);

create policy "progression_level_thresholds_write_admin"
  on public.progression_level_thresholds for all
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_platform_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_platform_admin));

-- badge_definitions: public read (members need to see the badge catalog, including a still-locked
-- one whose is_hidden_until_earned the application layer respects at render time), admin-only write.
create policy "badge_definitions_select_all"
  on public.badge_definitions for select
  to authenticated
  using (true);

create policy "badge_definitions_write_admin"
  on public.badge_definitions for all
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_platform_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_platform_admin));

-- member_progression_summaries: a member sees their own row; a church manager sees their own
-- church's members' rows (same join shape as profiles_select_managed_church_members, 0012); a
-- platform admin sees all. No INSERT/UPDATE/DELETE policy -- every write is RPC/trigger-only.
create policy "member_progression_summaries_select_own"
  on public.member_progression_summaries for select
  to authenticated
  using (profile_id = auth.uid());

create policy "member_progression_summaries_select_managed_church_members"
  on public.member_progression_summaries for select
  to authenticated
  using (
    exists (
      select 1 from public.church_memberships cm
      where cm.profile_id = member_progression_summaries.profile_id
        and private.is_church_manager(cm.church_id)
    )
  );

create policy "member_progression_summaries_select_admin"
  on public.member_progression_summaries for select
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_platform_admin));

-- progression_award_log: own rows, or platform admin (this is an internal audit trail, not a
-- church-manager-visible surface -- mirrors admin_moderation_log's admin-only shape more than a
-- church-scoped one, except a member may see their own award history for transparency).
create policy "progression_award_log_select_own"
  on public.progression_award_log for select
  to authenticated
  using (member_id = auth.uid());

create policy "progression_award_log_select_admin"
  on public.progression_award_log for select
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_platform_admin));

-- member_badge_awards: a member sees their own; a church manager sees their own church's members'
-- awards; a platform admin sees all.
create policy "member_badge_awards_select_own"
  on public.member_badge_awards for select
  to authenticated
  using (member_id = auth.uid());

create policy "member_badge_awards_select_managed_church_members"
  on public.member_badge_awards for select
  to authenticated
  using (
    exists (
      select 1 from public.church_memberships cm
      where cm.profile_id = member_badge_awards.member_id
        and private.is_church_manager(cm.church_id)
    )
  );

create policy "member_badge_awards_select_admin"
  on public.member_badge_awards for select
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_platform_admin));

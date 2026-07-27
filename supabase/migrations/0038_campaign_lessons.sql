-- Phase Two: Year-Round Campaign Lessons + speaker recruitment. Campaign lessons are an
-- admin-managed extension of the existing public.lessons table (September-August, one per week)
-- rather than a parallel content system -- they reuse title/short_description/about_text/status/
-- featured_image_url/featured exactly as church-authored lessons do, and pick up the same
-- lessons/lessons_media/journey/PublishedLessonCard machinery every other lesson already has.
-- Unlike church-authored lessons, a campaign lesson has no owning church, so church_id must become
-- nullable; the check constraint below keeps it required for every non-campaign row.

-- ---------------------------------------------------------------------------
-- lessons: allow a campaign lesson to have no owning church
-- ---------------------------------------------------------------------------
alter table public.lessons alter column church_id drop not null;

alter table public.lessons add column if not exists is_campaign_lesson boolean not null default false;

alter table public.lessons
  add constraint lessons_campaign_or_church_required
  check (is_campaign_lesson or church_id is not null);

-- ---------------------------------------------------------------------------
-- lessons: campaign-specific fields. All nullable -- meaningless for a regular church-authored
-- lesson, and left unset until an admin fills them in for a campaign one.
-- ---------------------------------------------------------------------------
alter table public.lessons add column if not exists campaign_name text;
alter table public.lessons add column if not exists campaign_sprint_season text;
alter table public.lessons add column if not exists campaign_month text;
alter table public.lessons add column if not exists campaign_month_number smallint check (campaign_month_number between 1 and 12);
alter table public.lessons add column if not exists campaign_week_number smallint check (campaign_week_number between 1 and 5);
alter table public.lessons add column if not exists campaign_monthly_theme text;
alter table public.lessons add column if not exists campaign_monthly_verse text;
alter table public.lessons add column if not exists campaign_weekly_verse text;
alter table public.lessons add column if not exists campaign_speaker_name text;
alter table public.lessons add column if not exists campaign_speaker_bio text;
alter table public.lessons add column if not exists campaign_speaker_image_url text;
alter table public.lessons add column if not exists is_highlighted boolean not null default false;
alter table public.lessons add column if not exists sort_order integer not null default 0;
alter table public.lessons add column if not exists display_start_date date;
alter table public.lessons
  add column if not exists linked_experience_id uuid references public.church_experiences (id) on delete set null;

create index if not exists lessons_campaign_display_start_date_idx on public.lessons (display_start_date) where is_campaign_lesson;
create index if not exists lessons_campaign_sort_order_idx on public.lessons (campaign_month_number, campaign_week_number, sort_order) where is_campaign_lesson;

-- Column-level grants, same pattern as 0021_admin_completion.sql's `featured` grant -- RLS below
-- still decides who can actually write these.
grant update (
  is_campaign_lesson, campaign_name, campaign_sprint_season, campaign_month, campaign_month_number,
  campaign_week_number, campaign_monthly_theme, campaign_monthly_verse, campaign_weekly_verse,
  campaign_speaker_name, campaign_speaker_bio, campaign_speaker_image_url, is_highlighted,
  sort_order, display_start_date, linked_experience_id
) on public.lessons to authenticated;

-- protect_lesson_ownership() (0003_functions.sql) compares church_id via `is distinct from`, which
-- is null-safe -- a campaign lesson's null church_id is still protected from ever being set to a
-- real one after creation, no trigger change needed.

-- ---------------------------------------------------------------------------
-- lessons RLS: deliberately NO new policy here. private.is_church_manager(p_church_id)
-- (0003_functions.sql) already includes an unconditional `or exists(...profiles.is_platform_admin)`
-- bypass that does not reference its church_id argument at all -- it evaluates true for any
-- platform admin even when called with church_id = null. That means the three existing policies
-- (lessons_select_published_or_managed, lessons_insert_managed_draft_only, lessons_update_managed)
-- already grant a platform admin full read/insert/update access to a campaign lesson (church_id
-- null) once the NOT NULL constraint above is dropped -- exactly the access this feature needs,
-- with zero new policy surface. An earlier draft of this migration added two campaign-specific
-- admin policies here; they were redundant with this existing bypass, and one was incorrectly
-- unscoped (would have granted admins blanket access to every lesson, not just campaign ones) --
-- removed rather than kept for defense-in-depth, since an unnecessary permissive policy is itself
-- a maintenance/audit liability.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- speaker_requests -- public "Become a Speaker" form submissions, reviewed by admin. Same shape
-- as lesson_requests (0017_lesson_requests.sql) but reachable by a prospective speaker who has no
-- account at all, so insert is open to anon as well as authenticated, and there is no self-service
-- "my requests" read policy (nothing to show them without an account to scope it to).
-- ---------------------------------------------------------------------------
create table public.speaker_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  church_affiliation text,
  church_id uuid references public.churches (id) on delete set null,
  topic text,
  bio text,
  message text,
  headshot_url text,
  status text not null default 'submitted'
    check (status in ('submitted', 'reviewed', 'contacted', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index speaker_requests_church_id_idx on public.speaker_requests (church_id);
create index speaker_requests_status_idx on public.speaker_requests (status);

create trigger speaker_requests_set_updated_at
  before update on public.speaker_requests
  for each row execute function public.set_updated_at(); -- defined in 0008_lesson_journeys.sql

alter table public.speaker_requests enable row level security;

grant insert on public.speaker_requests to anon, authenticated;
grant select, update on public.speaker_requests to authenticated;

create policy "speaker_requests_insert_anyone"
  on public.speaker_requests for insert
  to anon, authenticated
  with check (true);

create policy "speaker_requests_select_admin"
  on public.speaker_requests for select
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_platform_admin));

create policy "speaker_requests_update_admin"
  on public.speaker_requests for update
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_platform_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_platform_admin));

-- ---------------------------------------------------------------------------
-- get_platform_activity_counts -- every relevant table (church_experiences, profiles,
-- lesson_journeys, testimonies, church_experience_registrations) grants SELECT to `authenticated`
-- only, not `anon` -- correct for row-level/identifying data, but it also means a signed-out
-- homepage visitor (most homepage traffic) cannot see even a platform-wide aggregate count. This
-- function exists solely to expose non-identifying aggregate metrics for the public homepage's
-- "Kingdom Activity" panel -- it returns integers only, never a title, name, location, church, id,
-- email, or any other row-level record. It does not reverse the existing "no public/cross-church
-- Experience discovery" decision (app/experiences/page.tsx) -- that decision is about not exposing
-- *which* experiences exist or their details, not about hiding a single count of how many exist.
-- ---------------------------------------------------------------------------
create or replace function public.get_platform_activity_counts()
returns table (
  active_experiences_count bigint,
  published_campaign_lessons_count bigint,
  members_joined_count bigint,
  lessons_started_count bigint,
  lessons_completed_count bigint,
  testimonies_shared_count bigint,
  pending_registrations_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*) from public.church_experiences where status = 'published'),
    (select count(*) from public.lessons where is_campaign_lesson and status = 'published'),
    (select count(*) from public.profiles),
    (select count(*) from public.lesson_journeys),
    (select count(*) from public.lesson_journeys where studied_completed_at is not null),
    (select count(*) from public.testimonies where visibility = 'public' and church_status = 'approved' and platform_status = 'approved'),
    (select count(*) from public.church_experience_registrations where status = 'pending');
$$;

revoke all on function public.get_platform_activity_counts() from public;
grant execute on function public.get_platform_activity_counts() to anon, authenticated;

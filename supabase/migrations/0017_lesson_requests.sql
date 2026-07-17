-- Phase 5 (docs/PHASE5_AUDIT.md): "Request a Lesson" -- genuinely new territory, no prior table or
-- code touches this concept anywhere in the repo. A member requests a topic either directed at a
-- specific church, or as a broader public/platform request that needs production-admin moderation
-- before anyone but the requester (and an admin) can see it -- that's the actual privacy mechanism
-- behind Part 13's "protect member privacy on public requests."

create table public.lesson_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references public.profiles (id) on delete cascade,
  topic text not null,
  notes text,
  scope text not null check (scope in ('church', 'public')),
  church_id uuid references public.churches (id) on delete cascade,
  status text not null default 'submitted'
    check (status in ('submitted', 'under_review', 'approved', 'declined', 'fulfilled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((scope = 'church' and church_id is not null) or (scope = 'public' and church_id is null))
);

create index lesson_requests_requested_by_idx on public.lesson_requests (requested_by);
create index lesson_requests_church_id_idx on public.lesson_requests (church_id);

create trigger lesson_requests_set_updated_at
  before update on public.lesson_requests
  for each row execute function public.set_updated_at(); -- defined in 0008_lesson_journeys.sql

alter table public.lesson_requests enable row level security;

grant select, insert on public.lesson_requests to anon, authenticated;
grant update on public.lesson_requests to authenticated;

create policy "lesson_requests_select_own"
  on public.lesson_requests for select
  to authenticated
  using (requested_by = auth.uid());

-- private.is_church_manager(church_id) doubles as the admin gate here even for public requests
-- (church_id is null): its is_platform_admin branch doesn't reference the church_id argument at
-- all, so `is_church_manager(null)` still correctly evaluates true for a platform admin and false
-- otherwise -- the same helper covers "this church's manager can see their directed request" and
-- "a platform admin can see any request, including public ones awaiting moderation" with one
-- policy, no separate admin-only policy needed.
create policy "lesson_requests_select_managed"
  on public.lesson_requests for select
  to authenticated
  using (private.is_church_manager(church_id));

-- The actual privacy boundary for a public request: visible platform-wide only once approved.
-- Before that, only the requester (own-row policy above) and a platform admin (managed policy
-- above) can see it -- never broadcast while still unmoderated.
create policy "lesson_requests_select_public_approved"
  on public.lesson_requests for select
  to anon, authenticated
  using (scope = 'public' and status = 'approved');

-- A member can only ever create their own request, always starting at 'submitted' -- never
-- self-insert as already approved/fulfilled.
create policy "lesson_requests_insert_own"
  on public.lesson_requests for insert
  to authenticated
  with check (requested_by = auth.uid() and status = 'submitted');

-- Status transitions: a church-directed request's own manager, or (via the same church_id-
-- independent admin branch explained above) a platform admin for any request, including public
-- ones. Which specific status values each actor may set is enforced in the server actions that
-- call this (a Host fulfilling/declining their own church's request vs. an admin approving/
-- declining a public one) -- RLS is the "who can touch this row at all" boundary, not the full
-- business rule, matching the pattern lib/lessonStatus.ts already uses for lessons.
create policy "lesson_requests_update_managed"
  on public.lesson_requests for update
  to authenticated
  using (private.is_church_manager(church_id))
  with check (private.is_church_manager(church_id));

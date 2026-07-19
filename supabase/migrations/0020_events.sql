-- Phase 8 (docs/PHASE8_AUDIT.md): Events -- previously a single static page with one hardcoded
-- event linking to a static HTML file (public/road-to-passion-week/q4k-landing.html), no schema
-- at all. One table covers the whole "Host an Event" lifecycle (submission -> review -> approval
-- -> calendar publication) -- a request *becomes* the event, it is never copied into a second row
-- on approval.
--
-- Real Square payment integration is deliberately NOT part of this migration -- no Square
-- credentials exist anywhere in this environment (confirmed repo-wide). requires_payment/
-- price_cents/payment_status are captured so the schema is ready whenever a credentialed follow-up
-- phase wires up real checkout; payment_status can only ever be 'not_applicable' or 'pending' --
-- nothing in this codebase can ever set it to 'paid', by design, so it can never lie about a
-- payment that didn't happen.

create table public.events (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid references public.profiles (id) on delete set null,
  -- null church_id means a platform-wide event (created directly by a production admin, or a
  -- request not directed at any specific church) -- same convention as lesson_requests (Phase 5).
  church_id uuid references public.churches (id) on delete cascade,
  title text not null,
  description text,
  category text not null check (
    category in ('pop_up_virtual', 'pop_up_physical', 'ticketed', 'game_day', 'church_hosted', 'kingdom_scroll')
  ),
  format text not null check (format in ('virtual', 'physical')),
  location text,
  starts_at timestamptz,
  ends_at timestamptz,
  image_url text,
  requesting_org text,
  contact_name text,
  contact_email text,
  expected_attendance integer,
  requested_experience text,
  equipment_notes text,
  notes text,
  requires_payment boolean not null default false,
  price_cents integer,
  payment_status text not null default 'not_applicable' check (payment_status in ('not_applicable', 'pending')),
  status text not null default 'submitted' check (status in ('submitted', 'under_review', 'approved', 'published', 'declined')),
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index events_requested_by_idx on public.events (requested_by);
create index events_church_id_idx on public.events (church_id);
create index events_starts_at_idx on public.events (starts_at);

create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

alter table public.events enable row level security;

grant select, insert on public.events to authenticated;
grant update on public.events to authenticated;
grant select on public.events to anon;

create policy "events_select_own"
  on public.events for select
  to authenticated
  using (requested_by = auth.uid());

-- Same church_id-independent admin reuse as lesson_requests/testimonies: is_church_manager(null)
-- still resolves true for a platform admin (its admin branch doesn't reference the argument),
-- covering both "this church's manager sees their own directed request" and "a platform admin
-- sees any event, including platform-wide ones with no church_id at all."
create policy "events_select_managed"
  on public.events for select
  to authenticated
  using (private.is_church_manager(church_id));

create policy "events_select_published"
  on public.events for select
  to anon, authenticated
  using (status = 'published');

-- A request always starts at submitted/not_applicable-or-pending -- never self-inserted as
-- already approved or already paid.
create policy "events_insert_own"
  on public.events for insert
  to authenticated
  with check (
    requested_by = auth.uid()
    and status = 'submitted'
    and payment_status in ('not_applicable', 'pending')
  );

-- Deliberately admin-only, not private.is_church_manager -- Part 18's approval flow (submission
-- -> production review -> approval -> calendar publication) applies to every event regardless of
-- who requested it, including a church's own church_hosted event. A church can see their own
-- request's status (events_select_own/managed above) but cannot self-approve or self-publish it;
-- only a platform admin moves status forward.
create policy "events_update_admin"
  on public.events for update
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_platform_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_platform_admin));

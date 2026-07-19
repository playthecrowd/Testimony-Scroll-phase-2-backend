-- Member journey progress: previously localStorage-only (services/journeyService.ts). This
-- migration introduces the persistent, per-member, per-lesson equivalent so the Studied stage
-- (and future stages) survive refresh/sign-out/device changes, per PHASE 5.
--
-- No existing migration defines anything progress/journey/checklist-related (checked all of
-- 0001-0007) -- this is a genuinely new model, not a duplicate of something that already exists.

-- ---------------------------------------------------------------------------
-- lesson_journeys -- one row per (member, lesson). current_stage follows the same convention as
-- components/journey/stageMeta.ts's stageStatus(): it names the stage that is "in progress" --
-- everything before it in the 5-stage order is implicitly complete, the named stage is active,
-- everything after is locked/not yet available. A journey is only ever created already at
-- 'studied' in this milestone (there is no separate "Captured" member action to perform --
-- capturing is something the church/host already did by publishing the lesson).
-- ---------------------------------------------------------------------------
create table public.lesson_journeys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  current_stage text not null default 'studied'
    check (current_stage in ('captured', 'studied', 'experienced', 'applied', 'added-to-story')),
  studied_started_at timestamptz not null default now(),
  studied_completed_at timestamptz,
  last_opened_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);

create index lesson_journeys_user_id_idx on public.lesson_journeys (user_id);
create index lesson_journeys_lesson_id_idx on public.lesson_journeys (lesson_id);

-- ---------------------------------------------------------------------------
-- lesson_journey_items -- one row per (journey, checklist item). item_key is drawn from a small
-- fixed, content-category vocabulary applied in application code (lib/journeyChecklist.ts:
-- 'overview' | 'primary_scripture' | 'supporting_scriptures' | 'notes' | 'video' | 'audio' |
-- 'slides' | 'document' | 'questions') -- never a lesson_media row id, never derived from a
-- displayed title. This is what keeps completion stable across lesson edits: replacing a video
-- URL doesn't change the 'video' item's identity, and removing all video media just stops that
-- item from being *shown* -- its row (and the member's prior completion, if any) is never
-- deleted, only hidden by the application layer, so unrelated progress is never disturbed.
-- ---------------------------------------------------------------------------
create table public.lesson_journey_items (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid not null references public.lesson_journeys (id) on delete cascade,
  item_key text not null,
  item_type text,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (journey_id, item_key)
);

create index lesson_journey_items_journey_id_idx on public.lesson_journey_items (journey_id);

-- ---------------------------------------------------------------------------
-- updated_at maintenance -- neither table had this before (no existing lessons trigger covers
-- these new tables), so both get an explicit trigger rather than relying on the application layer
-- to remember to stamp it on every write.
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public;

create trigger lesson_journeys_set_updated_at
  before update on public.lesson_journeys
  for each row execute function public.set_updated_at();

create trigger lesson_journey_items_set_updated_at
  before update on public.lesson_journey_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS -- strictly member-owned. No host/admin read policy exists here deliberately: there is no
-- approved reporting feature yet, and PHASE 12 explicitly says hosts must not automatically gain
-- access to private member progress.
-- ---------------------------------------------------------------------------
alter table public.lesson_journeys enable row level security;
alter table public.lesson_journey_items enable row level security;

grant select, insert, update on public.lesson_journeys to authenticated;
grant select, insert, update on public.lesson_journey_items to authenticated;

create policy "lesson_journeys_select_own"
  on public.lesson_journeys for select
  to authenticated
  using (user_id = auth.uid());

create policy "lesson_journeys_insert_own"
  on public.lesson_journeys for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "lesson_journeys_update_own"
  on public.lesson_journeys for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "lesson_journey_items_select_own"
  on public.lesson_journey_items for select
  to authenticated
  using (
    exists (
      select 1 from public.lesson_journeys j
      where j.id = lesson_journey_items.journey_id and j.user_id = auth.uid()
    )
  );

create policy "lesson_journey_items_insert_own"
  on public.lesson_journey_items for insert
  to authenticated
  with check (
    exists (
      select 1 from public.lesson_journeys j
      where j.id = lesson_journey_items.journey_id and j.user_id = auth.uid()
    )
  );

create policy "lesson_journey_items_update_own"
  on public.lesson_journey_items for update
  to authenticated
  using (
    exists (
      select 1 from public.lesson_journeys j
      where j.id = lesson_journey_items.journey_id and j.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.lesson_journeys j
      where j.id = lesson_journey_items.journey_id and j.user_id = auth.uid()
    )
  );

-- No delete policy on either table by design: items are retired (hidden by the application when
-- their content disappears) rather than deleted, and journeys are never destroyed by a normal
-- member action.

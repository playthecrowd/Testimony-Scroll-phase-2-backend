-- Phase 7 (docs/PHASE7_AUDIT.md): Story Engine -- characters, episodes, and the relationships
-- between them and lessons/testimonies. Previously entirely mock (data/characters.ts,
-- data/episodes.ts, services/storyService.ts's generateCharacterAndStory auto-creating a
-- character on testimony approval with zero admin control -- Part 16 requires production-admin
-- control, so the real version has no automatic character/story creation at all, ever).
--
-- Characters and episodes are the first platform-wide, church-independent content in this schema
-- -- write access is is_platform_admin only, checked directly against public.profiles rather than
-- reusing private.is_church_manager() (which exists specifically to also resolve a per-church
-- manager relationship that doesn't apply here at all).

create table public.characters (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text,
  description text,
  image_url text,
  quote text,
  quote_source text,
  is_key_character boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger characters_set_updated_at
  before update on public.characters
  for each row execute function public.set_updated_at();

create table public.episodes (
  id uuid primary key default gen_random_uuid(),
  season integer not null default 1,
  episode_number integer not null,
  title text not null,
  description text,
  duration_label text,
  topic text,
  scripture text,
  thumbnail_url text,
  quote text,
  quote_source text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  featured boolean not null default false,
  -- A stored intent, not automation -- see docs/PHASE7_AUDIT.md: no scheduled-task
  -- infrastructure exists anywhere in this app, so nothing auto-publishes at this date. An admin
  -- still has to click Publish; this field is honest about that, not a fake "it's scheduled" promise.
  release_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger episodes_set_updated_at
  before update on public.episodes
  for each row execute function public.set_updated_at();

create table public.episode_characters (
  episode_id uuid not null references public.episodes (id) on delete cascade,
  character_id uuid not null references public.characters (id) on delete cascade,
  role_note text,
  primary key (episode_id, character_id)
);

create table public.episode_lessons (
  episode_id uuid not null references public.episodes (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  primary key (episode_id, lesson_id)
);

-- "Approved testimonies can contribute to a character's developing story" (Part 16) -- always
-- admin-curated, never automatic. Restricted to testimonies that are actually fully approved
-- (checked in the RLS policy below, not just at insert time) so a character's public page can
-- never surface a pending/rejected testimony's content through this relationship.
create table public.character_testimonies (
  character_id uuid not null references public.characters (id) on delete cascade,
  testimony_id uuid not null references public.testimonies (id) on delete cascade,
  note text,
  primary key (character_id, testimony_id)
);

create index episode_characters_character_id_idx on public.episode_characters (character_id);
create index episode_lessons_lesson_id_idx on public.episode_lessons (lesson_id);
create index character_testimonies_testimony_id_idx on public.character_testimonies (testimony_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.characters enable row level security;
alter table public.episodes enable row level security;
alter table public.episode_characters enable row level security;
alter table public.episode_lessons enable row level security;
alter table public.character_testimonies enable row level security;

grant select on public.characters to anon, authenticated;
grant insert, update on public.characters to authenticated;
grant select on public.episodes to anon, authenticated;
grant insert, update on public.episodes to authenticated;
grant select on public.episode_characters to anon, authenticated;
grant insert, delete on public.episode_characters to authenticated;
grant select on public.episode_lessons to anon, authenticated;
grant insert, delete on public.episode_lessons to authenticated;
grant select on public.character_testimonies to anon, authenticated;
grant insert, delete on public.character_testimonies to authenticated;

-- Characters have no draft/published concept of their own (a character is either curated by
-- admin or doesn't exist) -- public read is unconditional, write is admin-only.
create policy "characters_select_public"
  on public.characters for select
  to anon, authenticated
  using (true);

create policy "characters_write_admin"
  on public.characters for all
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_platform_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_platform_admin));

create policy "episodes_select_published_or_admin"
  on public.episodes for select
  to anon, authenticated
  using (
    status = 'published'
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_platform_admin)
  );

create policy "episodes_write_admin"
  on public.episodes for all
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_platform_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_platform_admin));

-- Join tables follow their parent episode's visibility: a draft episode's connections are only
-- visible to admin, same as the episode row itself.
create policy "episode_characters_select_follows_episode"
  on public.episode_characters for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.episodes e
      where e.id = episode_characters.episode_id
        and (e.status = 'published' or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_platform_admin))
    )
  );

create policy "episode_characters_write_admin"
  on public.episode_characters for all
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_platform_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_platform_admin));

create policy "episode_lessons_select_follows_episode"
  on public.episode_lessons for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.episodes e
      where e.id = episode_lessons.episode_id
        and (e.status = 'published' or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_platform_admin))
    )
  );

create policy "episode_lessons_write_admin"
  on public.episode_lessons for all
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_platform_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_platform_admin));

-- Extra condition beyond "admin curated it": the testimony itself must still be fully approved
-- (both stages) at read time -- if a church or admin later revokes approval, this relationship
-- stops surfacing that testimony's content automatically, without needing to also clean up this
-- join table.
create policy "character_testimonies_select_approved"
  on public.character_testimonies for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.testimonies t
      where t.id = character_testimonies.testimony_id
        and t.visibility = 'public' and t.church_status = 'approved' and t.platform_status = 'approved'
    )
  );

create policy "character_testimonies_write_admin"
  on public.character_testimonies for all
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_platform_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_platform_admin));

-- Backend Milestone One: core tables, no RLS yet (see 0004_rls.sql).
-- Order matters: each table only references tables already created above it.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text not null,
  account_type text not null check (account_type in ('host', 'member')),
  avatar_url text,
  is_platform_admin boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.profiles is
  'One row per auth.users row. account_type is a UX label (which signup tab was chosen / which '
  'dashboard to route to) only -- it is never read by RLS policies. Real authorization comes from '
  'church_memberships.role and is_platform_admin.';

-- ---------------------------------------------------------------------------
-- churches
-- ---------------------------------------------------------------------------
create table public.churches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  city text,
  region text,
  country text,
  member_count integer not null default 0,
  description text,
  verified boolean not null default false,
  status text not null default 'published' check (status in ('draft', 'published')),
  is_demo boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- church_memberships
-- ---------------------------------------------------------------------------
create table public.church_memberships (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('member', 'host', 'admin')),
  created_at timestamptz not null default now(),
  unique (church_id, profile_id)
);

-- ---------------------------------------------------------------------------
-- speakers
-- ---------------------------------------------------------------------------
create table public.speakers (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  name text not null,
  avatar_url text,
  bio text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

-- Case/whitespace-normalized uniqueness so find-or-create can't create near-duplicates
-- ("Pastor Dan" vs "pastor dan ") for the same church.
create unique index speakers_church_name_normalized_key
  on public.speakers (church_id, lower(btrim(name)));

-- ---------------------------------------------------------------------------
-- lessons
-- ---------------------------------------------------------------------------
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  short_description text,
  about_text text,
  topic text,
  subject text,
  ministry_category text,
  church_id uuid not null references public.churches (id) on delete cascade,
  speaker_id uuid references public.speakers (id) on delete set null,
  date date,
  duration_label text,
  lesson_type text check (lesson_type in ('sermon', 'bible-study', 'youth', 'devotional', 'series')),
  primary_scripture text,
  supporting_scriptures text[] not null default '{}',
  tags text[] not null default '{}',
  featured_image_url text,
  quest_url text,
  quest_level integer,
  xp_reward integer,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_by uuid references public.profiles (id) on delete set null,
  contributors_count integer not null default 0,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- lesson_media
-- ---------------------------------------------------------------------------
create table public.lesson_media (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  media_type text not null check (media_type in ('notes', 'video', 'audio', 'slides', 'document', 'transcript')),
  url text,
  content text,
  title text,
  sort_order integer not null default 0,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- lesson_hosts
-- ---------------------------------------------------------------------------
create table public.lesson_hosts (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  church_id uuid not null references public.churches (id) on delete cascade,
  status text not null default 'scheduled' check (status in ('live', 'scheduled')),
  participant_count integer not null default 0,
  schedule_label text,
  quest_url text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- ministries
-- ---------------------------------------------------------------------------
create table public.ministries (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  name text not null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index ministries_church_name_normalized_key
  on public.ministries (church_id, lower(btrim(name)));

-- ---------------------------------------------------------------------------
-- lesson_ministries
-- ---------------------------------------------------------------------------
create table public.lesson_ministries (
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  ministry_id uuid not null references public.ministries (id) on delete cascade,
  primary key (lesson_id, ministry_id)
);

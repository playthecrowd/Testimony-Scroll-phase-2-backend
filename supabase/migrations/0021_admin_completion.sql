-- Phase 9 (docs/PHASE9_AUDIT.md): Production Admin Completion. Three closing gaps found across
-- the five admin pages Phases 5-8 already built: no way to feature a lesson or testimony, and no
-- audit trail for any moderation decision anywhere.

-- ---------------------------------------------------------------------------
-- Featured lessons / testimonies -- churches.verified, episodes.featured, and events.featured
-- already exist (0001/0019/0020); lessons and testimonies never got the same column.
-- ---------------------------------------------------------------------------
alter table public.lessons add column if not exists featured boolean not null default false;
alter table public.testimonies add column if not exists featured boolean not null default false;

-- Column-level grant, same pattern as every other lessons/testimonies column widening in this
-- schema (e.g. 0010_church_profile_fields.sql) -- RLS (lessons_update_managed /
-- testimonies_update_managed) still decides who can actually write it.
grant update (featured) on public.lessons to authenticated;
grant update (featured) on public.testimonies to authenticated;

-- ---------------------------------------------------------------------------
-- admin_moderation_log -- "log important moderation status changes where practical" (Part 19).
-- Written by the shared logAdminAction() helper (lib/adminAuditLog.ts) from every existing
-- status-changing admin action, not by a trigger -- the entities being logged (lesson_requests,
-- testimonies, events, episodes) live across several tables with different status shapes, and a
-- single application-level call site per action is simpler and more legible than five near-
-- identical per-table triggers.
-- ---------------------------------------------------------------------------
create table public.admin_moderation_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  detail text,
  created_at timestamptz not null default now()
);

create index admin_moderation_log_created_at_idx on public.admin_moderation_log (created_at desc);

alter table public.admin_moderation_log enable row level security;

grant select, insert on public.admin_moderation_log to authenticated;

-- Admin-only both ways -- this is an internal audit trail, never shown to anyone else, and only
-- ever written by admin-gated server actions (the actor_id is trusted server-side, not client
-- input, since every caller of logAdminAction() has already passed requirePlatformAdmin()).
create policy "admin_moderation_log_select_admin"
  on public.admin_moderation_log for select
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_platform_admin));

create policy "admin_moderation_log_insert_admin"
  on public.admin_moderation_log for insert
  to authenticated
  with check (
    actor_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_platform_admin)
  );

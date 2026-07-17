-- Phase 2 (docs/PHASE2_AUDIT.md): tracked, per-email church invitations (individual "Invite by
-- email" + bulk CSV import both create rows here). This is deliberately separate from the
-- generic church join link/QR (that flow reuses the existing churches.slug + the existing
-- church_memberships_insert_self_member_only self-service policy from 0004_rls.sql -- no new
-- table needed for it). church_invites exists specifically so a host can see who was invited and
-- whether they've joined yet.
--
-- No email-sending integration exists anywhere in this repo (see docs/PHASE1_AUDIT.md /
-- PHASE2_AUDIT.md) and none is added here -- a host is given a real, shareable per-invite link to
-- send however they choose. The token itself is the only thing that gates redemption (see
-- accept_church_invite below); it deliberately does not also require the redeeming account's
-- email to match the invited email, so an invite still works if someone signs up with a different
-- address than the one it was sent to.

create table public.church_invites (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  email text not null,
  token uuid not null default gen_random_uuid() unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  invited_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id) on delete set null
);

create index church_invites_church_id_idx on public.church_invites (church_id);
create index church_invites_token_idx on public.church_invites (token);

alter table public.church_invites enable row level security;

grant select, insert, update on public.church_invites to authenticated;

-- Only a church's own host/admin (or a platform admin) can see or manage its invite list --
-- same private.is_church_manager gate every other church-scoped table uses.
create policy "church_invites_select_managed"
  on public.church_invites for select
  to authenticated
  using (private.is_church_manager(church_id));

create policy "church_invites_insert_managed"
  on public.church_invites for insert
  to authenticated
  with check (private.is_church_manager(church_id) and invited_by = auth.uid());

-- Covers revoking a pending invite (status -> 'revoked'). Acceptance itself never goes through
-- this policy -- it happens inside accept_church_invite, a SECURITY DEFINER RPC, specifically so
-- an invited (but not-yet-a-member, therefore not-yet-a-manager) person can redeem their own
-- invite without needing a direct UPDATE grant on a table otherwise restricted to managers.
create policy "church_invites_update_managed"
  on public.church_invites for update
  to authenticated
  using (private.is_church_manager(church_id))
  with check (private.is_church_manager(church_id));

-- ---------------------------------------------------------------------------
-- accept_church_invite -- the one way a non-manager can turn a church_invites row into a real
-- church_memberships row. Mirrors create_church_with_host's shape: SECURITY DEFINER because the
-- caller has no standing RLS right to write church_memberships for a church they don't yet
-- belong to, but only for a signed-in caller redeeming a specific, valid, still-pending token.
-- ---------------------------------------------------------------------------
create or replace function public.accept_church_invite(p_token uuid)
returns public.churches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.church_invites;
  v_church public.churches;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to accept an invite.';
  end if;

  select * into v_invite
  from public.church_invites
  where token = p_token;

  if v_invite.id is null then
    raise exception 'This invite link is invalid.';
  end if;

  if v_invite.status <> 'pending' then
    raise exception 'This invite link has already been used or was revoked.';
  end if;

  insert into public.church_memberships (church_id, profile_id, role)
  values (v_invite.church_id, auth.uid(), 'member')
  on conflict (church_id, profile_id) do nothing;

  update public.church_invites
  set status = 'accepted', accepted_at = now(), accepted_by = auth.uid()
  where id = v_invite.id;

  select * into v_church from public.churches where id = v_invite.church_id;
  return v_church;
end;
$$;

revoke all on function public.accept_church_invite(uuid) from public;
grant execute on function public.accept_church_invite(uuid) to authenticated;

-- Phase 11.1: wallet/ledger RPCs. Every balance mutation happens here, inside a SECURITY DEFINER
-- function with search_path locked and row-level locking (select ... for update) on every wallet
-- row touched before it is read or written -- the exact shape already established by Phase 10's
-- register_for_experience_occurrence/cancel_experience_registration (0023). No RLS policy on
-- member_wallets/church_wallets/credit_ledger_entries grants a direct client insert/update/delete
-- (0027) -- these functions are the only mutation path, and each re-derives/re-checks
-- authorization itself rather than trusting the client, since a SECURITY DEFINER function's
-- internal queries bypass the caller's own RLS entirely.
--
-- Division of responsibility between the four mutating RPCs:
--   * grant_credits         -- platform-admin only. Mints new credit into a member or church
--                              wallet from the platform's own authority; no source wallet is
--                              debited (spec SS6: "the platform is the issuer of first resort").
--   * transfer_credits      -- a church host/admin moves credit from their own church wallet to
--                              one of that church's members. Strictly bounded by the church
--                              wallet's real current balance, zero exceptions (owner-approved,
--                              spec SS34.6) -- a church can never mint credit from nothing.
--   * refund_credits        -- credits a wallet back the exact opposite of one prior ledger
--                              entry, for a host (of that entry's related church) or a platform
--                              admin. The generic primitive Phase 11.2's Experience-cancellation
--                              refund logic will call.
--   * reverse_credit_transaction -- platform-admin-only, generic undo of any entry (including one
--                              that isn't refund-shaped, e.g. correcting a bad grant).
-- Both refund_credits and reverse_credit_transaction refuse to act twice on the same original
-- entry (checked via reversed_by_entry_id) -- retrying either is a safe no-op that returns the
-- already-created reversal row instead of creating a duplicate one.

-- ---------------------------------------------------------------------------
-- create_member_wallet -- lazily creates the caller's own wallet. Idempotent: calling it again
-- once a wallet already exists just returns that same row.
-- ---------------------------------------------------------------------------
create or replace function public.create_member_wallet()
returns public.member_wallets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wallet public.member_wallets;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;

  select * into v_wallet from public.member_wallets where profile_id = auth.uid();
  if v_wallet.id is not null then
    return v_wallet;
  end if;

  insert into public.member_wallets (profile_id) values (auth.uid())
  returning * into v_wallet;

  return v_wallet;
end;
$$;

revoke all on function public.create_member_wallet() from public;
grant execute on function public.create_member_wallet() to authenticated;

-- ---------------------------------------------------------------------------
-- create_church_wallet -- lazily creates a church's wallet. Church-manager-gated (which already
-- includes the platform-admin branch via private.is_church_manager). Idempotent, same shape as
-- create_member_wallet. Creating an empty (zero-balance) wallet grants no money by itself, so this
-- is safe to let any manager of that church call.
-- ---------------------------------------------------------------------------
create or replace function public.create_church_wallet(p_church_id uuid)
returns public.church_wallets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wallet public.church_wallets;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;
  if not private.is_church_manager(p_church_id) then
    raise exception 'You are not authorized to manage this church''s wallet.';
  end if;

  select * into v_wallet from public.church_wallets where church_id = p_church_id;
  if v_wallet.id is not null then
    return v_wallet;
  end if;

  insert into public.church_wallets (church_id) values (p_church_id)
  returning * into v_wallet;

  return v_wallet;
end;
$$;

revoke all on function public.create_church_wallet(uuid) from public;
grant execute on function public.create_church_wallet(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- grant_credits -- platform-admin-only. Mints new credit into exactly one target (a member or a
-- church wallet, lazily created if it doesn't exist yet); no source wallet is ever debited.
-- transaction_type is restricted to the three admin-mintable types -- church_grant (transfer_credits),
-- refund, and reversal each have their own dedicated, differently-authorized RPC below and are
-- deliberately rejected here.
-- ---------------------------------------------------------------------------
create or replace function public.grant_credits(
  p_target_member_id uuid default null,
  p_target_church_id uuid default null,
  p_amount integer default null,
  p_transaction_type text default null,
  p_description text default null,
  p_idempotency_key text default null,
  p_metadata jsonb default null
)
returns public.credit_ledger_entries
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.credit_ledger_entries;
  v_member_wallet public.member_wallets;
  v_church_wallet public.church_wallets;
  v_entry public.credit_ledger_entries;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_platform_admin) then
    raise exception 'Only a platform administrator can grant credits directly.';
  end if;

  if (p_target_member_id is null) = (p_target_church_id is null) then
    raise exception 'Exactly one of p_target_member_id or p_target_church_id must be provided.';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'p_amount must be a positive integer.';
  end if;
  if p_description is null or btrim(p_description) = '' then
    raise exception 'A description is required.';
  end if;
  if p_transaction_type not in ('platform_grant', 'promotional_credit', 'administrator_adjustment') then
    raise exception 'transaction_type must be one of platform_grant, promotional_credit, administrator_adjustment.';
  end if;

  if p_idempotency_key is not null then
    select * into v_existing from public.credit_ledger_entries where idempotency_key = p_idempotency_key;
    if v_existing.id is not null then
      return v_existing;
    end if;
  end if;

  if p_target_member_id is not null then
    select * into v_member_wallet from public.member_wallets where profile_id = p_target_member_id for update;
    if v_member_wallet.id is null then
      insert into public.member_wallets (profile_id) values (p_target_member_id)
      returning * into v_member_wallet;
    end if;

    update public.member_wallets set current_balance = current_balance + p_amount where id = v_member_wallet.id;

    insert into public.credit_ledger_entries (
      member_wallet_id, amount, transaction_type, status, idempotency_key,
      related_member_id, description, metadata, created_by
    ) values (
      v_member_wallet.id, p_amount, p_transaction_type, 'completed', p_idempotency_key,
      p_target_member_id, p_description, p_metadata, auth.uid()
    )
    returning * into v_entry;
  else
    select * into v_church_wallet from public.church_wallets where church_id = p_target_church_id for update;
    if v_church_wallet.id is null then
      insert into public.church_wallets (church_id) values (p_target_church_id)
      returning * into v_church_wallet;
    end if;

    update public.church_wallets set current_balance = current_balance + p_amount where id = v_church_wallet.id;

    insert into public.credit_ledger_entries (
      church_wallet_id, amount, transaction_type, status, idempotency_key,
      related_church_id, description, metadata, created_by
    ) values (
      v_church_wallet.id, p_amount, p_transaction_type, 'completed', p_idempotency_key,
      p_target_church_id, p_description, p_metadata, auth.uid()
    )
    returning * into v_entry;
  end if;

  return v_entry;
end;
$$;

revoke all on function public.grant_credits(uuid, uuid, integer, text, text, text, jsonb) from public;
grant execute on function public.grant_credits(uuid, uuid, integer, text, text, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- transfer_credits -- a church host/admin grants credit to one of their own church's members,
-- debiting the church wallet and crediting the member wallet atomically. Strictly bounded by the
-- church wallet's real, current balance (owner-approved, spec SS34.6) -- no exceptions, no
-- overdraft. Two ledger rows are written (a church-wallet debit and a member-wallet credit); an
-- optional caller idempotency key is suffixed per row (':debit'/':credit') so each half is
-- independently protected against a duplicate retry while still sharing one logical transfer.
-- ---------------------------------------------------------------------------
create or replace function public.transfer_credits(
  p_from_church_id uuid,
  p_to_member_id uuid,
  p_amount integer,
  p_description text,
  p_idempotency_key text default null,
  p_related_experience_id uuid default null,
  p_related_occurrence_id uuid default null
)
returns public.credit_ledger_entries
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_debit_key text;
  v_credit_key text;
  v_existing public.credit_ledger_entries;
  v_church_wallet public.church_wallets;
  v_member_wallet public.member_wallets;
  v_debit_entry public.credit_ledger_entries;
  v_credit_entry public.credit_ledger_entries;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;
  if not private.is_church_manager(p_from_church_id) then
    raise exception 'You are not authorized to grant credits from this church''s wallet.';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'p_amount must be a positive integer.';
  end if;
  if p_description is null or btrim(p_description) = '' then
    raise exception 'A description is required.';
  end if;
  if not exists (
    select 1 from public.church_memberships cm
    where cm.church_id = p_from_church_id and cm.profile_id = p_to_member_id
  ) then
    raise exception 'The recipient must be a member of this church.';
  end if;

  if p_idempotency_key is not null then
    v_debit_key := p_idempotency_key || ':debit';
    v_credit_key := p_idempotency_key || ':credit';
    select * into v_existing from public.credit_ledger_entries where idempotency_key = v_credit_key;
    if v_existing.id is not null then
      return v_existing;
    end if;
  end if;

  select * into v_church_wallet from public.church_wallets where church_id = p_from_church_id for update;
  if v_church_wallet.id is null then
    raise exception 'This church does not have a wallet yet.';
  end if;
  if v_church_wallet.current_balance < p_amount then
    raise exception 'This church wallet does not have enough balance to cover this grant.';
  end if;

  select * into v_member_wallet from public.member_wallets where profile_id = p_to_member_id for update;
  if v_member_wallet.id is null then
    insert into public.member_wallets (profile_id) values (p_to_member_id)
    returning * into v_member_wallet;
  end if;

  update public.church_wallets set current_balance = current_balance - p_amount where id = v_church_wallet.id;
  update public.member_wallets set current_balance = current_balance + p_amount where id = v_member_wallet.id;

  insert into public.credit_ledger_entries (
    church_wallet_id, amount, transaction_type, status, idempotency_key,
    related_church_id, related_member_id, related_experience_id, related_occurrence_id,
    description, created_by
  ) values (
    v_church_wallet.id, -p_amount, 'church_grant', 'completed', v_debit_key,
    p_from_church_id, p_to_member_id, p_related_experience_id, p_related_occurrence_id,
    p_description, auth.uid()
  )
  returning * into v_debit_entry;

  insert into public.credit_ledger_entries (
    member_wallet_id, amount, transaction_type, status, idempotency_key,
    related_church_id, related_member_id, related_experience_id, related_occurrence_id,
    description, created_by
  ) values (
    v_member_wallet.id, p_amount, 'church_grant', 'completed', v_credit_key,
    p_from_church_id, p_to_member_id, p_related_experience_id, p_related_occurrence_id,
    p_description, auth.uid()
  )
  returning * into v_credit_entry;

  return v_credit_entry;
end;
$$;

revoke all on function public.transfer_credits(uuid, uuid, integer, text, text, uuid, uuid) from public;
grant execute on function public.transfer_credits(uuid, uuid, integer, text, text, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- refund_credits -- credits a wallet back the exact opposite of one prior ledger entry.
-- Authorized for a platform admin, or a host/admin of that entry's related_church_id (e.g.
-- refunding a spend tied to their own church's Experience). Refusing to act twice on the same
-- original entry makes a retried call a safe no-op (returns the existing refund row).
-- ---------------------------------------------------------------------------
create or replace function public.refund_credits(p_ledger_entry_id uuid, p_description text default null)
returns public.credit_ledger_entries
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_original public.credit_ledger_entries;
  v_is_admin boolean;
  v_authorized boolean;
  v_refund_amount integer;
  v_entry public.credit_ledger_entries;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;

  select * into v_original from public.credit_ledger_entries where id = p_ledger_entry_id for update;
  if v_original.id is null then
    raise exception 'That transaction could not be found.';
  end if;

  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_platform_admin) into v_is_admin;
  v_authorized := v_is_admin
    or (v_original.related_church_id is not null and private.is_church_manager(v_original.related_church_id));
  if not v_authorized then
    raise exception 'You are not authorized to refund this transaction.';
  end if;

  if v_original.reversed_by_entry_id is not null then
    select * into v_entry from public.credit_ledger_entries where id = v_original.reversed_by_entry_id;
    return v_entry;
  end if;

  v_refund_amount := -v_original.amount;

  if v_original.member_wallet_id is not null then
    update public.member_wallets set current_balance = current_balance + v_refund_amount
    where id = v_original.member_wallet_id;

    insert into public.credit_ledger_entries (
      member_wallet_id, amount, transaction_type, status,
      related_church_id, related_member_id, related_experience_id, related_occurrence_id,
      description, created_by, reverses_entry_id
    ) values (
      v_original.member_wallet_id, v_refund_amount, 'refund', 'completed',
      v_original.related_church_id, v_original.related_member_id, v_original.related_experience_id,
      v_original.related_occurrence_id, coalesce(p_description, 'Refund of a prior transaction'),
      auth.uid(), v_original.id
    )
    returning * into v_entry;
  else
    update public.church_wallets set current_balance = current_balance + v_refund_amount
    where id = v_original.church_wallet_id;

    insert into public.credit_ledger_entries (
      church_wallet_id, amount, transaction_type, status,
      related_church_id, related_member_id, related_experience_id, related_occurrence_id,
      description, created_by, reverses_entry_id
    ) values (
      v_original.church_wallet_id, v_refund_amount, 'refund', 'completed',
      v_original.related_church_id, v_original.related_member_id, v_original.related_experience_id,
      v_original.related_occurrence_id, coalesce(p_description, 'Refund of a prior transaction'),
      auth.uid(), v_original.id
    )
    returning * into v_entry;
  end if;

  update public.credit_ledger_entries set reversed_by_entry_id = v_entry.id where id = v_original.id;

  return v_entry;
end;
$$;

revoke all on function public.refund_credits(uuid, text) from public;
grant execute on function public.refund_credits(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- reverse_credit_transaction -- platform-admin-only, generic undo of any ledger entry (not just a
-- spend -- e.g. correcting a bad grant). Same duplicate-protection shape as refund_credits.
-- ---------------------------------------------------------------------------
create or replace function public.reverse_credit_transaction(p_ledger_entry_id uuid, p_reason text)
returns public.credit_ledger_entries
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_original public.credit_ledger_entries;
  v_reverse_amount integer;
  v_entry public.credit_ledger_entries;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_platform_admin) then
    raise exception 'Only a platform administrator can reverse a transaction.';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'A reason is required to reverse a transaction.';
  end if;

  select * into v_original from public.credit_ledger_entries where id = p_ledger_entry_id for update;
  if v_original.id is null then
    raise exception 'That transaction could not be found.';
  end if;

  if v_original.reversed_by_entry_id is not null then
    select * into v_entry from public.credit_ledger_entries where id = v_original.reversed_by_entry_id;
    return v_entry;
  end if;

  v_reverse_amount := -v_original.amount;

  if v_original.member_wallet_id is not null then
    update public.member_wallets set current_balance = current_balance + v_reverse_amount
    where id = v_original.member_wallet_id;

    insert into public.credit_ledger_entries (
      member_wallet_id, amount, transaction_type, status,
      related_church_id, related_member_id, related_experience_id, related_occurrence_id,
      description, created_by, reverses_entry_id
    ) values (
      v_original.member_wallet_id, v_reverse_amount, 'reversal', 'completed',
      v_original.related_church_id, v_original.related_member_id, v_original.related_experience_id,
      v_original.related_occurrence_id, p_reason, auth.uid(), v_original.id
    )
    returning * into v_entry;
  else
    update public.church_wallets set current_balance = current_balance + v_reverse_amount
    where id = v_original.church_wallet_id;

    insert into public.credit_ledger_entries (
      church_wallet_id, amount, transaction_type, status,
      related_church_id, related_member_id, related_experience_id, related_occurrence_id,
      description, created_by, reverses_entry_id
    ) values (
      v_original.church_wallet_id, v_reverse_amount, 'reversal', 'completed',
      v_original.related_church_id, v_original.related_member_id, v_original.related_experience_id,
      v_original.related_occurrence_id, p_reason, auth.uid(), v_original.id
    )
    returning * into v_entry;
  end if;

  update public.credit_ledger_entries set reversed_by_entry_id = v_entry.id where id = v_original.id;

  return v_entry;
end;
$$;

revoke all on function public.reverse_credit_transaction(uuid, text) from public;
grant execute on function public.reverse_credit_transaction(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- get_wallet_balance / get_wallet_history -- read-only lookups. Still SECURITY DEFINER with a
-- locked search_path for consistency with every other function in this migration, but neither
-- needs row locking or idempotency since neither mutates anything; both re-derive authorization
-- explicitly since a SECURITY DEFINER function bypasses the caller's own RLS for its internal
-- queries (the same reasoning as every write RPC above, just applied to a read).
-- ---------------------------------------------------------------------------
create or replace function public.get_wallet_balance(p_member_wallet_id uuid default null, p_church_wallet_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance integer;
  v_member_wallet public.member_wallets;
  v_church_wallet public.church_wallets;
  v_is_admin boolean;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;
  if (p_member_wallet_id is null) = (p_church_wallet_id is null) then
    raise exception 'Exactly one of p_member_wallet_id or p_church_wallet_id must be provided.';
  end if;

  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_platform_admin) into v_is_admin;

  if p_member_wallet_id is not null then
    select * into v_member_wallet from public.member_wallets where id = p_member_wallet_id;
    if v_member_wallet.id is null then
      raise exception 'That wallet could not be found.';
    end if;
    if v_member_wallet.profile_id <> auth.uid() and not v_is_admin then
      raise exception 'You are not authorized to view this wallet.';
    end if;
    v_balance := v_member_wallet.current_balance;
  else
    select * into v_church_wallet from public.church_wallets where id = p_church_wallet_id;
    if v_church_wallet.id is null then
      raise exception 'That wallet could not be found.';
    end if;
    if not private.is_church_manager(v_church_wallet.church_id) then
      raise exception 'You are not authorized to view this wallet.';
    end if;
    v_balance := v_church_wallet.current_balance;
  end if;

  return v_balance;
end;
$$;

revoke all on function public.get_wallet_balance(uuid, uuid) from public;
grant execute on function public.get_wallet_balance(uuid, uuid) to authenticated;

create or replace function public.get_wallet_history(
  p_member_wallet_id uuid default null,
  p_church_wallet_id uuid default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns setof public.credit_ledger_entries
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_wallet public.member_wallets;
  v_church_wallet public.church_wallets;
  v_is_admin boolean;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;
  if (p_member_wallet_id is null) = (p_church_wallet_id is null) then
    raise exception 'Exactly one of p_member_wallet_id or p_church_wallet_id must be provided.';
  end if;
  if p_limit is null or p_limit <= 0 or p_limit > 200 then
    raise exception 'p_limit must be between 1 and 200.';
  end if;

  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_platform_admin) into v_is_admin;

  if p_member_wallet_id is not null then
    select * into v_member_wallet from public.member_wallets where id = p_member_wallet_id;
    if v_member_wallet.id is null then
      raise exception 'That wallet could not be found.';
    end if;
    if v_member_wallet.profile_id <> auth.uid() and not v_is_admin then
      raise exception 'You are not authorized to view this wallet.';
    end if;

    return query
      select * from public.credit_ledger_entries
      where member_wallet_id = p_member_wallet_id
      order by created_at desc
      limit p_limit offset p_offset;
  else
    select * into v_church_wallet from public.church_wallets where id = p_church_wallet_id;
    if v_church_wallet.id is null then
      raise exception 'That wallet could not be found.';
    end if;
    if not private.is_church_manager(v_church_wallet.church_id) then
      raise exception 'You are not authorized to view this wallet.';
    end if;

    return query
      select * from public.credit_ledger_entries
      where church_wallet_id = p_church_wallet_id
      order by created_at desc
      limit p_limit offset p_offset;
  end if;
end;
$$;

revoke all on function public.get_wallet_history(uuid, uuid, integer, integer) from public;
grant execute on function public.get_wallet_history(uuid, uuid, integer, integer) to authenticated;

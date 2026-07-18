import type { SupabaseClient } from "@supabase/supabase-js";
import { ChurchWallet, CreditLedgerEntry, CreditRequest, CreditTransactionType, MemberWallet } from "@/types";

// Phase 11.1 (docs/PHASE11_ECONOMY_PROGRESSION_SPEC.md, docs/PHASE11_1_AUDIT.md) -- typed
// service layer over the wallet/ledger schema landed in migrations 0027/0028. No UI, page, or
// route consumes this yet -- that starts in a later Phase 11 stage. No function here ever computes
// or asserts a balance itself; every mutation is a thin wrapper around a SECURITY DEFINER RPC
// (matching services/supabase/churchExperiences.ts's own precedent for registration/cancellation),
// and the one read query (getMyMemberWallet) relies entirely on RLS, never on this file's own
// authorization logic.

const MEMBER_WALLET_SELECT = "id, profile_id, current_balance, created_at, updated_at";
const CHURCH_WALLET_SELECT = "id, church_id, current_balance, created_at, updated_at";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapMemberWallet(row: any): MemberWallet {
  return {
    id: row.id,
    profileId: row.profile_id,
    currentBalance: row.current_balance,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapChurchWallet(row: any): ChurchWallet {
  return {
    id: row.id,
    churchId: row.church_id,
    currentBalance: row.current_balance,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCreditLedgerEntry(row: any): CreditLedgerEntry {
  return {
    id: row.id,
    memberWalletId: row.member_wallet_id,
    churchWalletId: row.church_wallet_id,
    amount: row.amount,
    transactionType: row.transaction_type,
    status: row.status,
    idempotencyKey: row.idempotency_key,
    relatedChurchId: row.related_church_id,
    relatedMemberId: row.related_member_id,
    relatedExperienceId: row.related_experience_id,
    relatedOccurrenceId: row.related_occurrence_id,
    description: row.description,
    metadata: row.metadata,
    createdBy: row.created_by,
    createdAt: row.created_at,
    reversesEntryId: row.reverses_entry_id,
    reversedByEntryId: row.reversed_by_entry_id,
  };
}

// ---------------------------------------------------------------------------
// Reads -- rely entirely on RLS (member_wallets_select_own_or_admin / church_wallets_select_managed),
// never on any authorization logic in this file itself.
// ---------------------------------------------------------------------------

export async function getMyMemberWallet(supabase: SupabaseClient): Promise<MemberWallet | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("member_wallets")
    .select(MEMBER_WALLET_SELECT)
    .eq("profile_id", user.id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapMemberWallet(data) : null;
}

export async function getChurchWallet(supabase: SupabaseClient, churchId: string): Promise<ChurchWallet | null> {
  const { data, error } = await supabase
    .from("church_wallets")
    .select(CHURCH_WALLET_SELECT)
    .eq("church_id", churchId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapChurchWallet(data) : null;
}

// ---------------------------------------------------------------------------
// Wallet creation -- both RPCs are idempotent (return the existing wallet if one already exists).
// ---------------------------------------------------------------------------

export async function createMemberWallet(supabase: SupabaseClient): Promise<MemberWallet> {
  const { data, error } = await supabase.rpc("create_member_wallet");
  if (error) throw error;
  return mapMemberWallet(data);
}

export async function createChurchWallet(supabase: SupabaseClient, churchId: string): Promise<ChurchWallet> {
  const { data, error } = await supabase.rpc("create_church_wallet", { p_church_id: churchId });
  if (error) throw error;
  return mapChurchWallet(data);
}

// ---------------------------------------------------------------------------
// Mutations -- every one is a thin wrapper around a SECURITY DEFINER RPC; no client-side balance
// math or authorization check happens in this file.
// ---------------------------------------------------------------------------

export interface GrantCreditsInput {
  targetMemberId?: string;
  targetChurchId?: string;
  amount: number;
  transactionType: Extract<CreditTransactionType, "platform_grant" | "promotional_credit" | "administrator_adjustment">;
  description: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

export async function grantCredits(supabase: SupabaseClient, input: GrantCreditsInput): Promise<CreditLedgerEntry> {
  const { data, error } = await supabase.rpc("grant_credits", {
    p_target_member_id: input.targetMemberId ?? null,
    p_target_church_id: input.targetChurchId ?? null,
    p_amount: input.amount,
    p_transaction_type: input.transactionType,
    p_description: input.description,
    p_idempotency_key: input.idempotencyKey ?? null,
    p_metadata: input.metadata ?? null,
  });
  if (error) throw error;
  return mapCreditLedgerEntry(data);
}

export interface TransferCreditsInput {
  fromChurchId: string;
  toMemberId: string;
  amount: number;
  description: string;
  idempotencyKey?: string;
  relatedExperienceId?: string;
  relatedOccurrenceId?: string;
}

export async function transferCredits(supabase: SupabaseClient, input: TransferCreditsInput): Promise<CreditLedgerEntry> {
  const { data, error } = await supabase.rpc("transfer_credits", {
    p_from_church_id: input.fromChurchId,
    p_to_member_id: input.toMemberId,
    p_amount: input.amount,
    p_description: input.description,
    p_idempotency_key: input.idempotencyKey ?? null,
    p_related_experience_id: input.relatedExperienceId ?? null,
    p_related_occurrence_id: input.relatedOccurrenceId ?? null,
  });
  if (error) throw error;
  return mapCreditLedgerEntry(data);
}

export async function refundCredits(supabase: SupabaseClient, ledgerEntryId: string, description?: string): Promise<CreditLedgerEntry> {
  const { data, error } = await supabase.rpc("refund_credits", {
    p_ledger_entry_id: ledgerEntryId,
    p_description: description ?? null,
  });
  if (error) throw error;
  return mapCreditLedgerEntry(data);
}

export async function reverseCreditTransaction(supabase: SupabaseClient, ledgerEntryId: string, reason: string): Promise<CreditLedgerEntry> {
  const { data, error } = await supabase.rpc("reverse_credit_transaction", {
    p_ledger_entry_id: ledgerEntryId,
    p_reason: reason,
  });
  if (error) throw error;
  return mapCreditLedgerEntry(data);
}

// ---------------------------------------------------------------------------
// Balance/history lookups -- also RPCs (not a plain .from(...).select(...)) so a member and a
// church wallet share one calling convention; each RPC re-derives authorization server-side.
// ---------------------------------------------------------------------------

export interface WalletRef {
  memberWalletId?: string;
  churchWalletId?: string;
}

export async function getWalletBalance(supabase: SupabaseClient, ref: WalletRef): Promise<number> {
  const { data, error } = await supabase.rpc("get_wallet_balance", {
    p_member_wallet_id: ref.memberWalletId ?? null,
    p_church_wallet_id: ref.churchWalletId ?? null,
  });
  if (error) throw error;
  return data as number;
}

export async function getWalletHistory(
  supabase: SupabaseClient,
  ref: WalletRef,
  limit = 50,
  offset = 0
): Promise<CreditLedgerEntry[]> {
  const { data, error } = await supabase.rpc("get_wallet_history", {
    p_member_wallet_id: ref.memberWalletId ?? null,
    p_church_wallet_id: ref.churchWalletId ?? null,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw error;
  return (data ?? []).map(mapCreditLedgerEntry);
}

// ---------------------------------------------------------------------------
// Credit requests (Phase 11.2, docs/PHASE11_2_AUDIT.md) -- the member-to-church request workflow
// from migrations 0029/0030. Reads rely on RLS (credit_requests_select_own /
// credit_requests_select_managed); every status transition is an RPC.
// ---------------------------------------------------------------------------

const CREDIT_REQUEST_SELECT = `
  id, requested_by, church_id, requested_amount, related_experience_id, reason, status,
  decline_reason, resolved_by, resolved_at, created_at, updated_at
`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCreditRequest(row: any): CreditRequest {
  return {
    id: row.id,
    requestedBy: row.requested_by,
    churchId: row.church_id,
    requestedAmount: row.requested_amount,
    relatedExperienceId: row.related_experience_id,
    reason: row.reason,
    status: row.status,
    declineReason: row.decline_reason,
    resolvedBy: row.resolved_by,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getMyCreditRequests(supabase: SupabaseClient): Promise<CreditRequest[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("credit_requests")
    .select(CREDIT_REQUEST_SELECT)
    .eq("requested_by", user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapCreditRequest);
}

export async function getCreditRequestsForChurch(supabase: SupabaseClient, churchId: string): Promise<CreditRequest[]> {
  const { data, error } = await supabase
    .from("credit_requests")
    .select(CREDIT_REQUEST_SELECT)
    .eq("church_id", churchId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapCreditRequest);
}

export interface SubmitCreditRequestInput {
  churchId: string;
  requestedAmount: number;
  relatedExperienceId?: string;
  reason?: string;
}

export async function submitCreditRequest(supabase: SupabaseClient, input: SubmitCreditRequestInput): Promise<CreditRequest> {
  const { data, error } = await supabase.rpc("submit_credit_request", {
    p_church_id: input.churchId,
    p_requested_amount: input.requestedAmount,
    p_related_experience_id: input.relatedExperienceId ?? null,
    p_reason: input.reason ?? null,
  });
  if (error) throw error;
  return mapCreditRequest(data);
}

export async function cancelCreditRequest(supabase: SupabaseClient, requestId: string): Promise<CreditRequest> {
  const { data, error } = await supabase.rpc("cancel_credit_request", { p_request_id: requestId });
  if (error) throw error;
  return mapCreditRequest(data);
}

export async function approveCreditRequest(supabase: SupabaseClient, requestId: string): Promise<CreditRequest> {
  const { data, error } = await supabase.rpc("approve_credit_request", { p_request_id: requestId });
  if (error) throw error;
  return mapCreditRequest(data);
}

export async function declineCreditRequest(supabase: SupabaseClient, requestId: string, reason?: string): Promise<CreditRequest> {
  const { data, error } = await supabase.rpc("decline_credit_request", {
    p_request_id: requestId,
    p_reason: reason ?? null,
  });
  if (error) throw error;
  return mapCreditRequest(data);
}

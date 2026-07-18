"use server";

import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import {
  getMyMemberWallet,
  createMemberWallet,
  getWalletBalance,
  getWalletHistory,
  getMyCreditRequests,
  submitCreditRequest,
  cancelCreditRequest,
} from "@/services/supabase/wallets";
import { CreditLedgerEntry, CreditRequest, MemberWallet } from "@/types";

// Phase 11.2 (docs/PHASE11_2_AUDIT.md) -- member-facing wallet/credit-request server actions.
// Written ahead of their eventual page (this phase is explicitly service/RPC-layer only, no UI) --
// `/wallet` and `/credit-requests` don't exist as routes yet, so these live in a neutral
// app/actions/ location rather than implying a page that isn't there. Every function here follows
// the exact shape established by app/experiences/actions.ts: authenticate, call the centralized
// service/RPC layer, never leak a raw Supabase error message to the caller.

export interface WalletActionResult<T = undefined> {
  error?: string;
  ok?: boolean;
  data?: T;
}

function safeErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof SupabaseConfigError) return err.message;
  if (err && typeof err === "object" && "message" in err && typeof (err as { message?: unknown }).message === "string") {
    const message = (err as { message: string }).message;
    const looksLikeOurOwnException = !/^(new row|duplicate key|null value|permission denied|relation |column )/i.test(message);
    if (looksLikeOurOwnException && message.length < 300) return message;
  }
  console.error(fallback, err);
  return fallback;
}

// Ensures the signed-in member has a wallet (creating one lazily if needed) and returns it --
// the one action that both reads and, if necessary, creates, matching create_member_wallet's own
// idempotent shape.
export async function getMyWalletAction(): Promise<WalletActionResult<MemberWallet>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "You must be signed in." };

    const existing = await getMyMemberWallet(supabase);
    if (existing) return { ok: true, data: existing };

    const wallet = await createMemberWallet(supabase);
    return { ok: true, data: wallet };
  } catch (err) {
    return { error: safeErrorMessage(err, "Couldn't load your wallet. Please try again.") };
  }
}

export async function getMyWalletBalanceAction(memberWalletId: string): Promise<WalletActionResult<number>> {
  try {
    const supabase = await createClient();
    const balance = await getWalletBalance(supabase, { memberWalletId });
    return { ok: true, data: balance };
  } catch (err) {
    return { error: safeErrorMessage(err, "Couldn't load your balance. Please try again.") };
  }
}

export async function getMyWalletHistoryAction(
  memberWalletId: string,
  limit = 50,
  offset = 0
): Promise<WalletActionResult<CreditLedgerEntry[]>> {
  try {
    const supabase = await createClient();
    const history = await getWalletHistory(supabase, { memberWalletId }, limit, offset);
    return { ok: true, data: history };
  } catch (err) {
    return { error: safeErrorMessage(err, "Couldn't load your transaction history. Please try again.") };
  }
}

export async function getMyCreditRequestsAction(): Promise<WalletActionResult<CreditRequest[]>> {
  try {
    const supabase = await createClient();
    const requests = await getMyCreditRequests(supabase);
    return { ok: true, data: requests };
  } catch (err) {
    return { error: safeErrorMessage(err, "Couldn't load your credit requests. Please try again.") };
  }
}

export interface SubmitCreditRequestActionInput {
  churchId: string;
  requestedAmount: number;
  relatedExperienceId?: string;
  reason?: string;
}

export async function submitCreditRequestAction(input: SubmitCreditRequestActionInput): Promise<WalletActionResult<CreditRequest>> {
  try {
    const supabase = await createClient();
    const request = await submitCreditRequest(supabase, input);
    return { ok: true, data: request };
  } catch (err) {
    return { error: safeErrorMessage(err, "Couldn't submit your credit request. Please try again.") };
  }
}

export async function cancelCreditRequestAction(requestId: string): Promise<WalletActionResult<CreditRequest>> {
  try {
    const supabase = await createClient();
    const request = await cancelCreditRequest(supabase, requestId);
    return { ok: true, data: request };
  } catch (err) {
    return { error: safeErrorMessage(err, "Couldn't cancel this request. Please try again.") };
  }
}

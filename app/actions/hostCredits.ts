"use server";

import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { hasChurchEditAccess } from "@/lib/lessonAuth";
import {
  getChurchWallet,
  createChurchWallet,
  getWalletBalance,
  getWalletHistory,
  getCreditRequestsForChurch,
  approveCreditRequest,
  declineCreditRequest,
} from "@/services/supabase/wallets";
import { ChurchWallet, CreditLedgerEntry, CreditRequest } from "@/types";

// Phase 11.2 (docs/PHASE11_2_AUDIT.md) -- host-facing church wallet/credit-request review server
// actions. Written ahead of their eventual page (`/host-dashboard/credits`, not built until a
// later Phase 11 stage) for the same reason as app/actions/wallet.ts. A browser-supplied churchId/
// requestId is never trusted on its own -- every action re-checks church_memberships for the
// SPECIFIC church/request involved, exactly like app/host-dashboard/experiences/actions.ts's
// requireChurchAccess/getAuthorized* guards (RLS and the RPCs' own authorization checks remain the
// real gate; this is defense-in-depth, matching that file's own stated convention).

export interface HostCreditsActionResult<T = undefined> {
  error?: string;
  ok?: boolean;
  data?: T;
}

async function requireChurchAccess(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, churchId: string): Promise<string | null> {
  const { data: membership } = await supabase
    .from("church_memberships")
    .select("role")
    .eq("profile_id", userId)
    .eq("church_id", churchId)
    .maybeSingle();
  if (!hasChurchEditAccess(membership?.role)) return "You are not authorized to manage this church's credits.";
  return null;
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

// Ensures the church has a wallet (creating one lazily if needed) and returns it.
export async function getChurchWalletAction(churchId: string): Promise<HostCreditsActionResult<ChurchWallet>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "You must be signed in." };

    const accessError = await requireChurchAccess(supabase, user.id, churchId);
    if (accessError) return { error: accessError };

    const existing = await getChurchWallet(supabase, churchId);
    if (existing) return { ok: true, data: existing };

    const wallet = await createChurchWallet(supabase, churchId);
    return { ok: true, data: wallet };
  } catch (err) {
    return { error: safeErrorMessage(err, "Couldn't load this church's wallet. Please try again.") };
  }
}

export async function getChurchWalletBalanceAction(churchWalletId: string): Promise<HostCreditsActionResult<number>> {
  try {
    const supabase = await createClient();
    const balance = await getWalletBalance(supabase, { churchWalletId });
    return { ok: true, data: balance };
  } catch (err) {
    return { error: safeErrorMessage(err, "Couldn't load this church's balance. Please try again.") };
  }
}

export async function getChurchWalletHistoryAction(
  churchWalletId: string,
  limit = 50,
  offset = 0
): Promise<HostCreditsActionResult<CreditLedgerEntry[]>> {
  try {
    const supabase = await createClient();
    const history = await getWalletHistory(supabase, { churchWalletId }, limit, offset);
    return { ok: true, data: history };
  } catch (err) {
    return { error: safeErrorMessage(err, "Couldn't load this church's transaction history. Please try again.") };
  }
}

export async function getCreditRequestsForChurchAction(churchId: string): Promise<HostCreditsActionResult<CreditRequest[]>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "You must be signed in." };

    const accessError = await requireChurchAccess(supabase, user.id, churchId);
    if (accessError) return { error: accessError };

    const requests = await getCreditRequestsForChurch(supabase, churchId);
    return { ok: true, data: requests };
  } catch (err) {
    return { error: safeErrorMessage(err, "Couldn't load credit requests. Please try again.") };
  }
}

export async function approveCreditRequestAction(requestId: string): Promise<HostCreditsActionResult<CreditRequest>> {
  try {
    const supabase = await createClient();
    const request = await approveCreditRequest(supabase, requestId);
    return { ok: true, data: request };
  } catch (err) {
    return { error: safeErrorMessage(err, "Couldn't approve this request. Please try again.") };
  }
}

export async function declineCreditRequestAction(requestId: string, reason?: string): Promise<HostCreditsActionResult<CreditRequest>> {
  try {
    const supabase = await createClient();
    const request = await declineCreditRequest(supabase, requestId, reason);
    return { ok: true, data: request };
  } catch (err) {
    return { error: safeErrorMessage(err, "Couldn't decline this request. Please try again.") };
  }
}

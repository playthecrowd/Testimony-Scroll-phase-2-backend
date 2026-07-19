"use server";

import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { joinChurchAsMember, acceptChurchInvite } from "@/services/supabase/churches";

// Generic join-by-link/QR path (churches.slug-based, RLS self-service insert -- see
// services/supabase/churches.ts joinChurchAsMember).
export async function joinChurchAction(churchId: string): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();
    await joinChurchAsMember(supabase, churchId);
    return {};
  } catch (err) {
    if (err instanceof SupabaseConfigError) return { error: err.message };
    console.error("[joinChurchAction] Unexpected error:", err);
    return { error: "Something went wrong joining this church. Please try again." };
  }
}

// Individually-invited path -- redeems a church_invites token via the accept_church_invite RPC.
export async function acceptInviteAction(token: string): Promise<{ error?: string; churchSlug?: string }> {
  try {
    const supabase = await createClient();
    const church = await acceptChurchInvite(supabase, token);
    return { churchSlug: church.slug };
  } catch (err) {
    if (err instanceof SupabaseConfigError) return { error: err.message };
    // The RPC raises a specific, user-safe message ("invalid" / "already used or revoked") --
    // surface it directly rather than a generic fallback.
    const message = err instanceof Error ? err.message : "This invite link isn't valid.";
    return { error: message };
  }
}

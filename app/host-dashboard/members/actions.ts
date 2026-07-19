"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { hasChurchEditAccess } from "@/lib/lessonAuth";
import { createChurchInvites, revokeChurchInvite } from "@/services/supabase/churches";
import { ChurchInvite } from "@/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface CreateInvitesInput {
  churchId: string;
  emails: string[];
}

export interface CreateInvitesActionResult {
  error?: string;
  created?: ChurchInvite[];
  invalidEmails?: string[];
  failedEmails?: string[];
}

// Shared by both the single "invite by email" field and the CSV/paste bulk importer -- one
// email is functionally a bulk import of size 1, so there's no reason for two code paths.
export async function createInvitesAction(input: CreateInvitesInput): Promise<CreateInvitesActionResult> {
  const seen = new Set<string>();
  const invalidEmails: string[] = [];
  const validEmails: string[] = [];

  for (const raw of input.emails) {
    const email = raw.trim().toLowerCase();
    if (!email) continue;
    if (!EMAIL_RE.test(email)) {
      invalidEmails.push(raw.trim());
      continue;
    }
    if (seen.has(email)) continue;
    seen.add(email);
    validEmails.push(email);
  }

  if (validEmails.length === 0) {
    return { error: "No valid email addresses were found.", invalidEmails };
  }

  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "You must be signed in to invite members." };

    const { data: membership } = await supabase
      .from("church_memberships")
      .select("role")
      .eq("profile_id", user.id)
      .eq("church_id", input.churchId)
      .maybeSingle();
    if (!hasChurchEditAccess(membership?.role)) {
      return { error: "You are not authorized to invite members to this church." };
    }

    const { created, failedEmails } = await createChurchInvites(supabase, input.churchId, validEmails, user.id);

    revalidatePath("/host-dashboard/members");
    revalidatePath("/host-dashboard");

    return { created, invalidEmails, failedEmails };
  } catch (err) {
    if (err instanceof SupabaseConfigError) return { error: err.message };
    console.error("[createInvitesAction] Unexpected error:", err);
    return { error: "Something went wrong sending invites. Please try again." };
  }
}

export async function revokeInviteAction(inviteId: string): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();
    await revokeChurchInvite(supabase, inviteId);
    revalidatePath("/host-dashboard/members");
    return {};
  } catch (err) {
    if (err instanceof SupabaseConfigError) return { error: err.message };
    console.error("[revokeInviteAction] Unexpected error:", err);
    return { error: "Couldn't revoke that invite. Please try again." };
  }
}

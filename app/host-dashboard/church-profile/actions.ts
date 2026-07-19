"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { isValidMediaUrl } from "@/lib/lessonForm";
import { hasChurchEditAccess } from "@/lib/lessonAuth";
import { updateChurchProfile } from "@/services/supabase/churches";

export interface UpdateChurchProfileInput {
  churchId: string;
  churchSlug: string;
  name: string;
  description: string;
  city: string;
  region: string;
  country: string;
  addressLine1: string;
  website: string;
  contactEmail: string;
  contactPhone: string;
  churchType: string;
  logoUrl: string;
  bannerUrl: string;
}

export interface UpdateChurchProfileResult {
  error?: string;
  ok?: boolean;
}

export async function updateChurchProfileAction(input: UpdateChurchProfileInput): Promise<UpdateChurchProfileResult> {
  if (!input.name.trim()) return { error: "Church name is required." };
  if (input.website && !isValidMediaUrl(input.website)) return { error: "Website doesn't look like a valid web address." };
  if (input.logoUrl && !isValidMediaUrl(input.logoUrl)) return { error: "Logo URL doesn't look like a valid web address." };
  if (input.bannerUrl && !isValidMediaUrl(input.bannerUrl)) return { error: "Banner URL doesn't look like a valid web address." };

  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "You must be signed in to edit a church profile." };

    // Defense-in-depth, same shape as updateLessonExperience: RLS is the real gate
    // (churches_update_managed), this just fails fast with a clear message.
    const { data: membership } = await supabase
      .from("church_memberships")
      .select("role")
      .eq("profile_id", user.id)
      .eq("church_id", input.churchId)
      .maybeSingle();
    if (!hasChurchEditAccess(membership?.role)) {
      return { error: "You are not authorized to edit this church." };
    }

    const updated = await updateChurchProfile(supabase, input.churchId, {
      name: input.name.trim(),
      description: input.description || null,
      city: input.city || null,
      region: input.region || null,
      country: input.country || null,
      addressLine1: input.addressLine1 || null,
      website: input.website || null,
      contactEmail: input.contactEmail || null,
      contactPhone: input.contactPhone || null,
      churchType: input.churchType || null,
      logoUrl: input.logoUrl || null,
      bannerUrl: input.bannerUrl || null,
    });
    if (!updated) return { error: "You are not authorized to update this church." };

    revalidatePath("/host-dashboard");
    revalidatePath("/host-dashboard/church-profile");
    revalidatePath("/churches");
    revalidatePath(`/churches/${input.churchSlug}`);

    return { ok: true };
  } catch (err) {
    if (err instanceof SupabaseConfigError) return { error: err.message };
    console.error("[updateChurchProfileAction] Unexpected error:", err);
    return { error: "Something went wrong saving your changes. Please try again." };
  }
}

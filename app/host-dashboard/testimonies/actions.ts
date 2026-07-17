"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { hasChurchEditAccess } from "@/lib/lessonAuth";
import { updateTestimonyChurchStatus } from "@/services/supabase/testimonies";
import { TestimonyChurchStatus } from "@/types";

export async function updateChurchTestimonyStatusAction(
  testimonyId: string,
  churchId: string,
  status: TestimonyChurchStatus
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "You must be signed in to review testimonies." };

    const { data: membership } = await supabase
      .from("church_memberships")
      .select("role")
      .eq("profile_id", user.id)
      .eq("church_id", churchId)
      .maybeSingle();
    if (!hasChurchEditAccess(membership?.role)) {
      return { error: "You are not authorized to review this church's testimonies." };
    }

    await updateTestimonyChurchStatus(supabase, testimonyId, status);
    revalidatePath("/host-dashboard/testimonies");
    revalidatePath("/host-dashboard");
    return {};
  } catch (err) {
    if (err instanceof SupabaseConfigError) return { error: err.message };
    console.error("[updateChurchTestimonyStatusAction] Unexpected error:", err);
    return { error: "Couldn't update that testimony. Please try again." };
  }
}

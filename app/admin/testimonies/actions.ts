"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { updateTestimonyPlatformStatus } from "@/services/supabase/testimonies";
import { TestimonyPlatformStatus } from "@/types";

export async function updatePlatformTestimonyStatusAction(
  testimonyId: string,
  status: TestimonyPlatformStatus
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "You must be signed in as a platform administrator." };

    const { data: profile } = await supabase.from("profiles").select("is_platform_admin").eq("id", user.id).maybeSingle();
    if (!profile?.is_platform_admin) return { error: "You are not authorized to moderate testimonies." };

    await updateTestimonyPlatformStatus(supabase, testimonyId, status);
    revalidatePath("/admin/testimonies");
    revalidatePath("/kingdom-scroll");
    return {};
  } catch (err) {
    if (err instanceof SupabaseConfigError) return { error: err.message };
    console.error("[updatePlatformTestimonyStatusAction] Unexpected error:", err);
    return { error: "Couldn't update that testimony. Please try again." };
  }
}

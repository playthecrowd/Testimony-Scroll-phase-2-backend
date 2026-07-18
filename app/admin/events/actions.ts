"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { requirePlatformAdmin } from "@/lib/adminAuth";
import { updateEventStatus, updateEventFeatured } from "@/services/supabase/events";
import { EventStatus } from "@/types";

function revalidateEventPaths(id?: string) {
  revalidatePath("/admin/events");
  revalidatePath("/events");
  if (id) revalidatePath(`/events/${id}`);
}

export async function updateEventStatusAction(id: string, status: EventStatus): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();
    const authError = await requirePlatformAdmin(supabase);
    if (authError) return { error: authError };

    await updateEventStatus(supabase, id, status);
    revalidateEventPaths(id);
    return {};
  } catch (err) {
    if (err instanceof SupabaseConfigError) return { error: err.message };
    console.error("[updateEventStatusAction] Unexpected error:", err);
    return { error: "Couldn't update this event's status. Please try again." };
  }
}

export async function updateEventFeaturedAction(id: string, featured: boolean): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();
    const authError = await requirePlatformAdmin(supabase);
    if (authError) return { error: authError };

    await updateEventFeatured(supabase, id, featured);
    revalidateEventPaths(id);
    return {};
  } catch (err) {
    if (err instanceof SupabaseConfigError) return { error: err.message };
    console.error("[updateEventFeaturedAction] Unexpected error:", err);
    return { error: "Couldn't update this event's featured status. Please try again." };
  }
}

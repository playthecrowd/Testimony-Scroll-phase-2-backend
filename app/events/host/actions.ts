"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { createEventRequest, CreateEventRequestInput } from "@/services/supabase/events";

export interface SubmitEventRequestResult {
  error?: string;
  ok?: boolean;
}

export async function submitEventRequestAction(input: CreateEventRequestInput): Promise<SubmitEventRequestResult> {
  if (!input.title.trim()) return { error: "Event title is required." };
  if (!input.contactEmail.trim()) return { error: "A contact email is required." };

  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "You must be signed in to request an event." };

    await createEventRequest(supabase, input);
    revalidatePath("/events/host");
    return { ok: true };
  } catch (err) {
    if (err instanceof SupabaseConfigError) return { error: err.message };
    console.error("[submitEventRequestAction] Unexpected error:", err);
    return { error: "Something went wrong submitting your request. Please try again." };
  }
}

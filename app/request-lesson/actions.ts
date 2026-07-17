"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { createLessonRequest } from "@/services/supabase/lessonRequests";
import { LessonRequestScope } from "@/types";

export interface SubmitLessonRequestInput {
  topic: string;
  notes: string;
  scope: LessonRequestScope;
  churchId: string | null;
}

export interface SubmitLessonRequestResult {
  error?: string;
  ok?: boolean;
}

export async function submitLessonRequestAction(input: SubmitLessonRequestInput): Promise<SubmitLessonRequestResult> {
  if (!input.topic.trim()) return { error: "A lesson topic is required." };
  if (input.scope === "church" && !input.churchId) return { error: "Choose a church to direct this request to." };

  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "You must be signed in to request a lesson." };

    await createLessonRequest(supabase, {
      topic: input.topic.trim(),
      notes: input.notes.trim(),
      scope: input.scope,
      churchId: input.churchId,
    });

    revalidatePath("/request-lesson");
    return { ok: true };
  } catch (err) {
    if (err instanceof SupabaseConfigError) return { error: err.message };
    console.error("[submitLessonRequestAction] Unexpected error:", err);
    return { error: "Something went wrong submitting your request. Please try again." };
  }
}

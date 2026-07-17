"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { isValidMediaUrl } from "@/lib/lessonForm";
import { createTestimony, CreateTestimonyInput } from "@/services/supabase/testimonies";

export interface SubmitTestimonyResult {
  error?: string;
  ok?: boolean;
}

export async function submitTestimonyAction(input: CreateTestimonyInput): Promise<SubmitTestimonyResult> {
  if (!input.primaryLessonId) return { error: "Choose which lesson this testimony is about." };
  if (!input.title.trim()) return { error: "A title is required." };
  if (!input.writtenTestimony.trim()) return { error: "Your testimony is required." };
  if (input.videoUrl && !isValidMediaUrl(input.videoUrl)) return { error: "Video link doesn't look like a valid web address." };
  if (input.audioUrl && !isValidMediaUrl(input.audioUrl)) return { error: "Audio link doesn't look like a valid web address." };
  if (input.visibility === "public" && !input.storyGenerationPermission) {
    return { error: "Public testimonies require confirming permission to share your story." };
  }

  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "You must be signed in to submit a testimony." };

    // The real completed-lesson enforcement happens server-side in the database
    // (testimonies_before_insert trigger) -- this call's success/failure is the actual gate, not
    // just the form only showing completed lessons as options.
    await createTestimony(supabase, input);

    revalidatePath("/kingdom-scroll/submit");
    revalidatePath("/kingdom-scroll/my-testimonies");
    return { ok: true };
  } catch (err) {
    if (err instanceof SupabaseConfigError) return { error: err.message };
    const message = err instanceof Error ? err.message : "Something went wrong submitting your testimony. Please try again.";
    return { error: message };
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";

export interface PublishLessonResult {
  error?: string;
}

// Plain RLS-gated update -- no RPC needed. The "hosts/admins manage their church's lessons"
// policy already permits this; no multi-table atomicity or privilege bypass is required.
export async function publishLesson(
  lessonId: string,
  lessonSlug: string,
  churchSlug: string
): Promise<PublishLessonResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("lessons").update({ status: "published" }).eq("id", lessonId);
    if (error) return { error: error.message };

    revalidatePath(`/lessons/${lessonSlug}`);
    revalidatePath("/lessons");
    revalidatePath(`/churches/${churchSlug}`);
    return {};
  } catch (err) {
    if (err instanceof SupabaseConfigError) return { error: err.message };
    return { error: "Something went wrong publishing this lesson." };
  }
}

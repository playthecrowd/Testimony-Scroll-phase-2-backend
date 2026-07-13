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
    // .select().maybeSingle() after the update matters: if RLS silently blocks an unauthorized
    // publish attempt, Postgres reports 0 rows affected rather than an error -- without checking
    // for a returned row, this would otherwise report a false "Published!" success.
    const { data, error } = await supabase
      .from("lessons")
      .update({ status: "published" })
      .eq("id", lessonId)
      .select("id")
      .maybeSingle();
    if (error) return { error: error.message };
    if (!data) return { error: "You are not authorized to publish this lesson." };

    revalidatePath(`/lessons/${lessonSlug}`);
    revalidatePath("/lessons");
    revalidatePath("/churches");
    revalidatePath(`/churches/${churchSlug}`);
    revalidatePath("/host-dashboard");
    return {};
  } catch (err) {
    if (err instanceof SupabaseConfigError) return { error: err.message };
    return { error: "Something went wrong publishing this lesson." };
  }
}

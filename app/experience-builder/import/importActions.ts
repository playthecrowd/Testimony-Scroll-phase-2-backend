"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { hasChurchEditAccess } from "@/lib/lessonAuth";
import { createRegularLessonsBatch, RegularLessonBatchInput } from "@/services/supabase/lessons";
import { replaceLessonQuestions } from "@/services/supabase/questions";
import { parseAndValidateRegularLessonCsv } from "@/lib/regularLessonCsv";

export interface ImportRegularLessonsResult {
  error?: string;
  rowErrors?: { rowNumber: number; errors: string[] }[];
  importedCount?: number;
  importedTitles?: string[];
  rowWarnings?: string[];
}

// Church-scoped counterpart to importCampaignLessonsCsvAction (platform-admin-only). The critical
// difference: churchId is NEVER read from the CSV (RegularLessonInput has no such field at all --
// see lib/regularLessonCsv.ts) and is instead required as an explicit argument, verified here
// against the CALLER's own church_memberships row before anything is imported -- the same
// authorization check submitLessonDraft (app/experience-builder/actions.ts) already performs for a
// single manual creation, so a host can only ever bulk-import into a church they actually manage.
// createRegularLessonsBatch's own RPC calls are RLS-gated on top of this as a second, structural
// layer, not the only one.
export async function importRegularLessonsCsvAction(csvText: string, churchId: string): Promise<ImportRegularLessonsResult> {
  if (!churchId) return { error: "A church is required." };

  const { rows, headerErrors } = parseAndValidateRegularLessonCsv(csvText);
  if (headerErrors.length > 0) return { error: headerErrors.join(" ") };
  if (rows.length === 0) return { error: "The file has no data rows to import." };

  const rowErrors = rows.filter((r) => r.errors.length > 0).map((r) => ({ rowNumber: r.rowNumber, errors: r.errors }));
  if (rowErrors.length > 0) return { rowErrors };

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "You must be signed in to import lessons." };

    const { data: membership } = await supabase
      .from("church_memberships")
      .select("role")
      .eq("profile_id", user.id)
      .eq("church_id", churchId)
      .maybeSingle();
    if (!hasChurchEditAccess(membership?.role)) {
      return { error: "You are not authorized to import lessons for that church." };
    }

    const { data: church } = await supabase.from("churches").select("slug").eq("id", churchId).maybeSingle();
    const churchSlug = church?.slug ?? churchId;

    // row.input is guaranteed non-null here -- rows with validation errors already returned above.
    const inputs: RegularLessonBatchInput[] = rows.map((r) => ({
      title: r.input!.title,
      shortDescription: r.input!.shortDescription,
      aboutText: r.input!.aboutText,
      primaryScripture: r.input!.primaryScripture,
      speakerName: r.input!.speakerName,
      media: r.media,
    }));
    const batchResults = await createRegularLessonsBatch(supabase, churchId, inputs);

    const rowWarnings: string[] = [];
    const importedTitles: string[] = [];

    for (let i = 0; i < batchResults.length; i++) {
      const result = batchResults[i];
      const row = rows[i];
      if (result.error || !result.lessonId) {
        rowWarnings.push(`Row ${row.rowNumber} ("${row.input!.title}") could not be created: ${result.error ?? "unknown error"}.`);
        continue;
      }
      importedTitles.push(row.input!.title);

      // Thumbnail and background image have no RPC parameter (same reasoning as the manual
      // create/edit forms -- see app/lessons/[lessonId]/actions.ts's updateLessonThumbnail) --
      // applied as a follow-up update only when provided, so a row without one never triggers an
      // unnecessary write.
      if (row.input!.featuredImageUrl) {
        const { error: thumbError } = await supabase
          .from("lessons")
          .update({ featured_image_url: row.input!.featuredImageUrl })
          .eq("id", result.lessonId);
        if (thumbError) {
          rowWarnings.push(`Row ${row.rowNumber} ("${row.input!.title}") saved, but its thumbnail failed to save.`);
        }
      }
      if (row.input!.backgroundImageUrl) {
        const { error: bgError } = await supabase
          .from("lessons")
          .update({ background_image_url: row.input!.backgroundImageUrl })
          .eq("id", result.lessonId);
        if (bgError) {
          rowWarnings.push(`Row ${row.rowNumber} ("${row.input!.title}") saved, but its background image failed to save.`);
        }
      }

      if (row.questions.length > 0) {
        try {
          await replaceLessonQuestions(supabase, result.lessonId, row.questions);
        } catch (err) {
          console.error("[importRegularLessonsCsvAction] Failed to save questions for row:", row.rowNumber, err);
          rowWarnings.push(`Row ${row.rowNumber} ("${row.input!.title}") saved, but its questions failed to import.`);
        }
      }

      if (row.input!.published) {
        const { error: publishError } = await supabase.from("lessons").update({ status: "published" }).eq("id", result.lessonId);
        if (publishError) {
          rowWarnings.push(`Row ${row.rowNumber} ("${row.input!.title}") saved as a draft -- it couldn't be published automatically.`);
        }
      }
    }

    if (importedTitles.length === 0) {
      return { error: "None of the rows could be imported. " + rowWarnings.join(" ") };
    }

    revalidatePath("/experience-builder");
    revalidatePath("/host-dashboard");
    revalidatePath(`/churches/${churchSlug}`);
    revalidatePath("/lessons");
    return { importedCount: importedTitles.length, importedTitles, rowWarnings: rowWarnings.length > 0 ? rowWarnings : undefined };
  } catch (err) {
    if (err instanceof SupabaseConfigError) return { error: err.message };
    console.error("[importRegularLessonsCsvAction] Unexpected error:", err);
    return { error: "Something went wrong importing these lessons. Please try again." };
  }
}

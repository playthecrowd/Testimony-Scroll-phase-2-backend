"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { requirePlatformAdmin } from "@/lib/adminAuth";
import { logAdminAction } from "@/lib/adminAuditLog";
import { createCampaignLessonsBatch, CampaignLessonInput } from "@/services/supabase/lessons";
import { replaceLessonQuestions } from "@/services/supabase/questions";
import { parseAndValidateCampaignLessonCsv } from "@/lib/campaignLessonCsv";

export interface ImportCampaignLessonsResult {
  error?: string;
  rowErrors?: { rowNumber: number; errors: string[] }[];
  importedCount?: number;
  importedTitles?: string[];
  questionWarnings?: string[];
}

// Re-parses and re-validates the raw CSV text server-side rather than trusting the client's own
// preview pass -- the client-side preview (same shared lib/campaignLessonCsv.ts functions) is UX
// only, not the authorization/validation boundary. All-or-nothing: if any row fails validation,
// nothing is imported, and the admin gets back exactly which rows/fields to fix -- matches "do not
// import invalid rows silently."
export async function importCampaignLessonsCsvAction(csvText: string): Promise<ImportCampaignLessonsResult> {
  const { rows, headerErrors } = parseAndValidateCampaignLessonCsv(csvText);
  if (headerErrors.length > 0) return { error: headerErrors.join(" ") };
  if (rows.length === 0) return { error: "The file has no data rows to import." };

  const rowErrors = rows.filter((r) => r.errors.length > 0).map((r) => ({ rowNumber: r.rowNumber, errors: r.errors }));
  if (rowErrors.length > 0) return { rowErrors };

  try {
    const supabase = await createClient();
    const authError = await requirePlatformAdmin(supabase);
    if (authError) return { error: authError };

    // row.input is guaranteed non-null here -- rows with validation errors already returned above.
    const inputs = rows.map((r) => r.input as CampaignLessonInput);
    const created = await createCampaignLessonsBatch(supabase, inputs);
    const importedTitles = created.map((l) => l.title);

    // Best-effort, not all-or-nothing -- unlike the row-field validation above, every row's
    // question set is already known-complete-or-empty by this point (validateCampaignLessonRow
    // already rejected incomplete question sets before rowErrors was checked), so a failure here
    // is a genuine DB/network error on already-valid data, not a data problem. The lesson rows
    // themselves are already saved; a question-save failure shouldn't roll that back.
    const questionWarnings: string[] = [];
    for (let i = 0; i < created.length; i++) {
      const questions = rows[i].questions;
      if (questions.length === 0) continue;
      try {
        await replaceLessonQuestions(supabase, created[i].id, questions);
      } catch (err) {
        console.error("[importCampaignLessonsCsvAction] Failed to save questions for row:", rows[i].rowNumber, err);
        questionWarnings.push(`"${created[i].title}" (row ${rows[i].rowNumber}) saved, but its questions failed to import.`);
      }
    }

    await logAdminAction(supabase, {
      action: "bulk_import",
      entityType: "campaign_lesson",
      detail: `Imported ${importedTitles.length} campaign lessons via CSV.`,
    });
    revalidatePath("/admin/campaign-lessons");
    revalidatePath("/");
    revalidatePath("/lessons");
    return { importedCount: importedTitles.length, importedTitles, questionWarnings: questionWarnings.length > 0 ? questionWarnings : undefined };
  } catch (err) {
    if (err instanceof SupabaseConfigError) return { error: err.message };
    console.error("[importCampaignLessonsCsvAction] Unexpected error:", err);
    return { error: "Something went wrong importing these campaign lessons. No rows were saved -- please try again." };
  }
}

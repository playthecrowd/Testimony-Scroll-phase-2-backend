"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { hasChurchEditAccess } from "@/lib/lessonAuth";
import {
  validateExperienceInput,
  validateOccurrenceInput,
  findDuplicateLessonSelections,
  ValidateExperienceInput,
} from "@/lib/churchExperienceForm";
import {
  ChurchExperience,
  ChurchExperienceAttendanceStatus,
  ChurchExperienceCompletionStatus,
  ChurchExperienceOccurrence,
  ChurchExperienceRegistrationStatus,
} from "@/types";
import {
  createExperience,
  updateExperience,
  updateExperienceStatus,
  getExperienceById,
  createOccurrence,
  updateOccurrence,
  cancelOccurrence,
  getOccurrenceById,
  replaceExperienceLessons,
  getRegistrationById,
  updateRegistrationStatus,
  updateAttendanceStatus as updateAttendanceStatusService,
  updateCompletionStatus as updateCompletionStatusService,
  finalizeOccurrenceAttendance,
  promoteWaitlistRegistration,
  recordWalkIn,
} from "@/services/supabase/churchExperiences";

// Host/admin server actions for the Experience Platform (Phase 10.3, checkpoint 1). Every action
// here follows the exact shape already established by
// app/host-dashboard/church-profile/actions.ts's updateChurchProfileAction: validate input
// synchronously first, authenticate, re-verify church_memberships role for the SPECIFIC church
// involved (defense-in-depth -- RLS/the RPCs remain the real gate), call the centralized
// service/RPC layer, revalidate affected routes, and never leak a raw Supabase error message to
// the UI. A browser-supplied churchId/experienceId/occurrenceId/registrationId is never trusted --
// every action re-derives or re-checks the owning church server-side before writing anything.

export interface ActionResult<T = undefined> {
  error?: string;
  ok?: boolean;
  data?: T;
}

async function requireSignedIn(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

async function requireChurchAccess(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, churchId: string): Promise<string | null> {
  const { data: membership } = await supabase
    .from("church_memberships")
    .select("role")
    .eq("profile_id", userId)
    .eq("church_id", churchId)
    .maybeSingle();
  if (!hasChurchEditAccess(membership?.role)) return "You are not authorized to manage this church's Experiences.";
  return null;
}

// Resolves an Experience by id and verifies the caller manages its church -- the shared
// "authorized experience" guard used by every Experience/occurrence/lesson-link action below, so
// a forged experienceId belonging to a church the caller doesn't manage is rejected before any
// write is attempted (never relies on the client's own claim of which church it belongs to).
async function getAuthorizedExperience(
  supabase: Awaited<ReturnType<typeof createClient>>,
  experienceId: string
): Promise<{ error: string } | { experience: ChurchExperience }> {
  const user = await requireSignedIn(supabase);
  if (!user) return { error: "You must be signed in." };

  const experience = await getExperienceById(supabase, experienceId);
  if (!experience) return { error: "That Experience could not be found." };

  const accessError = await requireChurchAccess(supabase, user.id, experience.churchId);
  if (accessError) return { error: accessError };

  return { experience };
}

async function getAuthorizedOccurrence(
  supabase: Awaited<ReturnType<typeof createClient>>,
  occurrenceId: string
): Promise<{ error: string } | { occurrence: ChurchExperienceOccurrence }> {
  const user = await requireSignedIn(supabase);
  if (!user) return { error: "You must be signed in." };

  const occurrence = await getOccurrenceById(supabase, occurrenceId);
  if (!occurrence) return { error: "That occurrence could not be found." };

  const accessError = await requireChurchAccess(supabase, user.id, occurrence.churchId);
  if (accessError) return { error: accessError };

  return { occurrence };
}

async function getAuthorizedRegistration(
  supabase: Awaited<ReturnType<typeof createClient>>,
  registrationId: string
): Promise<{ error: string } | { occurrence: ChurchExperienceOccurrence }> {
  const user = await requireSignedIn(supabase);
  if (!user) return { error: "You must be signed in." };

  const registration = await getRegistrationById(supabase, registrationId);
  if (!registration) return { error: "That registration could not be found." };

  const occurrence = await getOccurrenceById(supabase, registration.occurrenceId);
  if (!occurrence) return { error: "That occurrence could not be found." };

  const accessError = await requireChurchAccess(supabase, user.id, occurrence.churchId);
  if (accessError) return { error: accessError };

  return { occurrence };
}

function safeErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof SupabaseConfigError) return err.message;
  // Postgres RAISE EXCEPTION messages from our own RPCs/triggers are already written as clear,
  // safe, user-facing text (never a raw constraint name or stack trace) -- surface those directly.
  // Anything else (a real unexpected error) gets logged and replaced with a generic message so no
  // internal detail (table names, SQL, stack traces) ever reaches the client.
  if (err && typeof err === "object" && "message" in err && typeof (err as { message?: unknown }).message === "string") {
    const message = (err as { message: string }).message;
    const looksLikeOurOwnException = !/^(new row|duplicate key|null value|permission denied|relation |column )/i.test(message);
    if (looksLikeOurOwnException && message.length < 300) return message;
  }
  console.error(fallback, err);
  return fallback;
}

// ---------------------------------------------------------------------------
// Experience definitions
// ---------------------------------------------------------------------------

export interface CreateExperienceActionInput extends ValidateExperienceInput {
  summary: string;
  fullDescription: string;
  locationName: string;
  addressLine1: string;
  city: string;
  region: string;
  country: string;
  onlineUrl: string;
  coverImageUrl: string;
  ageGuidance: string;
  accessibilityNotes: string;
  preparationInstructions: string;
  whatToBring: string;
  registrationRequired: boolean;
  approvalRequired: boolean;
  defaultDurationMinutes: number | null;
  // Optional: no existing host UI collects this yet (Phase 11.2 is service/RPC-layer only, per its
  // explicit "no UI" scope) -- defaults to null (free) when omitted, exactly like an Experience
  // created before this phase existed.
  defaultCreditCost?: number | null;
}

export async function createExperienceAction(input: CreateExperienceActionInput): Promise<ActionResult<{ id: string }>> {
  const fieldErrors = validateExperienceInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return { error: Object.values(fieldErrors)[0] };
  }

  try {
    const supabase = await createClient();
    const user = await requireSignedIn(supabase);
    if (!user) return { error: "You must be signed in to create an Experience." };

    const accessError = await requireChurchAccess(supabase, user.id, input.churchId);
    if (accessError) return { error: accessError };

    const experience = await createExperience(supabase, {
      churchId: input.churchId,
      ministryId: input.ministryId ?? null,
      title: input.title.trim(),
      summary: input.summary?.trim() || null,
      fullDescription: input.fullDescription?.trim() || null,
      type: input.type,
      customTypeLabel: input.type === "custom" ? input.customTypeLabel?.trim() || null : null,
      format: input.format,
      locationName: input.locationName?.trim() || null,
      addressLine1: input.addressLine1?.trim() || null,
      city: input.city?.trim() || null,
      region: input.region?.trim() || null,
      country: input.country?.trim() || null,
      onlineUrl: input.onlineUrl?.trim() || null,
      coverImageUrl: input.coverImageUrl?.trim() || null,
      ageGuidance: input.ageGuidance?.trim() || null,
      accessibilityNotes: input.accessibilityNotes?.trim() || null,
      preparationInstructions: input.preparationInstructions?.trim() || null,
      whatToBring: input.whatToBring?.trim() || null,
      visibility: input.visibility,
      registrationRequired: input.registrationRequired,
      approvalRequired: input.approvalRequired,
      defaultCapacity: input.defaultCapacity ?? null,
      defaultDurationMinutes: input.defaultDurationMinutes ?? null,
      completionMethod: input.completionMethod,
      defaultCreditCost: input.defaultCreditCost ?? null,
    });

    revalidatePath("/host-dashboard/experiences");
    return { ok: true, data: { id: experience.id } };
  } catch (err) {
    return { error: safeErrorMessage(err, "Couldn't create this Experience. Please try again.") };
  }
}

export type UpdateExperienceActionInput = Partial<CreateExperienceActionInput> & { experienceId: string };

export async function updateExperienceAction(input: UpdateExperienceActionInput): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const authorized = await getAuthorizedExperience(supabase, input.experienceId);
    if ("error" in authorized) return { error: authorized.error };

    if (authorized.experience.status === "archived") {
      return { error: "An archived Experience cannot be edited. Restore it to draft first." };
    }

    const merged: ValidateExperienceInput = {
      churchId: authorized.experience.churchId,
      title: input.title ?? authorized.experience.title,
      type: input.type ?? authorized.experience.type,
      customTypeLabel: input.customTypeLabel ?? authorized.experience.customTypeLabel,
      format: input.format ?? authorized.experience.format,
      visibility: input.visibility ?? authorized.experience.visibility,
      completionMethod: input.completionMethod ?? authorized.experience.completionMethod,
      ministryId: input.ministryId ?? authorized.experience.ministryId,
      defaultCapacity: input.defaultCapacity ?? authorized.experience.defaultCapacity,
      defaultCreditCost: input.defaultCreditCost ?? authorized.experience.defaultCreditCost,
    };
    const fieldErrors = validateExperienceInput(merged);
    if (Object.keys(fieldErrors).length > 0) return { error: Object.values(fieldErrors)[0] };

    await updateExperience(supabase, input.experienceId, {
      ministryId: input.ministryId,
      title: input.title?.trim(),
      summary: input.summary !== undefined ? input.summary.trim() || null : undefined,
      fullDescription: input.fullDescription !== undefined ? input.fullDescription.trim() || null : undefined,
      type: input.type,
      customTypeLabel: merged.type === "custom" ? input.customTypeLabel?.trim() || null : input.customTypeLabel === undefined ? undefined : null,
      format: input.format,
      locationName: input.locationName !== undefined ? input.locationName.trim() || null : undefined,
      addressLine1: input.addressLine1 !== undefined ? input.addressLine1.trim() || null : undefined,
      city: input.city !== undefined ? input.city.trim() || null : undefined,
      region: input.region !== undefined ? input.region.trim() || null : undefined,
      country: input.country !== undefined ? input.country.trim() || null : undefined,
      onlineUrl: input.onlineUrl !== undefined ? input.onlineUrl.trim() || null : undefined,
      coverImageUrl: input.coverImageUrl !== undefined ? input.coverImageUrl.trim() || null : undefined,
      ageGuidance: input.ageGuidance !== undefined ? input.ageGuidance.trim() || null : undefined,
      accessibilityNotes: input.accessibilityNotes !== undefined ? input.accessibilityNotes.trim() || null : undefined,
      preparationInstructions: input.preparationInstructions !== undefined ? input.preparationInstructions.trim() || null : undefined,
      whatToBring: input.whatToBring !== undefined ? input.whatToBring.trim() || null : undefined,
      visibility: input.visibility,
      registrationRequired: input.registrationRequired,
      approvalRequired: input.approvalRequired,
      defaultCapacity: input.defaultCapacity,
      defaultDurationMinutes: input.defaultDurationMinutes,
      completionMethod: input.completionMethod,
      defaultCreditCost: input.defaultCreditCost,
    });

    revalidatePath("/host-dashboard/experiences");
    revalidatePath(`/host-dashboard/experiences/${input.experienceId}`);
    return { ok: true };
  } catch (err) {
    return { error: safeErrorMessage(err, "Couldn't update this Experience. Please try again.") };
  }
}

export async function updateExperienceStatusAction(
  experienceId: string,
  status: "draft" | "published" | "archived"
): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const authorized = await getAuthorizedExperience(supabase, experienceId);
    if ("error" in authorized) return { error: authorized.error };

    if (status === "published") {
      const fieldErrors = validateExperienceInput(authorized.experience);
      if (Object.keys(fieldErrors).length > 0) {
        return { error: "This Experience is missing required information and can't be published yet." };
      }
    }

    await updateExperienceStatus(supabase, experienceId, status);

    revalidatePath("/host-dashboard/experiences");
    revalidatePath(`/host-dashboard/experiences/${experienceId}`);
    revalidatePath("/experiences");
    return { ok: true };
  } catch (err) {
    return { error: safeErrorMessage(err, "Couldn't update this Experience's status. Please try again.") };
  }
}

// ---------------------------------------------------------------------------
// Occurrences
// ---------------------------------------------------------------------------

export interface CreateOccurrenceActionInput {
  experienceId: string;
  startsAt: string;
  endsAt: string | null;
  timezone: string;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  capacity: number | null;
  locationName: string | null;
  onlineUrl: string | null;
  hostContactName: string | null;
  hostContactEmail: string | null;
  // Optional for the same reason as CreateExperienceActionInput.defaultCreditCost -- no existing
  // host UI collects this yet; defaults to null (use the Experience's own default) when omitted.
  creditCost?: number | null;
}

export async function createOccurrenceAction(input: CreateOccurrenceActionInput): Promise<ActionResult<{ id: string }>> {
  try {
    const supabase = await createClient();
    const authorized = await getAuthorizedExperience(supabase, input.experienceId);
    if ("error" in authorized) return { error: authorized.error };
    const { experience } = authorized;

    if (experience.status === "archived") {
      return { error: "Archived Experiences cannot receive new occurrences." };
    }

    const fieldErrors = validateOccurrenceInput({
      ...input,
      churchId: experience.churchId,
      experienceFormat: experience.format,
      experienceLocationName: experience.locationName,
      experienceOnlineUrl: experience.onlineUrl,
    });
    if (Object.keys(fieldErrors).length > 0) return { error: Object.values(fieldErrors)[0] };

    const occurrence = await createOccurrence(supabase, {
      experienceId: input.experienceId,
      churchId: experience.churchId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      timezone: input.timezone,
      registrationOpensAt: input.registrationOpensAt,
      registrationClosesAt: input.registrationClosesAt,
      capacity: input.capacity,
      locationName: input.locationName,
      onlineUrl: input.onlineUrl,
      hostContactName: input.hostContactName,
      hostContactEmail: input.hostContactEmail,
      creditCost: input.creditCost ?? null,
    });

    revalidatePath(`/host-dashboard/experiences/${input.experienceId}`);
    return { ok: true, data: { id: occurrence.id } };
  } catch (err) {
    return { error: safeErrorMessage(err, "Couldn't schedule this occurrence. Please try again.") };
  }
}

export type UpdateOccurrenceActionInput = Partial<CreateOccurrenceActionInput> & { occurrenceId: string };

export async function updateOccurrenceAction(input: UpdateOccurrenceActionInput): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const authorized = await getAuthorizedOccurrence(supabase, input.occurrenceId);
    if ("error" in authorized) return { error: authorized.error };
    const { occurrence } = authorized;

    const experience = await getExperienceById(supabase, occurrence.experienceId);
    if (!experience) return { error: "The parent Experience could not be found." };

    const fieldErrors = validateOccurrenceInput({
      experienceId: occurrence.experienceId,
      churchId: occurrence.churchId,
      experienceFormat: experience.format,
      experienceLocationName: experience.locationName,
      experienceOnlineUrl: experience.onlineUrl,
      startsAt: input.startsAt ?? occurrence.startsAt,
      endsAt: input.endsAt !== undefined ? input.endsAt : occurrence.endsAt,
      timezone: input.timezone ?? occurrence.timezone,
      locationName: input.locationName !== undefined ? input.locationName : occurrence.locationName,
      onlineUrl: input.onlineUrl !== undefined ? input.onlineUrl : occurrence.onlineUrl,
      capacity: input.capacity !== undefined ? input.capacity : occurrence.capacity,
      creditCost: input.creditCost !== undefined ? input.creditCost : occurrence.creditCost,
    });
    if (Object.keys(fieldErrors).length > 0) return { error: Object.values(fieldErrors)[0] };

    await updateOccurrence(supabase, input.occurrenceId, {
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      timezone: input.timezone,
      registrationOpensAt: input.registrationOpensAt,
      registrationClosesAt: input.registrationClosesAt,
      capacity: input.capacity,
      locationName: input.locationName,
      onlineUrl: input.onlineUrl,
      hostContactName: input.hostContactName,
      hostContactEmail: input.hostContactEmail,
      creditCost: input.creditCost,
    });

    revalidatePath(`/host-dashboard/experiences/${occurrence.experienceId}`);
    revalidatePath(`/host-dashboard/experiences/${occurrence.experienceId}/occurrences/${input.occurrenceId}`);
    return { ok: true };
  } catch (err) {
    return { error: safeErrorMessage(err, "Couldn't update this occurrence. Please try again.") };
  }
}

export async function cancelOccurrenceAction(occurrenceId: string, reason: string): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const authorized = await getAuthorizedOccurrence(supabase, occurrenceId);
    if ("error" in authorized) return { error: authorized.error };

    await cancelOccurrence(supabase, occurrenceId, reason?.trim() || null);

    revalidatePath(`/host-dashboard/experiences/${authorized.occurrence.experienceId}`);
    revalidatePath("/experiences");
    return { ok: true };
  } catch (err) {
    return { error: safeErrorMessage(err, "Couldn't cancel this occurrence. Please try again.") };
  }
}

// ---------------------------------------------------------------------------
// Lesson relationships
// ---------------------------------------------------------------------------

export interface LessonSelectionInput {
  lessonId: string;
  relationship: "required" | "recommended";
  sortOrder: number;
  hostNotes: string;
  reflectionPromptOverride: string;
}

export async function replaceExperienceLessonsAction(experienceId: string, selections: LessonSelectionInput[]): Promise<ActionResult> {
  const duplicates = findDuplicateLessonSelections(selections.map((s) => s.lessonId));
  if (duplicates.length > 0) return { error: "Each lesson can only be attached once to this Experience." };

  try {
    const supabase = await createClient();
    const authorized = await getAuthorizedExperience(supabase, experienceId);
    if ("error" in authorized) return { error: authorized.error };

    await replaceExperienceLessons(
      supabase,
      experienceId,
      selections.map((s) => ({
        lessonId: s.lessonId,
        relationship: s.relationship,
        sortOrder: s.sortOrder,
        hostNotes: s.hostNotes?.trim() || null,
        reflectionPromptOverride: s.reflectionPromptOverride?.trim() || null,
      }))
    );

    revalidatePath(`/host-dashboard/experiences/${experienceId}`);
    return { ok: true };
  } catch (err) {
    return { error: safeErrorMessage(err, "Couldn't update this Experience's lessons. Please try again.") };
  }
}

// ---------------------------------------------------------------------------
// Registrations, walk-ins, attendance, completion
// ---------------------------------------------------------------------------

export async function updateRegistrationStatusAction(
  registrationId: string,
  status: Extract<ChurchExperienceRegistrationStatus, "confirmed" | "rejected">
): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const authorized = await getAuthorizedRegistration(supabase, registrationId);
    if ("error" in authorized) return { error: authorized.error };

    await updateRegistrationStatus(supabase, registrationId, status);

    revalidatePath(`/host-dashboard/experiences/${authorized.occurrence.experienceId}/occurrences/${authorized.occurrence.id}`);
    return { ok: true };
  } catch (err) {
    return { error: safeErrorMessage(err, "Couldn't update this registration. Please try again.") };
  }
}

export async function promoteWaitlistRegistrationAction(occurrenceId: string): Promise<ActionResult<{ promoted: boolean }>> {
  try {
    const supabase = await createClient();
    const authorized = await getAuthorizedOccurrence(supabase, occurrenceId);
    if ("error" in authorized) return { error: authorized.error };

    const promoted = await promoteWaitlistRegistration(supabase, occurrenceId);

    revalidatePath(`/host-dashboard/experiences/${authorized.occurrence.experienceId}/occurrences/${occurrenceId}`);
    return { ok: true, data: { promoted: !!promoted } };
  } catch (err) {
    return { error: safeErrorMessage(err, "Couldn't promote a registration from the waitlist. Please try again.") };
  }
}

export async function recordWalkInAction(
  occurrenceId: string,
  profileId: string,
  attendanceStatus: ChurchExperienceAttendanceStatus = "attended",
  overrideCapacity = false
): Promise<ActionResult<{ id: string }>> {
  try {
    const supabase = await createClient();
    const authorized = await getAuthorizedOccurrence(supabase, occurrenceId);
    if ("error" in authorized) return { error: authorized.error };

    const registration = await recordWalkIn(supabase, occurrenceId, profileId, attendanceStatus, overrideCapacity);

    revalidatePath(`/host-dashboard/experiences/${authorized.occurrence.experienceId}/occurrences/${occurrenceId}`);
    return { ok: true, data: { id: registration.id } };
  } catch (err) {
    return { error: safeErrorMessage(err, "Couldn't record this walk-in. Please try again.") };
  }
}

export async function updateAttendanceStatusAction(registrationId: string, status: ChurchExperienceAttendanceStatus): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const authorized = await getAuthorizedRegistration(supabase, registrationId);
    if ("error" in authorized) return { error: authorized.error };

    await updateAttendanceStatusService(supabase, registrationId, status);

    revalidatePath(`/host-dashboard/experiences/${authorized.occurrence.experienceId}/occurrences/${authorized.occurrence.id}`);
    return { ok: true };
  } catch (err) {
    return { error: safeErrorMessage(err, "Couldn't update attendance. Please try again.") };
  }
}

export async function updateCompletionStatusAction(registrationId: string, status: ChurchExperienceCompletionStatus): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const authorized = await getAuthorizedRegistration(supabase, registrationId);
    if ("error" in authorized) return { error: authorized.error };

    if (status === "completed" && authorized.occurrence.status === "cancelled") {
      return { error: "Cannot record completion for a cancelled occurrence." };
    }

    await updateCompletionStatusService(supabase, registrationId, status);

    revalidatePath(`/host-dashboard/experiences/${authorized.occurrence.experienceId}/occurrences/${authorized.occurrence.id}`);
    return { ok: true };
  } catch (err) {
    return { error: safeErrorMessage(err, "Couldn't update completion. Please try again.") };
  }
}

export async function finalizeOccurrenceAttendanceAction(occurrenceId: string): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const authorized = await getAuthorizedOccurrence(supabase, occurrenceId);
    if ("error" in authorized) return { error: authorized.error };

    await finalizeOccurrenceAttendance(supabase, occurrenceId);

    revalidatePath(`/host-dashboard/experiences/${authorized.occurrence.experienceId}/occurrences/${occurrenceId}`);
    return { ok: true };
  } catch (err) {
    return { error: safeErrorMessage(err, "Couldn't finalize attendance. Please try again.") };
  }
}

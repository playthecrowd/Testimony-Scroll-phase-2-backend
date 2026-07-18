import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ChurchExperience,
  ChurchExperienceCompletionMethod,
  ChurchExperienceFormat,
  ChurchExperienceLessonLink,
  ChurchExperienceLessonRelationship,
  ChurchExperienceStatus,
  ChurchExperienceType,
  ChurchExperienceVisibility,
} from "@/types";

// Phase 10.2 (docs/PHASE10_IMPLEMENTATION_PLAN.md) -- data-only query/mutation layer over the
// church_experiences schema landed in Phase 10.1 (migrations 0022-0024). No UI, page, or route
// consumes this yet; that starts in Phase 10.3+. These accept a Supabase client instance rather
// than constructing their own, matching every other services/supabase/*.ts module, so the same
// query logic works from a Server Component or a client component without pulling server-only
// code into the client bundle. Registration/cancellation/waitlist-promotion/walk-in mutations are
// deliberately NOT here -- they only ever go through the SECURITY DEFINER RPCs added in Phase
// 10.1 (register_for_experience_occurrence, cancel_experience_registration,
// promote_waitlist_registration, record_experience_walk_in), called directly via
// `supabase.rpc(...)` wherever Phase 10.6/10.7 end up needing them, not wrapped here.

const CHURCH_EXPERIENCE_SELECT = `
  id, church_id, ministry_id, created_by, title, summary, full_description, type,
  custom_type_label, format, location_name, address_line1, city, region, country, online_url,
  cover_image_url, age_guidance, accessibility_notes, preparation_instructions, what_to_bring,
  status, visibility, registration_required, approval_required, default_capacity,
  default_duration_minutes, completion_method, created_at, updated_at, published_at, archived_at
`;

const CHURCH_EXPERIENCE_LESSON_SELECT =
  "id, experience_id, lesson_id, relationship, sort_order, host_notes, reflection_prompt_override, created_at";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapChurchExperience(row: any): ChurchExperience {
  return {
    id: row.id,
    churchId: row.church_id,
    ministryId: row.ministry_id,
    createdBy: row.created_by,
    title: row.title,
    summary: row.summary,
    fullDescription: row.full_description,
    type: row.type,
    customTypeLabel: row.custom_type_label,
    format: row.format,
    locationName: row.location_name,
    addressLine1: row.address_line1,
    city: row.city,
    region: row.region,
    country: row.country,
    onlineUrl: row.online_url,
    coverImageUrl: row.cover_image_url,
    ageGuidance: row.age_guidance,
    accessibilityNotes: row.accessibility_notes,
    preparationInstructions: row.preparation_instructions,
    whatToBring: row.what_to_bring,
    status: row.status,
    visibility: row.visibility,
    registrationRequired: row.registration_required,
    approvalRequired: row.approval_required,
    defaultCapacity: row.default_capacity,
    defaultDurationMinutes: row.default_duration_minutes,
    completionMethod: row.completion_method,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
    archivedAt: row.archived_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapChurchExperienceLessonLink(row: any): ChurchExperienceLessonLink {
  return {
    id: row.id,
    experienceId: row.experience_id,
    lessonId: row.lesson_id,
    relationship: row.relationship,
    sortOrder: row.sort_order ?? 0,
    hostNotes: row.host_notes,
    reflectionPromptOverride: row.reflection_prompt_override,
    createdAt: row.created_at,
  };
}

// church_id is always an explicit parameter here and in every function below -- never assumed
// from "the caller's only church" -- so a future multi-church switcher only has to change which
// churchId a page passes in, never this module (owner decision 3 of 10, 2026-07-18).
export async function getManagedExperiences(supabase: SupabaseClient, churchId: string): Promise<ChurchExperience[]> {
  const { data, error } = await supabase
    .from("church_experiences")
    .select(CHURCH_EXPERIENCE_SELECT)
    .eq("church_id", churchId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapChurchExperience);
}

// RLS-gated exactly like getLessonBySlug/getEventById: a published Experience is visible to any
// member of its church, a draft only to that church's host/admin -- no separate "preview" query
// needed.
export async function getExperienceById(supabase: SupabaseClient, id: string): Promise<ChurchExperience | null> {
  const { data, error } = await supabase.from("church_experiences").select(CHURCH_EXPERIENCE_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapChurchExperience(data) : null;
}

// Member-facing discovery: church-scoped only, no public/cross-church discovery (owner decision 4
// of 10, 2026-07-18) -- takes every church the caller belongs to (usually one today, per the
// existing single-active-church convention), never a single implicit church.
export async function getPublishedExperiencesForMember(supabase: SupabaseClient, churchIds: string[]): Promise<ChurchExperience[]> {
  if (churchIds.length === 0) return [];
  const { data, error } = await supabase
    .from("church_experiences")
    .select(CHURCH_EXPERIENCE_SELECT)
    .eq("status", "published")
    .in("church_id", churchIds)
    .order("published_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapChurchExperience);
}

export interface CreateExperienceInput {
  churchId: string;
  ministryId: string | null;
  title: string;
  summary: string | null;
  fullDescription: string | null;
  type: ChurchExperienceType;
  customTypeLabel: string | null;
  format: ChurchExperienceFormat;
  locationName: string | null;
  addressLine1: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  onlineUrl: string | null;
  coverImageUrl: string | null;
  ageGuidance: string | null;
  accessibilityNotes: string | null;
  preparationInstructions: string | null;
  whatToBring: string | null;
  visibility: ChurchExperienceVisibility;
  registrationRequired: boolean;
  approvalRequired: boolean;
  defaultCapacity: number | null;
  defaultDurationMinutes: number | null;
  completionMethod: ChurchExperienceCompletionMethod;
}

// Always inserts as status='draft' (the column default) -- publishing is a separate, explicit
// updateExperienceStatus call, never implicit on create (mirrors lessons'/events' own
// draft-by-default shape).
export async function createExperience(supabase: SupabaseClient, input: CreateExperienceInput): Promise<ChurchExperience> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in to create an Experience.");

  const { data, error } = await supabase
    .from("church_experiences")
    .insert({
      church_id: input.churchId,
      ministry_id: input.ministryId,
      created_by: user.id,
      title: input.title,
      summary: input.summary,
      full_description: input.fullDescription,
      type: input.type,
      custom_type_label: input.customTypeLabel,
      format: input.format,
      location_name: input.locationName,
      address_line1: input.addressLine1,
      city: input.city,
      region: input.region,
      country: input.country,
      online_url: input.onlineUrl,
      cover_image_url: input.coverImageUrl,
      age_guidance: input.ageGuidance,
      accessibility_notes: input.accessibilityNotes,
      preparation_instructions: input.preparationInstructions,
      what_to_bring: input.whatToBring,
      visibility: input.visibility,
      registration_required: input.registrationRequired,
      approval_required: input.approvalRequired,
      default_capacity: input.defaultCapacity,
      default_duration_minutes: input.defaultDurationMinutes,
      completion_method: input.completionMethod,
    })
    .select(CHURCH_EXPERIENCE_SELECT)
    .single();
  if (error) throw error;
  return mapChurchExperience(data);
}

// Deliberately excludes churchId/createdBy -- ownership/association fields are never reassignable
// through this function (matches the intent behind testimonies'/lessons' ownership-protection
// triggers, applied here at the service-layer boundary instead of a new database trigger, since
// RLS's is_church_manager(church_id) check alone does not fully prevent a host who manages two
// churches from reassigning an Experience between them -- see docs/PHASE10_1_AUDIT.md's known
// limitations).
export type UpdateExperienceInput = Partial<Omit<CreateExperienceInput, "churchId">>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toUpdatePayload(input: UpdateExperienceInput): Record<string, any> {
  const payload: Record<string, unknown> = {};
  if (input.ministryId !== undefined) payload.ministry_id = input.ministryId;
  if (input.title !== undefined) payload.title = input.title;
  if (input.summary !== undefined) payload.summary = input.summary;
  if (input.fullDescription !== undefined) payload.full_description = input.fullDescription;
  if (input.type !== undefined) payload.type = input.type;
  if (input.customTypeLabel !== undefined) payload.custom_type_label = input.customTypeLabel;
  if (input.format !== undefined) payload.format = input.format;
  if (input.locationName !== undefined) payload.location_name = input.locationName;
  if (input.addressLine1 !== undefined) payload.address_line1 = input.addressLine1;
  if (input.city !== undefined) payload.city = input.city;
  if (input.region !== undefined) payload.region = input.region;
  if (input.country !== undefined) payload.country = input.country;
  if (input.onlineUrl !== undefined) payload.online_url = input.onlineUrl;
  if (input.coverImageUrl !== undefined) payload.cover_image_url = input.coverImageUrl;
  if (input.ageGuidance !== undefined) payload.age_guidance = input.ageGuidance;
  if (input.accessibilityNotes !== undefined) payload.accessibility_notes = input.accessibilityNotes;
  if (input.preparationInstructions !== undefined) payload.preparation_instructions = input.preparationInstructions;
  if (input.whatToBring !== undefined) payload.what_to_bring = input.whatToBring;
  if (input.visibility !== undefined) payload.visibility = input.visibility;
  if (input.registrationRequired !== undefined) payload.registration_required = input.registrationRequired;
  if (input.approvalRequired !== undefined) payload.approval_required = input.approvalRequired;
  if (input.defaultCapacity !== undefined) payload.default_capacity = input.defaultCapacity;
  if (input.defaultDurationMinutes !== undefined) payload.default_duration_minutes = input.defaultDurationMinutes;
  if (input.completionMethod !== undefined) payload.completion_method = input.completionMethod;
  return payload;
}

export async function updateExperience(supabase: SupabaseClient, id: string, input: UpdateExperienceInput): Promise<void> {
  const { error } = await supabase.from("church_experiences").update(toUpdatePayload(input)).eq("id", id);
  if (error) throw error;
}

// Publish stamps published_at; archive stamps archived_at; moving back to draft (host-initiated
// unpublish) leaves whichever timestamp already exists untouched -- it's a historical fact ("this
// was first published/archived at X"), not a live status mirror.
export async function updateExperienceStatus(supabase: SupabaseClient, id: string, status: ChurchExperienceStatus): Promise<void> {
  const patch: { status: ChurchExperienceStatus; published_at?: string; archived_at?: string } = { status };
  if (status === "published") patch.published_at = new Date().toISOString();
  if (status === "archived") patch.archived_at = new Date().toISOString();
  const { error } = await supabase.from("church_experiences").update(patch).eq("id", id);
  if (error) throw error;
}

export async function getExperienceLessons(supabase: SupabaseClient, experienceId: string): Promise<ChurchExperienceLessonLink[]> {
  const { data, error } = await supabase
    .from("church_experience_lessons")
    .select(CHURCH_EXPERIENCE_LESSON_SELECT)
    .eq("experience_id", experienceId)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []).map(mapChurchExperienceLessonLink);
}

// Replaces the full set of lesson links for an Experience. Delete-then-insert rather than a
// precise diff -- mirrors replaceLessonExperiences (services/supabase/experiences.ts) exactly:
// no Storage object or externally-referenced id depends on these rows surviving across an edit.
export async function replaceExperienceLessons(
  supabase: SupabaseClient,
  experienceId: string,
  selections: {
    lessonId: string;
    relationship: ChurchExperienceLessonRelationship;
    sortOrder: number;
    hostNotes: string | null;
    reflectionPromptOverride: string | null;
  }[]
): Promise<void> {
  const { error: deleteError } = await supabase.from("church_experience_lessons").delete().eq("experience_id", experienceId);
  if (deleteError) throw deleteError;

  if (selections.length === 0) return;
  const { error: insertError } = await supabase.from("church_experience_lessons").insert(
    selections.map((s) => ({
      experience_id: experienceId,
      lesson_id: s.lessonId,
      relationship: s.relationship,
      sort_order: s.sortOrder,
      host_notes: s.hostNotes,
      reflection_prompt_override: s.reflectionPromptOverride,
    }))
  );
  if (insertError) throw insertError;
}

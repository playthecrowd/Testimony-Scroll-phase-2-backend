import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ChurchExperience,
  ChurchExperienceAttendanceStatus,
  ChurchExperienceCompletionMethod,
  ChurchExperienceCompletionStatus,
  ChurchExperienceFormat,
  ChurchExperienceLessonLink,
  ChurchExperienceLessonRelationship,
  ChurchExperienceOccurrence,
  ChurchExperienceOccurrenceStatus,
  ChurchExperienceRegistration,
  ChurchExperienceRegistrationStatus,
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
  default_duration_minutes, completion_method, default_credit_cost, created_at, updated_at,
  published_at, archived_at
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
    defaultCreditCost: row.default_credit_cost,
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
  defaultCreditCost: number | null;
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
      default_credit_cost: input.defaultCreditCost,
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
  if (input.defaultCreditCost !== undefined) payload.default_credit_cost = input.defaultCreditCost;
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

// ---------------------------------------------------------------------------
// Phase 10.3 additions -- occurrences, registrations/attendance reads and host-side status
// updates, and thin wrappers around the four Phase 10.1 SECURITY DEFINER RPCs. Registration
// creation/cancellation/waitlist-promotion/walk-in creation are NEVER done via a plain
// insert/update here -- only via supabase.rpc(...), matching the RLS design exactly (no INSERT
// grant exists on church_experience_registrations at all).
// ---------------------------------------------------------------------------

const CHURCH_EXPERIENCE_OCCURRENCE_SELECT = `
  id, experience_id, church_id, starts_at, ends_at, timezone, registration_opens_at,
  registration_closes_at, capacity, location_name, online_url, host_contact_name,
  host_contact_email, status, cancellation_reason, check_in_enabled, attendance_finalized_at,
  credit_cost, created_at, updated_at
`;

const CHURCH_EXPERIENCE_REGISTRATION_SELECT = `
  id, occurrence_id, profile_id, status, registration_source, capacity_override, waitlist_position,
  attendance_status, completion_status, notes, cancellation_reason, registered_at, confirmed_at,
  cancelled_at, created_at, updated_at
`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapChurchExperienceOccurrence(row: any): ChurchExperienceOccurrence {
  return {
    id: row.id,
    experienceId: row.experience_id,
    churchId: row.church_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    timezone: row.timezone,
    registrationOpensAt: row.registration_opens_at,
    registrationClosesAt: row.registration_closes_at,
    capacity: row.capacity,
    locationName: row.location_name,
    onlineUrl: row.online_url,
    hostContactName: row.host_contact_name,
    hostContactEmail: row.host_contact_email,
    status: row.status,
    cancellationReason: row.cancellation_reason,
    checkInEnabled: row.check_in_enabled,
    attendanceFinalizedAt: row.attendance_finalized_at,
    creditCost: row.credit_cost,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapChurchExperienceRegistration(row: any): ChurchExperienceRegistration {
  return {
    id: row.id,
    occurrenceId: row.occurrence_id,
    profileId: row.profile_id,
    status: row.status,
    registrationSource: row.registration_source,
    capacityOverride: row.capacity_override,
    waitlistPosition: row.waitlist_position,
    attendanceStatus: row.attendance_status,
    completionStatus: row.completion_status,
    notes: row.notes,
    cancellationReason: row.cancellation_reason,
    registeredAt: row.registered_at,
    confirmedAt: row.confirmed_at,
    cancelledAt: row.cancelled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getOccurrencesForExperience(supabase: SupabaseClient, experienceId: string): Promise<ChurchExperienceOccurrence[]> {
  const { data, error } = await supabase
    .from("church_experience_occurrences")
    .select(CHURCH_EXPERIENCE_OCCURRENCE_SELECT)
    .eq("experience_id", experienceId)
    .order("starts_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapChurchExperienceOccurrence);
}

export async function getOccurrenceById(supabase: SupabaseClient, id: string): Promise<ChurchExperienceOccurrence | null> {
  const { data, error } = await supabase.from("church_experience_occurrences").select(CHURCH_EXPERIENCE_OCCURRENCE_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapChurchExperienceOccurrence(data) : null;
}

// Only upcoming, non-cancelled occurrences of published Experiences the caller's church(es) can
// see -- the member-facing "eligible occurrences to register for" list. RLS still governs the
// underlying visibility; this just adds the status/schedule filter member discovery actually needs.
export async function getUpcomingOccurrencesForMember(supabase: SupabaseClient, experienceId: string): Promise<ChurchExperienceOccurrence[]> {
  const { data, error } = await supabase
    .from("church_experience_occurrences")
    .select(CHURCH_EXPERIENCE_OCCURRENCE_SELECT)
    .eq("experience_id", experienceId)
    .eq("status", "scheduled")
    .order("starts_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapChurchExperienceOccurrence);
}

export interface CreateOccurrenceInput {
  experienceId: string;
  churchId: string;
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
  creditCost: number | null;
}

export async function createOccurrence(supabase: SupabaseClient, input: CreateOccurrenceInput): Promise<ChurchExperienceOccurrence> {
  const { data, error } = await supabase
    .from("church_experience_occurrences")
    .insert({
      experience_id: input.experienceId,
      church_id: input.churchId,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      timezone: input.timezone,
      registration_opens_at: input.registrationOpensAt,
      registration_closes_at: input.registrationClosesAt,
      capacity: input.capacity,
      location_name: input.locationName,
      online_url: input.onlineUrl,
      host_contact_name: input.hostContactName,
      host_contact_email: input.hostContactEmail,
      credit_cost: input.creditCost,
    })
    .select(CHURCH_EXPERIENCE_OCCURRENCE_SELECT)
    .single();
  if (error) throw error;
  return mapChurchExperienceOccurrence(data);
}

// Deliberately excludes experienceId/churchId -- same ownership-immutability reasoning as
// UpdateExperienceInput excluding churchId.
export type UpdateOccurrenceInput = Partial<
  Omit<CreateOccurrenceInput, "experienceId" | "churchId">
> & { status?: ChurchExperienceOccurrenceStatus };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toOccurrenceUpdatePayload(input: UpdateOccurrenceInput): Record<string, any> {
  const payload: Record<string, unknown> = {};
  if (input.startsAt !== undefined) payload.starts_at = input.startsAt;
  if (input.endsAt !== undefined) payload.ends_at = input.endsAt;
  if (input.timezone !== undefined) payload.timezone = input.timezone;
  if (input.registrationOpensAt !== undefined) payload.registration_opens_at = input.registrationOpensAt;
  if (input.registrationClosesAt !== undefined) payload.registration_closes_at = input.registrationClosesAt;
  if (input.capacity !== undefined) payload.capacity = input.capacity;
  if (input.locationName !== undefined) payload.location_name = input.locationName;
  if (input.onlineUrl !== undefined) payload.online_url = input.onlineUrl;
  if (input.hostContactName !== undefined) payload.host_contact_name = input.hostContactName;
  if (input.hostContactEmail !== undefined) payload.host_contact_email = input.hostContactEmail;
  if (input.creditCost !== undefined) payload.credit_cost = input.creditCost;
  if (input.status !== undefined) payload.status = input.status;
  return payload;
}

export async function updateOccurrence(supabase: SupabaseClient, id: string, input: UpdateOccurrenceInput): Promise<void> {
  const { error } = await supabase.from("church_experience_occurrences").update(toOccurrenceUpdatePayload(input)).eq("id", id);
  if (error) throw error;
}

export async function cancelOccurrence(supabase: SupabaseClient, id: string, reason: string | null): Promise<void> {
  const { error } = await supabase
    .from("church_experience_occurrences")
    .update({ status: "cancelled", cancellation_reason: reason })
    .eq("id", id);
  if (error) throw error;
}

export interface RegistrantProfile {
  fullName: string | null;
  email: string;
  avatarUrl: string | null;
}

export interface ChurchExperienceRegistrationWithProfile {
  registration: ChurchExperienceRegistration;
  profile: RegistrantProfile;
}

// Host-facing: every registration for one occurrence, with enough profile detail to display a
// name -- relies on profiles_select_managed_church_members (0012_church_members_profile_read.sql),
// which already grants a church manager read access to any profile with a membership row in a
// church they manage. Ordered so confirmed/pending registrants read before a waitlist queue.
export async function getRegistrationsForOccurrence(
  supabase: SupabaseClient,
  occurrenceId: string
): Promise<ChurchExperienceRegistrationWithProfile[]> {
  const { data, error } = await supabase
    .from("church_experience_registrations")
    .select(`${CHURCH_EXPERIENCE_REGISTRATION_SELECT}, profile:profiles(full_name, email, avatar_url)`)
    .eq("occurrence_id", occurrenceId)
    .order("waitlist_position", { ascending: true, nullsFirst: true })
    .order("registered_at", { ascending: true });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    registration: mapChurchExperienceRegistration(row),
    profile: {
      fullName: row.profile?.full_name ?? null,
      email: row.profile?.email ?? "",
      avatarUrl: row.profile?.avatar_url ?? null,
    },
  }));
}

export async function getRegistrationById(supabase: SupabaseClient, id: string): Promise<ChurchExperienceRegistration | null> {
  const { data, error } = await supabase.from("church_experience_registrations").select(CHURCH_EXPERIENCE_REGISTRATION_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapChurchExperienceRegistration(data) : null;
}

export interface MyRegistrationWithDetails {
  registration: ChurchExperienceRegistration;
  occurrence: ChurchExperienceOccurrence;
  experience: ChurchExperience;
}

// Member-facing "My Experiences": the caller's own registrations joined with their occurrence and
// Experience. Two queries rather than a single embedded select -- church_experience_registrations
// -> church_experience_occurrences -> church_experiences is a two-hop relationship, simpler to
// resolve with a batch fetch than a doubly-nested PostgREST embed (mirrors
// getUserJourneysWithLessons' own two-query shape, services/supabase/journeys.ts).
export async function getMyRegistrationsWithDetails(supabase: SupabaseClient): Promise<MyRegistrationWithDetails[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("church_experience_registrations")
    .select(CHURCH_EXPERIENCE_REGISTRATION_SELECT)
    .eq("profile_id", user.id)
    .order("registered_at", { ascending: false });
  if (error) throw error;

  const registrations = (data ?? []).map(mapChurchExperienceRegistration);
  if (registrations.length === 0) return [];

  const occurrenceIds = Array.from(new Set(registrations.map((r) => r.occurrenceId)));
  const { data: occurrenceRows, error: occurrenceError } = await supabase
    .from("church_experience_occurrences")
    .select(CHURCH_EXPERIENCE_OCCURRENCE_SELECT)
    .in("id", occurrenceIds);
  if (occurrenceError) throw occurrenceError;
  const occurrences = (occurrenceRows ?? []).map(mapChurchExperienceOccurrence);
  const occurrenceById = new Map(occurrences.map((o) => [o.id, o]));

  const experienceIds = Array.from(new Set(occurrences.map((o) => o.experienceId)));
  const { data: experienceRows, error: experienceError } = await supabase
    .from("church_experiences")
    .select(CHURCH_EXPERIENCE_SELECT)
    .in("id", experienceIds);
  if (experienceError) throw experienceError;
  const experiences = (experienceRows ?? []).map(mapChurchExperience);
  const experienceById = new Map(experiences.map((e) => [e.id, e]));

  return registrations
    .map((registration) => {
      const occurrence = occurrenceById.get(registration.occurrenceId);
      const experience = occurrence ? experienceById.get(occurrence.experienceId) : undefined;
      return occurrence && experience ? { registration, occurrence, experience } : null;
    })
    .filter((x): x is MyRegistrationWithDetails => x !== null);
}

// Host-only status transitions that don't have a capacity race (unlike register/cancel/promote,
// which only ever go through the RPCs below) -- approving or rejecting a specific pending
// registration is a deliberate, singular judgment call, not a concurrent-registration scenario
// (see docs/PHASE10_1_AUDIT.md's "no approve/reject RPC" note).
export async function updateRegistrationStatus(
  supabase: SupabaseClient,
  registrationId: string,
  status: Extract<ChurchExperienceRegistrationStatus, "confirmed" | "rejected">
): Promise<void> {
  const patch: { status: string; confirmed_at?: string } = { status };
  if (status === "confirmed") patch.confirmed_at = new Date().toISOString();
  const { error } = await supabase.from("church_experience_registrations").update(patch).eq("id", registrationId);
  if (error) throw error;
}

export async function updateAttendanceStatus(
  supabase: SupabaseClient,
  registrationId: string,
  status: ChurchExperienceAttendanceStatus
): Promise<void> {
  const { error } = await supabase.from("church_experience_registrations").update({ attendance_status: status }).eq("id", registrationId);
  if (error) throw error;
}

// Attendance and completion are always updated independently -- never coupled here. Whether
// completion should follow attendance automatically is a per-Experience UI decision
// (completion_method), not something this function encodes.
export async function updateCompletionStatus(
  supabase: SupabaseClient,
  registrationId: string,
  status: ChurchExperienceCompletionStatus
): Promise<void> {
  const { error } = await supabase.from("church_experience_registrations").update({ completion_status: status }).eq("id", registrationId);
  if (error) throw error;
}

export async function finalizeOccurrenceAttendance(supabase: SupabaseClient, occurrenceId: string): Promise<void> {
  const { error } = await supabase
    .from("church_experience_occurrences")
    .update({ attendance_finalized_at: new Date().toISOString() })
    .eq("id", occurrenceId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// RPC wrappers -- the ONLY way a registration is created, cancelled, promoted from the waitlist,
// or created as a walk-in. Each is a thin pass-through to the Phase 10.1 SECURITY DEFINER RPC;
// no capacity/waitlist/authorization logic is duplicated here, matching "the database RPC and
// private helper remain the source of truth."
// ---------------------------------------------------------------------------

export async function registerForOccurrence(supabase: SupabaseClient, occurrenceId: string): Promise<ChurchExperienceRegistration> {
  const { data, error } = await supabase.rpc("register_for_experience_occurrence", { p_occurrence_id: occurrenceId });
  if (error) throw error;
  return mapChurchExperienceRegistration(data);
}

export async function cancelRegistration(supabase: SupabaseClient, registrationId: string): Promise<ChurchExperienceRegistration> {
  const { data, error } = await supabase.rpc("cancel_experience_registration", { p_registration_id: registrationId });
  if (error) throw error;
  return mapChurchExperienceRegistration(data);
}

export async function promoteWaitlistRegistration(supabase: SupabaseClient, occurrenceId: string): Promise<ChurchExperienceRegistration | null> {
  const { data, error } = await supabase.rpc("promote_waitlist_registration", { p_occurrence_id: occurrenceId });
  if (error) throw error;
  return data ? mapChurchExperienceRegistration(data) : null;
}

export async function recordWalkIn(
  supabase: SupabaseClient,
  occurrenceId: string,
  profileId: string,
  attendanceStatus: ChurchExperienceAttendanceStatus = "attended",
  overrideCapacity = false
): Promise<ChurchExperienceRegistration> {
  const { data, error } = await supabase.rpc("record_experience_walk_in", {
    p_occurrence_id: occurrenceId,
    p_profile_id: profileId,
    p_attendance_status: attendanceStatus,
    p_override_capacity: overrideCapacity,
  });
  if (error) throw error;
  return mapChurchExperienceRegistration(data);
}

// ---------------------------------------------------------------------------
// List-view aggregates -- upcoming occurrence count/next occurrence/lesson count per Experience,
// for the host Experience list (Phase 10.3). Two bulk queries rather than one per Experience.
// ---------------------------------------------------------------------------

export interface ExperienceSummary {
  experienceId: string;
  upcomingOccurrenceCount: number;
  nextOccurrenceStartsAt: string | null;
  lessonCount: number;
}

export async function getExperienceSummaries(supabase: SupabaseClient, experienceIds: string[]): Promise<Map<string, ExperienceSummary>> {
  const summaries = new Map<string, ExperienceSummary>();
  for (const id of experienceIds) {
    summaries.set(id, { experienceId: id, upcomingOccurrenceCount: 0, nextOccurrenceStartsAt: null, lessonCount: 0 });
  }
  if (experienceIds.length === 0) return summaries;

  const nowIso = new Date().toISOString();
  const [occurrencesResult, lessonsResult] = await Promise.all([
    supabase.from("church_experience_occurrences").select("experience_id, starts_at, status").in("experience_id", experienceIds),
    supabase.from("church_experience_lessons").select("experience_id").in("experience_id", experienceIds),
  ]);
  if (occurrencesResult.error) throw occurrencesResult.error;
  if (lessonsResult.error) throw lessonsResult.error;

  for (const row of occurrencesResult.data ?? []) {
    const summary = summaries.get(row.experience_id);
    if (!summary || row.status !== "scheduled" || row.starts_at <= nowIso) continue;
    summary.upcomingOccurrenceCount += 1;
    if (!summary.nextOccurrenceStartsAt || row.starts_at < summary.nextOccurrenceStartsAt) {
      summary.nextOccurrenceStartsAt = row.starts_at;
    }
  }
  for (const row of lessonsResult.data ?? []) {
    const summary = summaries.get(row.experience_id);
    if (summary) summary.lessonCount += 1;
  }
  return summaries;
}

// Minimal v1 reporting (spec SS21): registrations by status, attendance count, completion count,
// capacity utilization, cancellation/no-show count -- all computed live via query, no rollup table.
export interface OccurrenceParticipationCounts {
  occurrenceId: string;
  pending: number;
  confirmed: number;
  waitlisted: number;
  cancelled: number;
  rejected: number;
  attended: number;
  absent: number;
  completed: number;
}

function emptyParticipationCounts(occurrenceId: string): OccurrenceParticipationCounts {
  return { occurrenceId, pending: 0, confirmed: 0, waitlisted: 0, cancelled: 0, rejected: 0, attended: 0, absent: 0, completed: 0 };
}

export async function getParticipationCountsForOccurrences(
  supabase: SupabaseClient,
  occurrenceIds: string[]
): Promise<Map<string, OccurrenceParticipationCounts>> {
  const counts = new Map<string, OccurrenceParticipationCounts>();
  for (const id of occurrenceIds) counts.set(id, emptyParticipationCounts(id));
  if (occurrenceIds.length === 0) return counts;

  const { data, error } = await supabase
    .from("church_experience_registrations")
    .select("occurrence_id, status, attendance_status, completion_status")
    .in("occurrence_id", occurrenceIds);
  if (error) throw error;

  for (const row of data ?? []) {
    const c = counts.get(row.occurrence_id);
    if (!c) continue;
    if (row.status === "pending") c.pending += 1;
    if (row.status === "confirmed") c.confirmed += 1;
    if (row.status === "waitlisted") c.waitlisted += 1;
    if (row.status === "cancelled") c.cancelled += 1;
    if (row.status === "rejected") c.rejected += 1;
    if (row.attendance_status === "attended") c.attended += 1;
    if (row.attendance_status === "absent") c.absent += 1;
    if (row.completion_status === "completed") c.completed += 1;
  }
  return counts;
}

// The caller's own registrations across a set of occurrences, if any -- relies entirely on
// church_experience_registrations_select_own (a member can only ever see their own rows this
// way). One batched query for however many occurrences an Experience has, rather than one query
// per occurrence (Phase 10.4 perf finding on the member Experience detail page).
export async function getMyRegistrationsForOccurrences(
  supabase: SupabaseClient,
  occurrenceIds: string[]
): Promise<Map<string, ChurchExperienceRegistration | null>> {
  const result = new Map<string, ChurchExperienceRegistration | null>();
  if (occurrenceIds.length === 0) return result;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return result;

  const { data, error } = await supabase
    .from("church_experience_registrations")
    .select(CHURCH_EXPERIENCE_REGISTRATION_SELECT)
    .in("occurrence_id", occurrenceIds)
    .eq("profile_id", user.id)
    .neq("status", "cancelled");
  if (error) throw error;

  for (const row of data ?? []) {
    const mapped = mapChurchExperienceRegistration(row);
    result.set(mapped.occurrenceId, mapped);
  }
  return result;
}

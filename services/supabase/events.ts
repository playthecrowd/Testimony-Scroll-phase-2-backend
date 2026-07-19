import type { SupabaseClient } from "@supabase/supabase-js";
import { PublishedEvent, EventCategory, EventFormat, EventStatus } from "@/types";

const EVENT_SELECT = `
  id, church_id, title, description, category, format, location, starts_at, ends_at, image_url,
  requesting_org, contact_name, contact_email, expected_attendance, requested_experience,
  equipment_notes, notes, requires_payment, price_cents, payment_status, status, featured,
  created_at, updated_at,
  church:churches(name)
`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapEvent(row: any): PublishedEvent {
  return {
    id: row.id,
    churchId: row.church_id,
    churchName: row.church?.name ?? null,
    title: row.title,
    description: row.description,
    category: row.category,
    format: row.format,
    location: row.location,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    imageUrl: row.image_url,
    requestingOrg: row.requesting_org,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    expectedAttendance: row.expected_attendance,
    requestedExperience: row.requested_experience,
    equipmentNotes: row.equipment_notes,
    notes: row.notes,
    requiresPayment: row.requires_payment,
    priceCents: row.price_cents,
    paymentStatus: row.payment_status,
    status: row.status,
    featured: row.featured,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateEventRequestInput {
  churchId: string | null;
  title: string;
  description: string;
  category: EventCategory;
  format: EventFormat;
  location: string;
  startsAt: string;
  endsAt: string;
  requestingOrg: string;
  contactName: string;
  contactEmail: string;
  expectedAttendance: string;
  requestedExperience: string;
  equipmentNotes: string;
  notes: string;
  requiresPayment: boolean;
}

export async function createEventRequest(supabase: SupabaseClient, input: CreateEventRequestInput): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in to request an event.");

  const { error } = await supabase.from("events").insert({
    requested_by: user.id,
    church_id: input.churchId,
    title: input.title,
    description: input.description || null,
    category: input.category,
    format: input.format,
    location: input.location || null,
    starts_at: input.startsAt || null,
    ends_at: input.endsAt || null,
    requesting_org: input.requestingOrg || null,
    contact_name: input.contactName || null,
    contact_email: input.contactEmail || null,
    expected_attendance: input.expectedAttendance ? Number(input.expectedAttendance) : null,
    requested_experience: input.requestedExperience || null,
    equipment_notes: input.equipmentNotes || null,
    notes: input.notes || null,
    requires_payment: input.requiresPayment,
    payment_status: input.requiresPayment ? "pending" : "not_applicable",
    status: "submitted",
  });
  if (error) throw error;
}

export async function getMyEventRequests(supabase: SupabaseClient): Promise<PublishedEvent[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("events")
    .select(EVENT_SELECT)
    .eq("requested_by", user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapEvent);
}

export async function getPublishedEvents(supabase: SupabaseClient): Promise<PublishedEvent[]> {
  const { data, error } = await supabase
    .from("events")
    .select(EVENT_SELECT)
    .eq("status", "published")
    .order("starts_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapEvent);
}

export async function getEventById(supabase: SupabaseClient, id: string): Promise<PublishedEvent | null> {
  const { data, error } = await supabase.from("events").select(EVENT_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapEvent(data) : null;
}

// Admin-facing: everything not yet published or declined, oldest first (queue order).
export async function getPendingEvents(supabase: SupabaseClient): Promise<PublishedEvent[]> {
  const { data, error } = await supabase
    .from("events")
    .select(EVENT_SELECT)
    .in("status", ["submitted", "under_review", "approved"])
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapEvent);
}

export async function updateEventStatus(supabase: SupabaseClient, id: string, status: EventStatus): Promise<void> {
  const { error } = await supabase.from("events").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function updateEventFeatured(supabase: SupabaseClient, id: string, featured: boolean): Promise<void> {
  const { error } = await supabase.from("events").update({ featured }).eq("id", id);
  if (error) throw error;
}

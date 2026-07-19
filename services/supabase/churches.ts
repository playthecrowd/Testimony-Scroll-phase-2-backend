import type { SupabaseClient } from "@supabase/supabase-js";
import { ChurchInvite, ChurchMember, ChurchMinistry, PublishedChurch } from "@/types";

const CHURCH_SELECT =
  "id, name, slug, logo_url, city, region, country, member_count, description, verified, " +
  "address_line1, website, contact_email, contact_phone, church_type, banner_url";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapChurch(row: any): PublishedChurch {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    logoUrl: row.logo_url,
    city: row.city,
    region: row.region,
    country: row.country,
    memberCount: row.member_count ?? 0,
    description: row.description,
    verified: !!row.verified,
    addressLine1: row.address_line1,
    website: row.website,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    churchType: row.church_type,
    bannerUrl: row.banner_url,
  };
}

// These accept a Supabase client instance rather than constructing their own, so the same
// query logic works from a Server Component (server client) or a client component doing a
// public read (browser client) without pulling server-only code into the client bundle.

export async function getPublishedChurches(supabase: SupabaseClient): Promise<PublishedChurch[]> {
  const { data, error } = await supabase
    .from("churches")
    .select(CHURCH_SELECT)
    .eq("status", "published")
    .order("name");
  if (error) throw error;
  return (data ?? []).map(mapChurch);
}

// Admin-facing (Phase 9, docs/PHASE9_AUDIT.md): deliberately no .eq("status", ...) filter, same
// "let RLS decide" pattern as getManagedLessonsByChurch -- churches_select_published_or_managed
// already returns every church (draft or published) to a platform admin caller, and only
// published ones to anyone else.
export async function getAllChurchesForAdmin(supabase: SupabaseClient): Promise<PublishedChurch[]> {
  const { data, error } = await supabase.from("churches").select(CHURCH_SELECT).order("name");
  if (error) throw error;
  return (data ?? []).map(mapChurch);
}

export async function updateChurchVerified(supabase: SupabaseClient, churchId: string, verified: boolean): Promise<void> {
  const { error } = await supabase.from("churches").update({ verified }).eq("id", churchId);
  if (error) throw error;
}

export async function getPublishedChurch(supabase: SupabaseClient, slugOrId: string): Promise<PublishedChurch | null> {
  let query = supabase.from("churches").select(CHURCH_SELECT).eq("status", "published");
  query = UUID_RE.test(slugOrId) ? query.or(`slug.eq.${slugOrId},id.eq.${slugOrId}`) : query.eq("slug", slugOrId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data ? mapChurch(data) : null;
}

// Churches the signed-in user hosts/admins -- used to scope the Capture form's church picker.
export async function getMyHostChurches(supabase: SupabaseClient): Promise<PublishedChurch[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("church_memberships")
    .select(`role, church:churches(${CHURCH_SELECT})`)
    .eq("profile_id", user.id)
    .in("role", ["host", "admin"]);
  if (error) throw error;

  return (data ?? [])
    .map((row) => row.church)
    .filter((c): c is NonNullable<typeof c> => !!c)
    .map(mapChurch);
}

// Real, live count of every church_memberships row for a church (any role) -- churches.member_count
// is a static seed/demo column, never updated as people actually join, so it can't be trusted for
// the Host Dashboard header. RLS on church_memberships only lets this count the caller's own rows
// unless the caller is that church's manager or a platform admin (private.is_church_manager), which
// is exactly who is allowed to call this.
export async function getChurchMemberCount(supabase: SupabaseClient, churchId: string): Promise<number> {
  const { count, error } = await supabase
    .from("church_memberships")
    .select("id", { count: "exact", head: true })
    .eq("church_id", churchId);
  if (error) throw error;
  return count ?? 0;
}

// public.ministries is already church_id-scoped (created for the lesson-builder's ministry
// find-or-create) -- reused here as-is for the church profile's "ministries/categories" list
// rather than adding a second table for the same concept.
export async function getChurchMinistries(supabase: SupabaseClient, churchId: string): Promise<ChurchMinistry[]> {
  const { data, error } = await supabase.from("ministries").select("id, name").eq("church_id", churchId).order("name");
  if (error) throw error;
  return (data ?? []).map((row) => ({ id: row.id, name: row.name }));
}

export interface ChurchProfileUpdate {
  name?: string;
  description?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  addressLine1?: string | null;
  website?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  churchType?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
}

// RLS-gated by churches_update_managed (private.is_church_manager) -- an unauthorized caller's
// update simply matches zero rows rather than erroring, so the caller must check the returned row.
export async function updateChurchProfile(
  supabase: SupabaseClient,
  churchId: string,
  patch: ChurchProfileUpdate
): Promise<PublishedChurch | null> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.description !== undefined) dbPatch.description = patch.description;
  if (patch.city !== undefined) dbPatch.city = patch.city;
  if (patch.region !== undefined) dbPatch.region = patch.region;
  if (patch.country !== undefined) dbPatch.country = patch.country;
  if (patch.addressLine1 !== undefined) dbPatch.address_line1 = patch.addressLine1;
  if (patch.website !== undefined) dbPatch.website = patch.website;
  if (patch.contactEmail !== undefined) dbPatch.contact_email = patch.contactEmail;
  if (patch.contactPhone !== undefined) dbPatch.contact_phone = patch.contactPhone;
  if (patch.churchType !== undefined) dbPatch.church_type = patch.churchType;
  if (patch.logoUrl !== undefined) dbPatch.logo_url = patch.logoUrl;
  if (patch.bannerUrl !== undefined) dbPatch.banner_url = patch.bannerUrl;

  const { data, error } = await supabase.from("churches").update(dbPatch).eq("id", churchId).select(CHURCH_SELECT).maybeSingle();
  if (error) throw error;
  return data ? mapChurch(data) : null;
}

// Requires the profiles_select_managed_church_members policy (0012) -- without it this join
// would silently come back with every member's profile fields as null (RLS applies per-table,
// independently of the church_memberships side of the join succeeding).
export async function getChurchMembers(supabase: SupabaseClient, churchId: string): Promise<ChurchMember[]> {
  const { data, error } = await supabase
    .from("church_memberships")
    .select("id, profile_id, role, created_at, profile:profiles(id, full_name, email, avatar_url)")
    .eq("church_id", churchId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((row) => ({
    membershipId: row.id,
    profileId: row.profile_id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fullName: (row.profile as any)?.full_name ?? null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    email: (row.profile as any)?.email ?? "",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    avatarUrl: (row.profile as any)?.avatar_url ?? null,
    role: row.role as ChurchMember["role"],
    joinedAt: row.created_at,
  }));
}

function mapInvite(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  row: any
): ChurchInvite {
  return {
    id: row.id,
    churchId: row.church_id,
    email: row.email,
    token: row.token,
    status: row.status,
    createdAt: row.created_at,
    acceptedAt: row.accepted_at,
  };
}

export async function getChurchInvites(supabase: SupabaseClient, churchId: string): Promise<ChurchInvite[]> {
  const { data, error } = await supabase
    .from("church_invites")
    .select("id, church_id, email, token, status, created_at, accepted_at")
    .eq("church_id", churchId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapInvite);
}

export interface CreateInvitesResult {
  created: ChurchInvite[];
  failedEmails: string[];
}

// Best-effort bulk insert (used by both the single "invite by email" form and CSV/paste import) --
// each email is inserted individually rather than in one batch insert so one bad row (or a race
// against an already-pending invite) doesn't fail the whole batch. RLS (church_invites_insert_managed)
// still gates every row on the caller managing this church.
export async function createChurchInvites(
  supabase: SupabaseClient,
  churchId: string,
  emails: string[],
  invitedBy: string
): Promise<CreateInvitesResult> {
  const created: ChurchInvite[] = [];
  const failedEmails: string[] = [];

  for (const email of emails) {
    const { data, error } = await supabase
      .from("church_invites")
      .insert({ church_id: churchId, email, invited_by: invitedBy })
      .select("id, church_id, email, token, status, created_at, accepted_at")
      .maybeSingle();
    if (error || !data) {
      failedEmails.push(email);
    } else {
      created.push(mapInvite(data));
    }
  }

  return { created, failedEmails };
}

export async function revokeChurchInvite(supabase: SupabaseClient, inviteId: string): Promise<void> {
  const { error } = await supabase.from("church_invites").update({ status: "revoked" }).eq("id", inviteId);
  if (error) throw error;
}

// Redeems a church_invites token via the SECURITY DEFINER accept_church_invite RPC (0011) --
// the only path that can turn an invite into a real church_memberships row for someone who isn't
// already a manager of that church.
export async function acceptChurchInvite(supabase: SupabaseClient, token: string): Promise<PublishedChurch> {
  const { data, error } = await supabase.rpc("accept_church_invite", { p_token: token });
  if (error) throw error;
  return mapChurch(data);
}

// Generic join-by-link/QR path: a Kingdom Member joining straight from a church's public share
// link, no invite token involved. Relies entirely on the existing
// church_memberships_insert_self_member_only RLS policy (0004_rls.sql), which already restricts
// a self-service insert to role='member' for whichever church_id is given -- no new migration
// needed for this path.
export async function joinChurchAsMember(supabase: SupabaseClient, churchId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in to join a church.");

  const { error } = await supabase
    .from("church_memberships")
    .insert({ church_id: churchId, profile_id: user.id, role: "member" });
  // Already a member -- the (church_id, profile_id) unique constraint makes this a harmless no-op
  // rather than a real failure.
  if (error && error.code !== "23505") throw error;
}

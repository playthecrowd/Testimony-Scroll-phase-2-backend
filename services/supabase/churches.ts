import type { SupabaseClient } from "@supabase/supabase-js";
import { PublishedChurch } from "@/types";

const CHURCH_SELECT = "id, name, slug, logo_url, city, region, country, member_count, description, verified";

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

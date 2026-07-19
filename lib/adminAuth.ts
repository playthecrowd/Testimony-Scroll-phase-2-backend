import type { SupabaseClient } from "@supabase/supabase-js";

// Shared by every /admin/*/actions.ts server action (lesson requests, testimonies, and now
// characters/episodes) -- returns a user-facing error string if the caller isn't a signed-in
// platform admin, or null if they are. This is defense-in-depth alongside RLS, same shape as
// hasChurchEditAccess/church_memberships checks elsewhere in this codebase: RLS is the real gate,
// this just fails fast with a clear message instead of a raw Postgres error.
export async function requirePlatformAdmin(supabase: SupabaseClient): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "You must be signed in as a platform administrator.";

  const { data: profile } = await supabase.from("profiles").select("is_platform_admin").eq("id", user.id).maybeSingle();
  if (!profile?.is_platform_admin) return "You are not authorized to perform this action.";
  return null;
}

// Page-level counterpart: callers redirect() unauthenticated visitors to /login themselves
// (redirect() throws and must never be swallowed by a try/catch here), and render a shared
// "not authorized" state for a signed-in non-admin using isPlatformAdmin below.
export interface PlatformAdminGate {
  userId: string | null;
  isPlatformAdmin: boolean;
}

export async function getPlatformAdminGate(supabase: SupabaseClient): Promise<PlatformAdminGate> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { userId: null, isPlatformAdmin: false };

  const { data: profile } = await supabase.from("profiles").select("is_platform_admin").eq("id", user.id).maybeSingle();
  return { userId: user.id, isPlatformAdmin: !!profile?.is_platform_admin };
}

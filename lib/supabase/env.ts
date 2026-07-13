// Reads Supabase env vars lazily (call this from inside a client factory, never at module scope)
// so importing any Supabase client module can never throw at build/import time.

export class SupabaseConfigError extends Error {
  constructor(missing: string[]) {
    super(`Supabase is not configured. Missing env var(s): ${missing.join(", ")}. See docs/SUPABASE_SETUP.md.`);
    this.name = "SupabaseConfigError";
  }
}

export function getSupabasePublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const missing: string[] = [];
  if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!publishableKey) missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  if (missing.length) throw new SupabaseConfigError(missing);
  return { url: url!, publishableKey: publishableKey! };
}

export function getSupabaseAdminEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const missing: string[] = [];
  if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (missing.length) throw new SupabaseConfigError(missing);
  return { url: url!, serviceRoleKey: serviceRoleKey! };
}

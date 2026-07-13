import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabasePublicEnv } from "./env";

// Cookie-aware client for Server Components, Route Handlers, and Server Actions.
// Respects the caller's own session, so ordinary RLS applies exactly as it would for that user.
// Call from inside a request-scoped function, not at module scope, so a missing env var
// surfaces as a catchable SupabaseConfigError instead of a build/import crash.
export async function createClient() {
  const { url, publishableKey } = getSupabasePublicEnv();
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component render, where cookies() is read-only.
          // Session refresh for that request is handled by proxy.ts instead.
        }
      },
    },
  });
}

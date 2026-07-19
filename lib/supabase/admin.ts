import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminEnv } from "./env";

// Service-role client: bypasses RLS entirely. Server-only, used by scripts/seed.ts.
// Never import this from a client component or any code path reachable in the browser bundle.
export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("createAdminClient() must never be called from the browser.");
  }
  const { url, serviceRoleKey } = getSupabaseAdminEnv();
  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

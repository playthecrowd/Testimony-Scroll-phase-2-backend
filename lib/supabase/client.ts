"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicEnv } from "./env";

// Call this from inside a component/effect, not at module scope, so a missing
// env var surfaces as a catchable SupabaseConfigError instead of a build/import crash.
export function createClient() {
  const { url, publishableKey } = getSupabasePublicEnv();
  return createBrowserClient(url, publishableKey);
}

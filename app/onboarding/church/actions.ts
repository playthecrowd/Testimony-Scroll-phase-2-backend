"use server";

import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";

export interface CompleteChurchSetupResult {
  error?: string;
  slug?: string;
}

export async function completeChurchSetup(input: {
  name: string;
  city: string;
  region: string;
  country: string;
}): Promise<CompleteChurchSetupResult> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_church_with_host", {
      p_name: input.name,
      p_city: input.city,
      p_region: input.region,
      p_country: input.country,
    });
    if (error) return { error: error.message };
    return { slug: data?.slug };
  } catch (err) {
    if (err instanceof SupabaseConfigError) return { error: err.message };
    return { error: "Something went wrong. Please try again." };
  }
}

import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolvePostAuthDestination } from "@/services/authService";
import { SupabaseConfigError } from "@/lib/supabase/env";

// Email confirmation callback. The Supabase "Confirm signup" email template must be set to:
// {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
// See docs/SUPABASE_SETUP.md.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (!token_hash || !type) {
    return NextResponse.redirect(`${origin}/auth/error`);
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (error) {
      return NextResponse.redirect(`${origin}/auth/error`);
    }
    const destination = await resolvePostAuthDestination(supabase);
    return NextResponse.redirect(`${origin}${destination}`);
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      return NextResponse.redirect(`${origin}/auth/error?reason=config`);
    }
    return NextResponse.redirect(`${origin}/auth/error`);
  }
}

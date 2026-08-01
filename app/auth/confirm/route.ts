import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolvePostAuthDestination } from "@/services/authService";
import { SupabaseConfigError } from "@/lib/supabase/env";

// Shared email-verification callback for both flows. The Supabase email templates must be set to:
// - "Confirm signup": {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
// - "Reset Password": {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery
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
    // Recovery links hand off to the Set New Password page instead of the normal post-auth
    // destination -- verifyOtp already established a session, but the user still needs to choose
    // a new password before landing anywhere else.
    if (type === "recovery") {
      return NextResponse.redirect(`${origin}/reset-password`);
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

import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolvePostAuthDestination } from "@/services/authService";
import { resolveWorkforcePostAuthDestination } from "@/services/supabase/workforce";
import { SupabaseConfigError } from "@/lib/supabase/env";

// Shared email-verification callback for both flows (signup confirmation, password recovery) and
// both products (Quest for the Kingdom, Plotabl Workforce) sharing this one Supabase identity
// system. Supabase sends the browser here in one of two link shapes depending on how the
// project's email templates are configured -- both are handled so this route keeps working
// regardless of which is currently live on the dashboard:
//   - token_hash + type (the documented custom template, see docs/SUPABASE_SETUP.md #6):
//     {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
//   - code (Supabase's own default "Confirm signup" template, PKCE flow):
//     {{ .SiteURL }}/auth/confirm?code=...
// Known gap: under the `code` shape there is no `type` param, so a password-recovery link using
// that shape cannot be told apart from a signup-confirmation link here -- it will be treated as a
// normal sign-in rather than routed to /reset-password. Applying the documented custom templates
// (which carry `type` explicitly) avoids this; it does not arise under `token_hash` at all.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next");

  // `next` is only ever trusted as a same-origin hint of which product's flow this is (Workforce
  // vs Quest for the Kingdom) -- an off-origin or malformed value is never followed, so this can't
  // become an open redirect.
  let workforceIntent = false;
  if (nextParam) {
    try {
      const nextUrl = new URL(nextParam, origin);
      workforceIntent = nextUrl.origin === origin && nextUrl.pathname.startsWith("/workforce");
    } catch {
      // malformed `next` -- ignore, falls through to the default (Q4K) destination
    }
  }

  if (!token_hash && !code) {
    return NextResponse.redirect(`${origin}/auth/error`);
  }

  try {
    const supabase = await createClient();
    const { error } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({ type: type as EmailOtpType, token_hash: token_hash as string });
    if (error) {
      return NextResponse.redirect(`${origin}/auth/error`);
    }
    // Recovery links hand off to the Set New Password page instead of the normal post-auth
    // destination -- verification already established a session, but the user still needs to
    // choose a new password before landing anywhere else. Workforce doesn't have its own themed
    // reset-password page yet (see app/workforce/forgot-password/page.tsx's own comment), so this
    // is the one auth screen a Workforce user still sees in Q4K's visual style.
    if (type === "recovery") {
      return NextResponse.redirect(`${origin}/reset-password`);
    }
    const destination = workforceIntent
      ? await resolveWorkforcePostAuthDestination(supabase, { freshSignup: true })
      : await resolvePostAuthDestination(supabase);
    return NextResponse.redirect(`${origin}${destination}`);
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      return NextResponse.redirect(`${origin}/auth/error?reason=config`);
    }
    return NextResponse.redirect(`${origin}/auth/error`);
  }
}

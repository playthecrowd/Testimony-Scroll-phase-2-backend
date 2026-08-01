import { ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { LinkButton } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/AsyncState";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const dynamic = "force-dynamic";

// Reached only via app/auth/confirm/route.ts's type=recovery redirect, which runs verifyOtp
// server-side first and so has already established a session by the time this page loads. A
// visitor with no session here means an expired/invalid/reused link (or direct navigation), not a
// legitimate recovery in progress -- show the same "problem" treatment as app/auth/error/page.tsx
// instead of rendering the password form.
export default async function ResetPasswordPage() {
  let hasSession = false;
  let configError: SupabaseConfigError | null = null;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    hasSession = !!user;
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      configError = err;
    } else {
      throw err;
    }
  }

  if (configError) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24">
        <ErrorState message={configError.message} />
      </div>
    );
  }

  if (!hasSession) {
    return (
      <div className="max-w-lg mx-auto py-24 text-center px-4">
        <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-5">
          <ShieldAlert size={26} className="text-red-300" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Reset link problem</h1>
        <p className="text-muted text-sm mb-8">That password reset link is invalid or has expired. Request a new one.</p>
        <div className="flex items-center justify-center gap-3">
          <LinkButton href="/forgot-password">Request New Link</LinkButton>
          <LinkButton href="/login" variant="secondary">
            Back to Sign In
          </LinkButton>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <ResetPasswordForm />
      </div>
    </div>
  );
}

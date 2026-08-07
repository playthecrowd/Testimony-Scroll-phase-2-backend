"use client";

import { useState } from "react";
import Link from "next/link";
import { KeyRound, MailCheck } from "lucide-react";
import { WorkforceLogo } from "@/components/workforce/WorkforceLogo";
import { requestPasswordReset } from "@/services/authService";

export const dynamic = "force-dynamic";

// Reuses the exact same shared requestPasswordReset (services/authService.ts) Q4K's own
// /forgot-password uses -- one identity system, one password-reset mechanism. Known limitation:
// the email link itself currently always resolves to the shared /reset-password page (Q4K-styled),
// regardless of which app's forgot-password form sent it -- see docs/PLOTABL_WORKFORCE_BUILD_TRACKER.md
// for why a fully Workforce-themed reset destination needs a bit more plumbing than this checkpoint
// covers, and isn't silently assumed to already work.
export default function WorkforceForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      // No redirectTo here: the Reset Password email template is a fixed
      // {{ .SiteURL }}/auth/confirm?token_hash=...&type=recovery string (docs/SUPABASE_SETUP.md
      // #6) that never references {{ .RedirectTo }}, and /auth/confirm's recovery branch always
      // lands on the one shared /reset-password page regardless of which app requested it -- a
      // redirectTo argument here would be silently ignored, not silently wrong, but still
      // pointless to pass.
      await requestPasswordReset(email);
      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-full bg-accent-blue/15 border border-accent-blue/40 flex items-center justify-center mb-5">
          <MailCheck size={26} className="text-accent-blue" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Check your email</h1>
        <p className="text-sm text-muted max-w-sm mb-6">
          If an account exists for <span className="text-foreground">{email}</span>, we&apos;ve sent a link to reset your
          password.
        </p>
        <Link href="/workforce/login" className="text-sm font-semibold text-accent-blue hover:underline">
          Back to Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 h-16 flex items-center border-b border-border-subtle">
        <WorkforceLogo />
      </header>
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold text-foreground mb-1">Forgot your password?</h1>
          <p className="text-sm text-muted mb-6">Enter your email and we&apos;ll send you a link to reset it.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="wf-forgot-email" className="block text-xs font-medium text-muted mb-1.5">
                Email Address
              </label>
              <input
                id="wf-forgot-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full bg-surface-2 border border-border-subtle rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted focus-ring"
              />
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 text-sm font-semibold px-4 py-3 rounded-lg bg-accent-blue text-[#16210a] hover:bg-accent-blue-light transition-colors disabled:opacity-50"
            >
              {submitting ? "Please wait..." : (<><KeyRound size={16} /> Send Reset Link</>)}
            </button>
          </form>

          <p className="text-center text-xs text-muted mt-5">
            <Link href="/workforce/login" className="text-accent-blue hover:underline">
              Back to Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

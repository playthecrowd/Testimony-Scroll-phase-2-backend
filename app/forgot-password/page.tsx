"use client";

import { useState } from "react";
import Link from "next/link";
import { KeyRound, MailCheck } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/Button";
import { requestPasswordReset } from "@/services/authService";

// D2 (see docs/REPAIR_D2_DIAGNOSIS.md): auth-adjacent pages must never be statically
// prerendered/cached, matching the same rule app/login/page.tsx and app/signup/page.tsx follow.
export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      // Always show the same neutral "sent" state regardless of whether requestPasswordReset
      // reports an error -- Supabase itself never reveals whether the address is registered, and
      // treating every outcome here identically keeps that neutrality intact end to end.
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
          <MailCheck size={26} className="text-accent-blue-light" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Check your email</h1>
        <p className="text-sm text-muted max-w-sm mb-6">
          If an account exists for <span className="text-foreground">{email}</span>, we&apos;ve sent a link to reset
          your password.
        </p>
        <LinkButton href="/login">Back to Sign In</LinkButton>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-foreground mb-1">Forgot your password?</h1>
        <p className="text-sm text-muted mb-6">Enter your email and we&apos;ll send you a link to reset it.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="forgot-email" className="block text-xs font-medium text-muted mb-1.5">
              Email Address
            </label>
            <input
              id="forgot-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full bg-surface-2 border border-border-subtle rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted focus-ring"
            />
          </div>

          {error && (
            <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={submitting}>
            {submitting ? (
              "Please wait..."
            ) : (
              <>
                <KeyRound size={17} /> Send Reset Link
              </>
            )}
          </Button>
        </form>

        <p className="text-center text-xs text-muted mt-5">
          <Link href="/login" className="text-accent-blue-light hover:underline">
            Back to Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}

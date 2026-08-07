"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { WorkforceLogo } from "@/components/workforce/WorkforceLogo";
import { signIn } from "@/services/authService";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkforcePostAuthDestination } from "@/services/supabase/workforce";

export const dynamic = "force-dynamic";

// Branded Workforce sign-in over the same shared Supabase auth Q4K uses (services/authService.ts's
// signIn) -- no separate identity system, no duplicate accounts. Deliberately calls the raw signIn
// directly rather than the SessionContext-wrapped one (context/SessionContext.tsx), whose own
// destination resolution is Q4K-specific (resolvePostAuthDestination) -- this page needs the
// Workforce-specific one (resolveWorkforcePostAuthDestination) instead. Supabase's own auth state
// change event still keeps the shared SessionContext in sync regardless of which function called
// signInWithPassword, so nothing about Q4K's own session handling is affected.
export default function WorkforceLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const result = await signIn(email, password);
      if (result.error) {
        setError(result.error);
        return;
      }
      const destination = await resolveWorkforcePostAuthDestination(createClient());
      router.push(destination);
    } catch {
      setError("Something went wrong signing you in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 h-16 flex items-center border-b border-border-subtle">
        <WorkforceLogo />
      </header>
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold text-foreground mb-1">Welcome back</h1>
          <p className="text-sm text-muted mb-6">Sign in with your Plotabl account to continue.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="wf-login-email" className="block text-xs font-medium text-muted mb-1.5">
                Email Address
              </label>
              <input
                id="wf-login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full bg-surface-2 border border-border-subtle rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted focus-ring"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="wf-login-password" className="block text-xs font-medium text-muted">
                  Password
                </label>
                <Link href="/workforce/forgot-password" className="text-xs text-accent-blue hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="wf-login-password"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full bg-surface-2 border border-border-subtle rounded-lg px-3.5 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted focus-ring"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 text-sm font-semibold px-4 py-3 rounded-lg bg-accent-blue text-[#16210a] hover:bg-accent-blue-light transition-colors disabled:opacity-50"
            >
              {submitting ? "Please wait..." : (<><LogIn size={16} /> Sign In</>)}
            </button>
          </form>

          <p className="text-center text-xs text-muted mt-5">
            New to Plotabl Workforce?{" "}
            <Link href="/workforce/signup" className="text-accent-blue hover:underline">
              Get Started
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

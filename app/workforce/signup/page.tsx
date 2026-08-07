"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, UserPlus, MailCheck } from "lucide-react";
import { WorkforceLogo } from "@/components/workforce/WorkforceLogo";
import { signUp } from "@/services/authService";

export const dynamic = "force-dynamic";

// New Workforce accounts are created as the existing "organization" account_type (the same shared
// identity system Q4K uses -- services/authService.ts's signUp, not a duplicate one), since every
// Workforce role in the spec's hierarchy sits underneath an organization. Post-signup, an
// organization account with no entity yet is routed to /workforce/onboarding, which hands off to
// Q4K's own existing /onboarding/organization to actually create the org record -- reusing that
// flow rather than duplicating it, per "Workforce may reuse approved shared services underneath."
export default function WorkforceSignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [checkEmail, setCheckEmail] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const result = await signUp(fullName, email, password, "organization");
      if (result.error && result.status !== "check-email") {
        setError(result.error);
        return;
      }
      if (result.status === "signed-in") {
        router.push("/workforce/onboarding");
      } else {
        setCheckEmail(true);
      }
    } catch {
      setError("Something went wrong creating your account. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (checkEmail) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-full bg-accent-blue/15 border border-accent-blue/40 flex items-center justify-center mb-5">
          <MailCheck size={26} className="text-accent-blue" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Check your email</h1>
        <p className="text-sm text-muted max-w-sm mb-6">
          We&apos;ve sent a confirmation link to <span className="text-foreground">{email}</span>. Confirm your address to finish
          setting up Plotabl Workforce.
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
          <h1 className="text-2xl font-bold text-foreground mb-1">Get started</h1>
          <p className="text-sm text-muted mb-6">Create your Plotabl Workforce account.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="wf-signup-name" className="block text-xs font-medium text-muted mb-1.5">
                Full Name
              </label>
              <input
                id="wf-signup-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jordan Brooks"
                required
                className="w-full bg-surface-2 border border-border-subtle rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted focus-ring"
              />
            </div>
            <div>
              <label htmlFor="wf-signup-email" className="block text-xs font-medium text-muted mb-1.5">
                Email Address
              </label>
              <input
                id="wf-signup-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full bg-surface-2 border border-border-subtle rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted focus-ring"
              />
            </div>
            <div>
              <label htmlFor="wf-signup-password" className="block text-xs font-medium text-muted mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="wf-signup-password"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  minLength={6}
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
              {submitting ? "Please wait..." : (<><UserPlus size={16} /> Create Account</>)}
            </button>
          </form>

          <p className="text-center text-xs text-muted mt-5">
            Already have an account?{" "}
            <Link href="/workforce/login" className="text-accent-blue hover:underline">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

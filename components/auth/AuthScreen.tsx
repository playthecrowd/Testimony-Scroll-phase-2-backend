"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Church, Users, Eye, EyeOff, UserPlus, LogIn, ShieldCheck, MailCheck } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { Button } from "@/components/ui/Button";
import { useSession } from "@/context/SessionContext";
import { AccountType } from "@/types";
import { cn } from "@/lib/utils";
import { photo } from "@/lib/images";
import { stages } from "@/components/journey/stageMeta";
import Link from "next/link";

// Reads ?next=... at submit time rather than via useSearchParams(), which would require wrapping
// this component's page in a Suspense boundary to keep /login statically rendered. Only allows a
// same-site relative path -- never an absolute/external URL -- so this can't become an open
// redirect.
function getNextDestination(): string | null {
  if (typeof window === "undefined") return null;
  const next = new URLSearchParams(window.location.search).get("next");
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

export function AuthScreen({ initialTab }: { initialTab: "signin" | "signup" }) {
  const [tab, setTab] = useState<"signin" | "signup">(initialTab);
  const [accountType, setAccountType] = useState<AccountType>("member");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [checkEmail, setCheckEmail] = useState(false);
  const { signIn, signUp } = useSession();
  const router = useRouter();

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const result = await signIn(email, password);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.push(getNextDestination() ?? result.destination ?? "/dashboard");
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const result = await signUp(fullName, email, password, accountType);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.status === "check-email") {
      setCheckEmail(true);
      return;
    }
    router.push(getNextDestination() ?? result.destination ?? "/dashboard");
  }

  if (checkEmail) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-full bg-accent-blue/15 border border-accent-blue/40 flex items-center justify-center mb-5">
          <MailCheck size={26} className="text-accent-blue-light" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Check your email</h1>
        <p className="text-sm text-muted max-w-sm mb-6">
          We sent a confirmation link to <span className="text-foreground">{email}</span>. Click it to activate
          your account, then sign in.
        </p>
        <Button
          onClick={() => {
            setCheckEmail(false);
            setTab("signin");
          }}
        >
          <LogIn size={16} /> Back to Sign In
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="relative hidden lg:flex flex-col justify-between p-10 overflow-hidden">
        <Image
          src={photo("auth-hero", 900, 1200)}
          alt=""
          fill
          sizes="50vw"
          className="object-cover opacity-70"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/20" />
        <div className="relative">
          <Logo size="lg" />
        </div>
        <div className="relative max-w-md">
          <h2 className="text-3xl font-bold text-foreground leading-tight">
            Start your Kingdom <span className="text-accent-blue-light">journey.</span>
          </h2>
          <p className="text-muted mt-3 text-sm">
            Join thousands of believers capturing sermons, studying truth, living it out, and being added to
            God&apos;s story.
          </p>
          <div className="flex items-center flex-wrap gap-x-1 gap-y-3 mt-8">
            {stages.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={s.key} className="flex items-center gap-1">
                  <div className="flex flex-col items-center text-center w-16">
                    <div className="w-10 h-10 rounded-full bg-accent-blue/15 border border-accent-blue/40 flex items-center justify-center text-accent-blue-light mb-1">
                      <Icon size={16} />
                    </div>
                    <span className="text-[10px] text-muted leading-tight">{s.label}</span>
                  </div>
                  {i < stages.length - 1 && <span className="w-4 h-px bg-border-subtle mb-4" />}
                </div>
              );
            })}
          </div>
        </div>
        <div className="relative qk-card p-3 flex items-center gap-2 text-xs text-muted">
          <ShieldCheck size={14} className="text-accent-blue-light" />
          &ldquo;Train up a child in the way he should go...&rdquo; — Proverbs 22:6
        </div>
      </div>

      <div className="flex flex-col items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 flex justify-center">
            <Logo size="lg" />
          </div>

          <div className="flex rounded-lg border border-border-subtle p-1 mb-6">
            <button
              onClick={() => {
                setTab("signin");
                setError("");
              }}
              className={cn(
                "flex-1 py-2 text-sm font-medium rounded-md transition-colors",
                tab === "signin" ? "bg-accent-blue text-white" : "text-muted hover:text-foreground"
              )}
            >
              Sign In
            </button>
            <button
              onClick={() => {
                setTab("signup");
                setError("");
              }}
              className={cn(
                "flex-1 py-2 text-sm font-medium rounded-md transition-colors",
                tab === "signup" ? "bg-accent-blue text-white" : "text-muted hover:text-foreground"
              )}
            >
              Create Account
            </button>
          </div>

          <h1 className="text-2xl font-bold text-foreground mb-1">
            {tab === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-sm text-muted mb-6">
            {tab === "signin" ? "Sign in to continue your journey." : "Choose your account type and join the Kingdom"}
          </p>

          <div className="grid grid-cols-2 gap-3 mb-5">
            <button
              onClick={() => setAccountType("host")}
              className={cn(
                "qk-card p-4 text-left transition-colors",
                accountType === "host" && "border-accent-blue-light qk-glow-blue"
              )}
            >
              <div className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center mb-2">
                <Church size={18} className="text-accent-blue-light" />
              </div>
              <p className="text-sm font-semibold text-foreground">Church Host</p>
              <p className="text-xs text-muted mt-1">Create and manage your church, capture sermons, and guide your community&apos;s journey.</p>
            </button>
            <button
              onClick={() => setAccountType("member")}
              className={cn(
                "qk-card p-4 text-left transition-colors",
                accountType === "member" && "border-accent-blue-light qk-glow-blue"
              )}
            >
              <div className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center mb-2">
                <Users size={18} className="text-accent-blue-light" />
              </div>
              <p className="text-sm font-semibold text-foreground">Kingdom Member</p>
              <p className="text-xs text-muted mt-1">Join your church, track your journey, and grow deeper in God&apos;s Word.</p>
            </button>
          </div>

          <form onSubmit={tab === "signin" ? handleSignIn : handleSignUp} className="space-y-4">
            {tab === "signup" && (
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">Full Name</label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  required
                  className="w-full bg-surface-2 border border-border-subtle rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted focus-ring"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full bg-surface-2 border border-border-subtle rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted focus-ring"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={tab === "signin" ? "Enter your password" : "Create a strong password"}
                  required
                  minLength={6}
                  className="w-full bg-surface-2 border border-border-subtle rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted focus-ring"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {tab === "signup" && (
              <label className="flex items-start gap-2 text-xs text-muted">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5" />
                I agree to the <span className="text-accent-blue-light">Terms of Service</span> and{" "}
                <span className="text-accent-blue-light">Privacy Policy</span>
              </label>
            )}

            {error && <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>}

            <Button type="submit" size="lg" className="w-full" disabled={submitting || (tab === "signup" && !agreed)}>
              {submitting ? (
                "Please wait..."
              ) : tab === "signin" ? (
                <>
                  <LogIn size={17} /> Sign In
                </>
              ) : (
                <>
                  <UserPlus size={17} /> Create My Account
                </>
              )}
            </Button>
          </form>

          <p className="text-center text-xs text-muted mt-5">
            {tab === "signin" ? (
              <>
                Don&apos;t have an account?{" "}
                <button onClick={() => setTab("signup")} className="text-accent-blue-light hover:underline">
                  Create Account
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button onClick={() => setTab("signin")} className="text-accent-blue-light hover:underline">
                  Sign In
                </button>
              </>
            )}
          </p>
          <p className="text-center text-[11px] text-muted mt-6">
            <Link href="/" className="text-accent-blue-light hover:underline">Back home</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

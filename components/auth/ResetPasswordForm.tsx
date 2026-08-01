"use client";

import { useState } from "react";
import { Eye, EyeOff, KeyRound, CheckCircle2 } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/Button";
import { updatePassword } from "@/services/authService";

export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await updatePassword(password);
      if (result.error) {
        setError(result.error);
        return;
      }
      setDone(true);
    } catch {
      setError("Something went wrong updating your password. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="text-center">
        <div className="w-14 h-14 rounded-full bg-accent-blue/15 border border-accent-blue/40 flex items-center justify-center mb-5 mx-auto">
          <CheckCircle2 size={26} className="text-accent-blue-light" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Password updated</h1>
        <p className="text-sm text-muted mb-6">Your password has been changed. Sign in with your new password.</p>
        <LinkButton href="/login">Back to Sign In</LinkButton>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-1">Set a new password</h1>
      <p className="text-sm text-muted mb-6">Choose a new password for your account.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="new-password" className="block text-xs font-medium text-muted mb-1.5">
            New Password
          </label>
          <div className="relative">
            <input
              id="new-password"
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a strong password"
              required
              minLength={6}
              className="w-full bg-surface-2 border border-border-subtle rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted focus-ring"
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              aria-label={showPw ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted"
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="confirm-password" className="block text-xs font-medium text-muted mb-1.5">
            Confirm New Password
          </label>
          <input
            id="confirm-password"
            type={showPw ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter your new password"
            required
            minLength={6}
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
              <KeyRound size={17} /> Update Password
            </>
          )}
        </Button>
      </form>
    </div>
  );
}

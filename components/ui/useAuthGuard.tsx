"use client";

import { useState, useCallback } from "react";
import { LogIn, UserPlus, X } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { LinkButton } from "@/components/ui/Button";

export function useAuthGuard() {
  const { session, ready } = useSession();
  const [open, setOpen] = useState(false);

  const guard = useCallback(
    (action: () => void) => {
      if (ready && session.isLoggedIn) {
        action();
      } else {
        setOpen(true);
      }
    },
    [ready, session]
  );

  const Modal = open ? (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
      <div className="relative qk-card qk-glow-blue p-6 max-w-sm w-full text-center">
        <button
          onClick={() => setOpen(false)}
          className="absolute top-3 right-3 text-muted hover:text-foreground p-1 rounded-lg focus-ring"
          aria-label="Close"
        >
          <X size={16} />
        </button>
        <div className="w-12 h-12 rounded-full bg-accent-blue/15 border border-accent-blue/40 flex items-center justify-center mx-auto mb-4">
          <LogIn size={20} className="text-accent-blue-light" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-1.5">Join the Journey</h3>
        <p className="text-sm text-muted mb-5">
          Sign in or create a free account to save your progress, join quests, and share your testimony.
        </p>
        <div className="flex flex-col gap-2">
          <LinkButton href="/login" size="md">
            <LogIn size={16} /> Sign In
          </LinkButton>
          <LinkButton href="/signup" size="md" variant="secondary">
            <UserPlus size={16} /> Create Account
          </LinkButton>
        </div>
      </div>
    </div>
  ) : null;

  return { guard, Modal, isLoggedIn: ready && session.isLoggedIn };
}

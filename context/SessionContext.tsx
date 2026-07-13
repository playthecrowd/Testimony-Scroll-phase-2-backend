"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Session,
  defaultSession,
  getCurrentSession,
  signIn as authSignIn,
  signOut as authSignOut,
  signUp as authSignUp,
  resolvePostAuthDestination,
} from "@/services/authService";
import { AccountType } from "@/types";

interface SignInOutcome {
  error?: string;
  destination?: string;
}

interface SignUpOutcome {
  status: "signed-in" | "check-email";
  error?: string;
  destination?: string;
}

interface SessionContextValue {
  session: Session;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<SignInOutcome>;
  signUp: (fullName: string, email: string, password: string, accountType: AccountType) => Promise<SignUpOutcome>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session>(defaultSession);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const supabase = createClient();
      const next = await getCurrentSession(supabase);
      setSession(next);
    } catch {
      // Supabase not configured, or the request failed -- fall back to signed-out rather than crash.
      setSession(defaultSession);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    // onAuthStateChange always fires an initial INITIAL_SESSION event right after subscribing
    // (whether signed in or out), so a separate refresh() call on mount isn't needed -- every
    // setState here happens inside this subscription callback, in response to an auth event.
    let unsubscribe: (() => void) | undefined;
    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange(() => {
          refresh();
        });
        unsubscribe = () => subscription.unsubscribe();
      } catch {
        // Supabase not configured -- fall back to signed-out rather than hang on "loading" forever.
        setSession(defaultSession);
        setReady(true);
      }
    })();
    return () => unsubscribe?.();
  }, [refresh]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<SignInOutcome> => {
      const result = await authSignIn(email, password);
      if (result.error) return result;
      const supabase = createClient();
      const destination = await resolvePostAuthDestination(supabase);
      await refresh();
      return { destination };
    },
    [refresh]
  );

  const signUp = useCallback(
    async (fullName: string, email: string, password: string, accountType: AccountType): Promise<SignUpOutcome> => {
      const result = await authSignUp(fullName, email, password, accountType);
      if (result.status === "check-email" || result.error) return result;
      const supabase = createClient();
      const destination = await resolvePostAuthDestination(supabase);
      await refresh();
      return { ...result, destination };
    },
    [refresh]
  );

  const logout = useCallback(() => {
    authSignOut().then(refresh);
  }, [refresh]);

  return (
    <SessionContext.Provider value={{ session, ready, signIn, signUp, logout, refresh }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}

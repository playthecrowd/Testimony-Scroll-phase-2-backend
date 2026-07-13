"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Session, getSession, signIn, signOut, signUp, switchAccountType } from "@/services/authService";
import { AccountType } from "@/types";

interface SessionContextValue {
  session: Session;
  ready: boolean;
  login: (accountType: AccountType) => void;
  logout: () => void;
  register: (fullName: string, email: string, accountType: AccountType) => void;
  switchAccount: (accountType: AccountType) => void;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session>({
    isLoggedIn: false,
    accountType: "member",
    user: { id: "", fullName: "", email: "", accountType: "member", avatarUrl: "", createdAt: "" },
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSession(getSession());
    setReady(true);
  }, []);

  const login = useCallback((accountType: AccountType) => {
    setSession(signIn(accountType));
  }, []);

  const logout = useCallback(() => {
    setSession(signOut());
  }, []);

  const register = useCallback((fullName: string, email: string, accountType: AccountType) => {
    setSession(signUp(fullName, email, accountType));
  }, []);

  const switchAccount = useCallback((accountType: AccountType) => {
    setSession(switchAccountType(accountType));
  }, []);

  return (
    <SessionContext.Provider value={{ session, ready, login, logout, register, switchAccount }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}

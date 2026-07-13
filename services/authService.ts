import { AccountType, User } from "@/types";
import { demoMember, demoHost } from "@/data/users";
import { loadValue, saveValue } from "@/lib/storage";

const SESSION_KEY = "session";

export interface Session {
  isLoggedIn: boolean;
  accountType: AccountType;
  user: User;
}

const defaultSession: Session = {
  isLoggedIn: false,
  accountType: "member",
  user: demoMember,
};

export function getSession(): Session {
  return loadValue<Session>(SESSION_KEY, defaultSession);
}

export function signIn(accountType: AccountType): Session {
  const session: Session = {
    isLoggedIn: true,
    accountType,
    user: accountType === "host" ? demoHost : demoMember,
  };
  saveValue(SESSION_KEY, session);
  return session;
}

export function signUp(fullName: string, email: string, accountType: AccountType): Session {
  const base = accountType === "host" ? demoHost : demoMember;
  const user: User = {
    ...base,
    id: `user-${accountType}-${Date.now().toString(36)}`,
    fullName: fullName || base.fullName,
    email: email || base.email,
    createdAt: new Date().toISOString(),
  };
  const session: Session = { isLoggedIn: true, accountType, user };
  saveValue(SESSION_KEY, session);
  return session;
}

export function signOut(): Session {
  saveValue(SESSION_KEY, defaultSession);
  return defaultSession;
}

// Dev-only helper: instantly switch the persona without re-authenticating.
export function switchAccountType(accountType: AccountType): Session {
  const session = getSession();
  const user = accountType === "host" ? demoHost : demoMember;
  const next: Session = { ...session, isLoggedIn: true, accountType, user };
  saveValue(SESSION_KEY, next);
  return next;
}

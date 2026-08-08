"use client";

import { createContext, useContext, useSyncExternalStore, useCallback } from "react";
import { WorkforcePreviewRole, PREVIEW_ROLES } from "@/lib/workforcePreviewRole";

const STORAGE_KEY = "workforce-demo-preview-role";
const DEFAULT_ROLE: WorkforcePreviewRole = "enterprise_owner";

// useSyncExternalStore, not useState+useEffect, for the localStorage-backed role -- it's the
// React-recommended pattern for reading external mutable state and avoids the set-state-in-effect
// pitfall entirely (no setState call inside an effect, so no extra render and no hydration-mismatch
// workaround needed). The server snapshot is always the default; the client snapshot reads
// localStorage and useSyncExternalStore itself handles resyncing after hydration.
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getSnapshot(): WorkforcePreviewRole {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored && (PREVIEW_ROLES as string[]).includes(stored)) return stored as WorkforcePreviewRole;
  return DEFAULT_ROLE;
}

function getServerSnapshot(): WorkforcePreviewRole {
  return DEFAULT_ROLE;
}

const RoleContext = createContext<{
  role: WorkforcePreviewRole;
  setRole: (role: WorkforcePreviewRole) => void;
} | null>(null);

// Persists the active preview role to localStorage so it survives both client-side navigation
// between /workforce/demo/** pages and a hard browser refresh, per the spec's explicit
// requirement ("Refreshing the page does not unexpectedly reset the selected role"). Scoped to
// this one layout subtree via app/workforce/demo/layout.tsx, not global app state.
export function RoleProvider({ children }: { children: React.ReactNode }) {
  const role = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setRole = useCallback((next: WorkforcePreviewRole) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    // The native "storage" event only fires in *other* tabs, not this one -- dispatch it manually
    // so this tab's useSyncExternalStore subscription re-reads the new value immediately.
    window.dispatchEvent(new Event("storage"));
  }, []);

  return <RoleContext.Provider value={{ role, setRole }}>{children}</RoleContext.Provider>;
}

export function useWorkforcePreviewRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useWorkforcePreviewRole must be used within RoleProvider");
  return ctx;
}

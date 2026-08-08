"use client";

import { createContext, useContext, useSyncExternalStore, useCallback } from "react";
import { WorkforceDemoStoreState, DEFAULT_STORE_STATE } from "@/lib/workforceDemoStore";

const STORAGE_KEY = "workforce-demo-store";

// Same useSyncExternalStore pattern as RoleContext.tsx (proven, avoids the set-state-in-effect
// pitfall). Distinct localStorage key and Provider from the role switcher on purpose -- role is
// "who am I previewing as" (ephemeral per browser), this is "what has happened in the demo"
// (shared across every role's view of the same session/decision).
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

// useSyncExternalStore requires getSnapshot to return a stable (===-equal) reference when the
// underlying data hasn't changed -- returning a freshly-spread object on every call (even with
// identical content) makes React think the snapshot changed on every read, which triggers React's
// own "getSnapshot should be cached to avoid an infinite loop" loop-detection error the first time
// anything actually calls update(). Cache the parsed object against the raw string it came from,
// and only re-parse when the raw string itself has changed.
let cachedRaw: string | null = null;
let cachedSnapshot: WorkforceDemoStoreState = DEFAULT_STORE_STATE;

function getSnapshot(): WorkforceDemoStoreState {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedSnapshot;
  cachedRaw = raw;
  if (!raw) {
    cachedSnapshot = DEFAULT_STORE_STATE;
    return cachedSnapshot;
  }
  try {
    cachedSnapshot = { ...DEFAULT_STORE_STATE, ...JSON.parse(raw) };
  } catch {
    cachedSnapshot = DEFAULT_STORE_STATE;
  }
  return cachedSnapshot;
}

function getServerSnapshot(): WorkforceDemoStoreState {
  return DEFAULT_STORE_STATE;
}

const StoreContext = createContext<{
  state: WorkforceDemoStoreState;
  update: (updater: (state: WorkforceDemoStoreState) => WorkforceDemoStoreState) => void;
} | null>(null);

export function WorkforceStoreProvider({ children }: { children: React.ReactNode }) {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const update = useCallback((updater: (state: WorkforceDemoStoreState) => WorkforceDemoStoreState) => {
    const next = updater(getSnapshot());
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("storage"));
  }, []);

  return <StoreContext.Provider value={{ state, update }}>{children}</StoreContext.Provider>;
}

export function useWorkforceDemoStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useWorkforceDemoStore must be used within WorkforceStoreProvider");
  return ctx;
}

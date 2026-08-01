"use client";

import { useCallback, useSyncExternalStore } from "react";

// Placement persistence for the Member Plot vertical-slice PROTOTYPE only. Deliberately
// localStorage, not Supabase: this feature is explicitly still paused from live-app/database
// wiring (per standing instructions -- no migrations, no real inventory schema exists yet). This
// satisfies "placement saves and survives reload" for the prototype without implying any of this
// is real, persisted, or synced member data. Storage key is namespaced to this specific slice so
// it can't collide with (or be mistaken for) anything real.
//
// Built as a useSyncExternalStore-backed external store (module-level cache + subscriber list),
// not useState+useEffect -- localStorage genuinely differs between server (unavailable) and
// client (real data), and useSyncExternalStore is the React-sanctioned mechanism for reading an
// external mutable source without a hydration-mismatch flash or a synchronous setState-in-effect
// (this repo's lint rule flags the latter directly).
const STORAGE_KEY = "kingdom-scrolls-member-plot-vertical-slice-v1";

export type Rotation = 0 | 90 | 180 | 270;

export interface PlacedObject {
  instanceId: string;
  assetId: string;
  col: number;
  row: number;
  rotation: Rotation;
}

type Listener = () => void;
let listeners: Listener[] = [];
let cachedRaw: string | null | undefined = undefined; // undefined = never read yet
let cachedSnapshot: PlacedObject[] = [];

function readSnapshot(): PlacedObject[] {
  if (typeof window === "undefined") return [];
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return [];
  }
  if (raw === cachedRaw) return cachedSnapshot; // stable reference unless storage actually changed
  cachedRaw = raw;
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    cachedSnapshot = Array.isArray(parsed) ? parsed : [];
  } catch {
    cachedSnapshot = [];
  }
  return cachedSnapshot;
}

function writeSnapshot(next: PlacedObject[]) {
  cachedSnapshot = next;
  cachedRaw = JSON.stringify(next);
  try {
    window.localStorage.setItem(STORAGE_KEY, cachedRaw);
  } catch {
    // Ignore quota/availability errors -- this is a prototype convenience, not a guarantee.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: Listener) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

// useSyncExternalStore requires getServerSnapshot to return a referentially stable value across
// calls -- a fresh [] literal every call triggers React's "should be cached to avoid an infinite
// loop" warning (and the loop itself in some cases).
const EMPTY_SNAPSHOT: PlacedObject[] = [];
function getServerSnapshot(): PlacedObject[] {
  return EMPTY_SNAPSHOT;
}

export function usePlotPlacements() {
  const placements = useSyncExternalStore(subscribe, readSnapshot, getServerSnapshot);

  const place = useCallback((assetId: string, col: number, row: number, rotation: Rotation) => {
    const instanceId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    writeSnapshot([...readSnapshot(), { instanceId, assetId, col, row, rotation }]);
    return instanceId;
  }, []);

  const moveExisting = useCallback((instanceId: string, col: number, row: number, rotation: Rotation) => {
    writeSnapshot(readSnapshot().map((p) => (p.instanceId === instanceId ? { ...p, col, row, rotation } : p)));
  }, []);

  const remove = useCallback((instanceId: string) => {
    writeSnapshot(readSnapshot().filter((p) => p.instanceId !== instanceId));
  }, []);

  const reset = useCallback(() => {
    writeSnapshot([]);
  }, []);

  return { placements, place, moveExisting, remove, reset };
}

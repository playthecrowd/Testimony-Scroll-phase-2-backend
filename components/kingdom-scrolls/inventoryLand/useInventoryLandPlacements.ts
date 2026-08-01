"use client";

import { useCallback, useSyncExternalStore } from "react";

export type Rotation = 0 | 90 | 180 | 270;

export interface PlacedObject {
  instanceId: string;
  assetId: string;
  col: number;
  row: number;
  rotation: Rotation;
}

// Profile-scoped placement persistence for the PRODUCTION Inventory Land route -- distinct from
// the Member Plot Slice prototype's usePlotPlacements.ts (components/kingdom-scrolls/mockup/
// memberPlotSlice/), which is deliberately left untouched and keeps its own flat, non-scoped
// storage key. This version keys every read/write by the authenticated profile id
// (STORAGE_KEY_PREFIX + profileId): two different signed-in members sharing the same browser/
// device must never see each other's placements. Still explicitly beta, local-only persistence
// per the approved checkpoint -- not yet backed by a real Supabase table (that is real inventory
// ownership, deferred to a future phase).
//
// Keyed per-profile-id maps (not a single module-level cache) so the external store correctly
// invalidates if the signed-in profile ever changes within the same tab (e.g. sign-out/sign-in as
// a different member), rather than silently serving stale cached data under the wrong key.
const STORAGE_KEY_PREFIX = "kingdom-scrolls-inventory-land-placements-v1:";

type Listener = () => void;
const listenersByKey = new Map<string, Listener[]>();
const cachedRawByKey = new Map<string, string | null>();
const cachedSnapshotByKey = new Map<string, PlacedObject[]>();
const EMPTY_SNAPSHOT: PlacedObject[] = [];

function readSnapshot(key: string): PlacedObject[] {
  if (typeof window === "undefined") return EMPTY_SNAPSHOT;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return EMPTY_SNAPSHOT;
  }
  if (raw === (cachedRawByKey.has(key) ? cachedRawByKey.get(key) : undefined)) {
    return cachedSnapshotByKey.get(key) ?? EMPTY_SNAPSHOT;
  }
  cachedRawByKey.set(key, raw);
  let snapshot: PlacedObject[];
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    snapshot = Array.isArray(parsed) ? parsed : [];
  } catch {
    snapshot = [];
  }
  cachedSnapshotByKey.set(key, snapshot);
  return snapshot;
}

function writeSnapshot(key: string, next: PlacedObject[]) {
  cachedSnapshotByKey.set(key, next);
  const raw = JSON.stringify(next);
  cachedRawByKey.set(key, raw);
  try {
    window.localStorage.setItem(key, raw);
  } catch {
    // Ignore quota/availability errors -- beta local persistence, not a guarantee.
  }
  (listenersByKey.get(key) ?? []).forEach((l) => l());
}

function subscribe(key: string, listener: Listener) {
  const list = listenersByKey.get(key) ?? [];
  list.push(listener);
  listenersByKey.set(key, list);
  return () => {
    listenersByKey.set(
      key,
      (listenersByKey.get(key) ?? []).filter((l) => l !== listener)
    );
  };
}

export function useInventoryLandPlacements(profileId: string) {
  const key = `${STORAGE_KEY_PREFIX}${profileId}`;

  const placements = useSyncExternalStore(
    useCallback((listener: Listener) => subscribe(key, listener), [key]),
    useCallback(() => readSnapshot(key), [key]),
    () => EMPTY_SNAPSHOT
  );

  const place = useCallback(
    (assetId: string, col: number, row: number, rotation: Rotation) => {
      const instanceId =
        typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      writeSnapshot(key, [...readSnapshot(key), { instanceId, assetId, col, row, rotation }]);
      return instanceId;
    },
    [key]
  );

  const moveExisting = useCallback(
    (instanceId: string, col: number, row: number, rotation: Rotation) => {
      writeSnapshot(
        key,
        readSnapshot(key).map((p) => (p.instanceId === instanceId ? { ...p, col, row, rotation } : p))
      );
    },
    [key]
  );

  const remove = useCallback(
    (instanceId: string) => {
      writeSnapshot(
        key,
        readSnapshot(key).filter((p) => p.instanceId !== instanceId)
      );
    },
    [key]
  );

  const reset = useCallback(() => {
    writeSnapshot(key, []);
  }, [key]);

  return { placements, place, moveExisting, remove, reset };
}

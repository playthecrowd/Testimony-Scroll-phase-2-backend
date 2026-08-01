"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  RoadPlacement,
  placeRoad as placeRoadPure,
  removeRoad as removeRoadPure,
} from "../mockup/memberPlotSlice/roadSystem";

// Profile-scoped road-placement persistence for the PRODUCTION Inventory Land route -- same
// per-profile-id keying rationale as useInventoryLandPlacements.ts (its own header explains why),
// kept in a separate storage-key namespace from relic placements so the two can never collide,
// mirroring the mockup's own placements/roads split. roadSystem.ts's pure placement/removal logic
// is reused directly from the Member Plot Slice prototype -- it has no mock data or hard-coded
// state of its own, only pure grid-connection math, so there is nothing prototype-specific to
// duplicate there.
const STORAGE_KEY_PREFIX = "kingdom-scrolls-inventory-land-roads-v1:";

type Listener = () => void;
const listenersByKey = new Map<string, Listener[]>();
const cachedRawByKey = new Map<string, string | null>();
const cachedSnapshotByKey = new Map<string, RoadPlacement[]>();
const EMPTY_SNAPSHOT: RoadPlacement[] = [];

function readSnapshot(key: string): RoadPlacement[] {
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
  let snapshot: RoadPlacement[];
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    snapshot = Array.isArray(parsed) ? parsed : [];
  } catch {
    snapshot = [];
  }
  cachedSnapshotByKey.set(key, snapshot);
  return snapshot;
}

function writeSnapshot(key: string, next: RoadPlacement[]) {
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

export function useInventoryLandRoads(profileId: string) {
  const key = `${STORAGE_KEY_PREFIX}${profileId}`;

  const roads = useSyncExternalStore(
    useCallback((listener: Listener) => subscribe(key, listener), [key]),
    useCallback(() => readSnapshot(key), [key]),
    () => EMPTY_SNAPSHOT
  );

  const placeRoad = useCallback(
    (col: number, row: number) => {
      const idFactory = () =>
        typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      writeSnapshot(key, placeRoadPure(col, row, readSnapshot(key), idFactory));
    },
    [key]
  );

  const removeRoad = useCallback(
    (col: number, row: number) => {
      writeSnapshot(key, removeRoadPure(col, row, readSnapshot(key)));
    },
    [key]
  );

  const reset = useCallback(() => {
    writeSnapshot(key, []);
  }, [key]);

  return { roads, placeRoad, removeRoad, reset };
}

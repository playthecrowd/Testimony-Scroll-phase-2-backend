"use client";

import { useCallback, useSyncExternalStore } from "react";
import { RoadPlacement, placeRoad as placeRoadPure, removeRoad as removeRoadPure } from "./roadSystem";

// Road placement persistence -- localStorage-only, same disclosed simplification and same
// useSyncExternalStore-based external-store pattern as usePlotPlacements.ts (kept in its own
// storage key/module so relic placements and road placements never collide). See
// usePlotPlacements.ts's own header for why useSyncExternalStore is used instead of
// useState+useEffect.
//
// There is deliberately no "updateRoad"/manual override here (the first checkpoint had one, for a
// Rotate/Swap Type control that's been removed). A placement stores nothing that could go
// stale: no assetType, no rotation. Its visual appearance is always derived live from the current
// placement list, so there is nothing to manually override in the normal workflow.
const STORAGE_KEY = "kingdom-scrolls-member-plot-vertical-slice-roads-v1";

type Listener = () => void;
let listeners: Listener[] = [];
let cachedRaw: string | null | undefined = undefined;
let cachedSnapshot: RoadPlacement[] = [];

function readSnapshot(): RoadPlacement[] {
  if (typeof window === "undefined") return [];
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return [];
  }
  if (raw === cachedRaw) return cachedSnapshot;
  cachedRaw = raw;
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    cachedSnapshot = Array.isArray(parsed) ? parsed : [];
  } catch {
    cachedSnapshot = [];
  }
  return cachedSnapshot;
}

function writeSnapshot(next: RoadPlacement[]) {
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

const EMPTY_SNAPSHOT: RoadPlacement[] = [];
function getServerSnapshot(): RoadPlacement[] {
  return EMPTY_SNAPSHOT;
}

export function useRoadPlacements() {
  const roads = useSyncExternalStore(subscribe, readSnapshot, getServerSnapshot);

  const placeRoad = useCallback((col: number, row: number) => {
    const idFactory = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
    writeSnapshot(placeRoadPure(col, row, readSnapshot(), idFactory));
  }, []);

  const removeRoad = useCallback((col: number, row: number) => {
    writeSnapshot(removeRoadPure(col, row, readSnapshot()));
  }, []);

  const reset = useCallback(() => {
    writeSnapshot([]);
  }, []);

  return { roads, placeRoad, removeRoad, reset };
}

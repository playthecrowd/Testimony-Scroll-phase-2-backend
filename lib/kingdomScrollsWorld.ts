// Pure, framework-free world layout data for The Kingdom Scrolls (Phase 1 visual foundation).
// Kept separate from components so the coordinate math and presets are unit-testable without
// rendering anything, and so a future real kingdom_lands/kingdom_member_plots schema (Phase 4)
// can replace generatePlotPosition() with a real persisted lookup without touching camera logic.

export type WorldLevel = "upper" | "land" | "plot";

// Logical (not pixel) world size -- the world container is transformed with translate/scale, so
// this only defines the coordinate space everything else is placed within.
export const WORLD_WIDTH = 3000;
export const WORLD_HEIGHT = 4200;

// Vertical bands within the world, top to bottom: Upper Kingdom -> Cloud Passage -> Earth Lands.
// Used both for layout (where art/markers sit) and for the descent animation's visual logic.
export const UPPER_KINGDOM_Y_RANGE = { start: 0, end: 1500 } as const;
export const CLOUD_PASSAGE_Y_RANGE = { start: 1200, end: 1900 } as const;
export const EARTH_LANDS_Y_RANGE = { start: 1700, end: WORLD_HEIGHT } as const;

export interface CameraTarget {
  x: number;
  y: number;
  scale: number;
}

// One church's Home Land is centered in the world for Phase 1 (a single-organization view) --
// supporting multiple simultaneously-visible lands on one canvas is Phase 4 (World Map beyond a
// single Home Land) and needs the real kingdom_lands table to place them without collision.
const LAND_CENTER = { x: WORLD_WIDTH / 2, y: 2850 };

export const CAMERA_PRESETS: Record<WorldLevel, CameraTarget> = {
  upper: { x: WORLD_WIDTH / 2, y: 700, scale: 0.55 },
  land: { x: LAND_CENTER.x, y: LAND_CENTER.y, scale: 0.8 },
  plot: { x: LAND_CENTER.x, y: LAND_CENTER.y, scale: 1.7 }, // x/y overridden per-user by getPlotCameraTarget
};

export const MIN_ZOOM = 0.35;
export const MAX_ZOOM = 2.5;

export function clampZoom(scale: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale));
}

export interface UpperKingdomLocation {
  key: string;
  label: string;
  purpose: string;
  x: number;
  y: number;
  // Six of nine spec'd locations already map to a real, published route -- see the approved plan's
  // §10. Kingdom Hub has no destination of its own (orientation/recenter only), so href is null;
  // Inventory Vault, Testimony Dispatch, and Mission Gateways aren't placed yet since they depend
  // on schema that doesn't exist (relics/missions), not because they were forgotten.
  href: string | null;
}

// Static location layout matching Section 4's Upper Kingdom location list. Positions are
// hand-placed around the upper band's center so markers read as "a city with named districts,"
// not a grid. Purely presentational -- no lesson/relic/member data is attached to these yet.
export const UPPER_KINGDOM_LOCATIONS: UpperKingdomLocation[] = [
  { key: "kingdom-hub", label: "Kingdom Hub", purpose: "The Upper Kingdom's central gathering point.", x: WORLD_WIDTH / 2, y: 550, href: null },
  { key: "scroll-archive", label: "Scroll Archive", purpose: "Browse testimonies added to the Kingdom Scroll.", x: WORLD_WIDTH / 2 - 520, y: 700, href: "/kingdom-scroll" },
  { key: "wisdom-halls", label: "Wisdom Halls", purpose: "Browse every lesson available to Scroll Seekers.", x: WORLD_WIDTH / 2, y: 850, href: "/lessons" },
  { key: "training-courts", label: "Training Courts", purpose: "Join live Experiences hosted by churches.", x: WORLD_WIDTH / 2 + 520, y: 700, href: "/experiences" },
  { key: "light-keep", label: "Light Keep", purpose: "See where Seekers rank on the Kingdom leaderboard.", x: WORLD_WIDTH / 2 - 720, y: 420, href: "/leaderboard" },
  { key: "unity-plaza", label: "Unity Plaza", purpose: "Explore every church and organization in the Kingdom.", x: WORLD_WIDTH / 2 + 720, y: 420, href: "/churches" },
];

// Deterministic (not random) plot placement within the Home Land, keyed by the member's own
// profile id, so the same person always sees their plot in the same spot across sessions/devices
// without a persisted coordinate table yet. Replace with a real kingdom_member_plots lookup in
// Phase 4 -- callers should treat this as presentational only, never as an authoritative
// coordinate to write anywhere.
export function getPlotOffset(profileId: string): { dx: number; dy: number } {
  let hash = 0;
  for (let i = 0; i < profileId.length; i++) {
    hash = (hash * 31 + profileId.charCodeAt(i)) >>> 0;
  }
  const angle = (hash % 360) * (Math.PI / 180);
  const radius = 260 + (hash % 5) * 60; // 260-500px logical radius from the land center
  return { dx: Math.cos(angle) * radius, dy: Math.sin(angle) * radius * 0.55 }; // flattened for aerial perspective
}

export function getPlotCameraTarget(profileId: string): CameraTarget {
  const { dx, dy } = getPlotOffset(profileId);
  return { x: LAND_CENTER.x + dx, y: LAND_CENTER.y + dy, scale: CAMERA_PRESETS.plot.scale };
}

export function getPlotWorldPosition(profileId: string): { x: number; y: number } {
  const { dx, dy } = getPlotOffset(profileId);
  return { x: LAND_CENTER.x + dx, y: LAND_CENTER.y + dy };
}

export { LAND_CENTER };

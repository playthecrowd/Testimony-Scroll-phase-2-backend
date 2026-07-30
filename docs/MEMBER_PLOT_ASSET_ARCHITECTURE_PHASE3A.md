# Member Plot — Phase 3A Asset Architecture Document

Status: **DRAFT — pending checkpoint approval.** Defines the stable, artwork-independent data model
the road system (Phase 4) and everything placed after it will be built against. Documents the
model only -- no Admin Asset Library, no upload pipeline, no database migration, per standing
restrictions.

## Design principle

Every map object is created from an `AssetRecord`, referenced by a stable `assetId`. Placement
records reference `assetId` only, never a filename or artwork version. Replacing an asset's artwork
later must never require touching a single placement record.

## Data model

```ts
interface AssetRecord {
  assetId: string;                 // stable, e.g. "road.modern-2026.corner" -- never renamed
  roadFamilyId?: string;           // roads only, e.g. "road.modern-2026" -- groups swappable pieces
  category: "relic" | "building" | "road" | "natural" | "marker" | "grid-ui";
  assetType?: string;              // roads: "straight" | "corner" | "t-junction" | "intersection" | "end"
                                    // buildings: "member-home" | "civic" | ...
  artworkFile: string;             // path to the CURRENT published artwork
  artworkVariants?: {
    closeView?: string;
    mediumView?: string;
    distantView?: string;
    desktop?: string;
    mobile?: string;
  };
  inventoryIcon?: string;
  gridFootprint: { cols: number; rows: number };
  collisionFootprint: { col: number; row: number }[]; // offsets within footprint that block placement
  anchorPoint: { xPercent: number; yPercent: number }; // e.g. {50,100} = bottom-center
  supportedRotations: (0 | 90 | 180 | 270)[];
  styleVariant?: string;           // e.g. "modern-2026"
  placeable: boolean;
  interactive: boolean;
  decorative: boolean;
  placementPermissions: "member-own-plot" | "district-shared" | "church-managed" | "admin-only";
  ownershipRequirement?: "owned-relic" | "none";
  unlockRequirement?: { lessonId?: string; campaignLessonId?: string } | null;
  status: "draft" | "published" | "archived";
  artworkVersion: number;          // increments on artwork replacement only
}

interface PlacementRecord {
  placementId: string;             // stable, independent of assetId
  assetId: string;                 // references AssetRecord.assetId -- NEVER a filename
  col: number;
  row: number;
  rotation: 0 | 90 | 180 | 270;
  ownerId: string | null;
  placementPermissions: "member-own-plot" | "district-shared" | "church-managed";
}
```

### Compatibility with what's already shipped

This maps directly onto the existing `PlacedObject` shape in
`components/kingdom-scrolls/mockup/memberPlotSlice/usePlotPlacements.ts`
(`instanceId` -> `placementId`, `assetId`/`col`/`row`/`rotation` unchanged) and the existing
`PlaceableDef` in `placeableCatalog.ts`. Phase 4's road placements can reuse the exact same
persistence-hook pattern (module-level cache + `useSyncExternalStore`, localStorage-backed) without
redesigning it. Phase 5's real-ownership migration only *adds* `ownerId`/`placementPermissions`; it
does not restructure the shape.

### Why connection mask is not a stored field

The connection mask (which of a road tile's 4 edges are open) is derived live, at render and
interaction time, by checking whether each of the 4 neighboring cells also holds a road placement.
It is deliberately **not** persisted on `PlacementRecord`. Storing it would go stale the moment a
neighboring segment is added or removed; deriving it means removing one segment automatically and
correctly updates its neighbors' apparent connections with zero extra bookkeeping, and an artwork
swap can never desynchronize it from reality.

## Example records

### 1. Placeable Lesson Relic

```json
{
  "assetId": "relic.call-compass",
  "category": "relic",
  "artworkFile": "earth-lands/relics/relic.call-compass.png",
  "gridFootprint": { "cols": 1, "rows": 1 },
  "collisionFootprint": [{ "col": 0, "row": 0 }],
  "anchorPoint": { "xPercent": 50, "yPercent": 90 },
  "supportedRotations": [0, 90, 180, 270],
  "placeable": true,
  "interactive": false,
  "decorative": false,
  "placementPermissions": "member-own-plot",
  "ownershipRequirement": "owned-relic",
  "status": "published",
  "artworkVersion": 1
}
```

### 2. Modern building (member home)

```json
{
  "assetId": "earth.building.member-home-modern",
  "category": "building",
  "assetType": "member-home",
  "artworkFile": "earth-2026/buildings/earth.building.member-home-modern.png",
  "gridFootprint": { "cols": 2, "rows": 2 },
  "collisionFootprint": [
    { "col": 0, "row": 0 }, { "col": 1, "row": 0 },
    { "col": 0, "row": 1 }, { "col": 1, "row": 1 }
  ],
  "anchorPoint": { "xPercent": 50, "yPercent": 100 },
  "supportedRotations": [0],
  "placeable": false,
  "interactive": false,
  "decorative": false,
  "placementPermissions": "member-own-plot",
  "status": "published",
  "artworkVersion": 1
}
```

### 3-7. Road family (`roadFamilyId: "road.modern-2026"`)

| assetType | assetId | footprint | rotations | notes |
|---|---|---|---|---|
| straight | `road.modern-2026.straight` | 1x1 | 0, 90 | 2 opposite edges open |
| corner | `road.modern-2026.corner` | 1x1 | 0, 90, 180, 270 | 2 adjacent edges open |
| t-junction | `road.modern-2026.t-junction` | 1x1 | 0, 90, 180, 270 | 3 edges open |
| intersection | `road.modern-2026.intersection` | 1x1 | 0 | all 4 edges open |
| end | `road.modern-2026.end` | 1x1 | 0, 90, 180, 270 | 1 edge open |

All five share: `category: "road"`, `collisionFootprint: [{"col":0,"row":0}]`,
`anchorPoint: {"xPercent":50,"yPercent":50}` (flat, center-anchored like terrain, not
bottom-anchored like a standing object), `placeable: true`, `interactive: false`,
`decorative: false`, `placementPermissions: "member-own-plot"` (becomes `"district-shared"` once
Phase 6 exists), `status: "draft"` until Phase 4 generates the art, `artworkVersion: 1`.

## Artwork replacement — preserving existing roads

| | Before swap | After swap |
|---|---|---|
| `AssetRecord.artworkFile` | `road.modern-2026-v1.corner.png` | `road.modern-2026-v2.corner.png` |
| `AssetRecord.artworkVersion` | `1` | `2` |
| `PlacementRecord.assetId` | `road.modern-2026.corner` | unchanged |
| `PlacementRecord.col` / `row` | `(22, 17)` | unchanged |
| `PlacementRecord.rotation` | `90` | unchanged |
| `PlacementRecord.ownerId` | member A | unchanged |
| Derived connection mask | computed from neighbors | identical -- neighbors untouched |

Nothing in the placement layer references a filename or artwork version, so an entire road family's
art can be swapped by editing exactly one `AssetRecord` per piece type. Every existing saved road
layout, its connections, rotations, and ownership survive the swap unchanged.

## Scope note

This document defines the data model only. It authorizes no road artwork generation, no road
placement implementation, no Admin Asset Library, and no database migration. Per standing
restrictions: commits, pushes, PRs, merges, and deployment remain paused.

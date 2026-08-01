# Member Plot — Phase 2A Visual Specification Lock

Status: **DRAFT — pending checkpoint approval.** Companion document to
`docs/EARTH_WORLD_2026_ART_DIRECTION.md` and `docs/EARTH_LANDS_ART_DIRECTION.md`; does not replace
either, only applies/confirms their values against the working Member Plot renderer and closes the
gaps neither document covers (road lane width, road grid footprint, sidewalk width, road markings,
building-scale ratio).

Every value below is labeled **LOCKED** (already fixed by the working renderer or an
already-approved art-direction doc — changing it means touching shipped code or art, not just this
document) or **RECOMMENDATION** (proposed here for approval; nothing downstream depends on it yet).

## 1. Isometric camera angle — LOCKED

2:1 diamond projection, elevation ~30 degrees above horizon, azimuth fixed so every asset's
light/shadow reads from the same corner. Established in `EARTH_LANDS_ART_DIRECTION.md` section 2,
reused unchanged by `EARTH_WORLD_2026_ART_DIRECTION.md` section 2, and implemented in
`components/kingdom-scrolls/mockup/memberPlotSlice/memberPlotSliceLayout.ts`'s `gridToScreen()`.

## 2. Tile width and height — LOCKED

`TILE_W = 128px`, `TILE_H = 64px` at 1x display. Matches the spec's "128x64px at 1x" base tile
footprint exactly.

Note: the spec calls for source art authored at 2x (256x128) and exported 2x/1x via the existing
Next/Image pipeline. The already-shipped `earth-2026/` PNGs were not confirmed against that
pipeline -- flagged here as a gap to close before/during Phase 4 art generation, not asserted as
already satisfied.

## 3. World-to-grid coordinate convention — LOCKED

`gridToScreen(col,row) = ((col-row)*64, (col+row)*32)`. Draw order is `row + col` ascending
(painter's algorithm), matching every existing terrain/object z-index in `MemberPlotSlice.tsx`.

## 4. Building-scale rules — RECOMMENDATION

Not formally locked today. Current `displayWidth`/`displayHeight` values (home 200x210, pavilion
140x160, kiosk 55x65) were chosen per-asset by eye, not derived from a stated ratio.

Proposed rule: a 1x1-footprint building's roofline reads roughly 1.4-1.6x `TILE_H` tall on screen,
scaling proportionally for larger footprints -- consistent with `EARTH_LANDS_ART_DIRECTION.md`
section 2's existing "verticalClearance ~1.5x base diamond height" language. Needs confirmation.

## 5. Road lane width — RECOMMENDATION

Not defined anywhere yet. Proposed: one full grid cell (128px at 1x) equals one road segment
carrying both travel directions, matching how every other object in this system already occupies
whole cells. Needs confirmation.

## 6. Road grid footprint — RECOMMENDATION

Proposed: all 5 road-family pieces are 1x1 footprint -- one tile per segment, each of its 4
cardinal edges independently open or closed. This is what the connection-mask algorithm in the
approved Phase 4 spec assumes, and matches the already-used road-sidewalk ring tile. Needs
confirmation.

## 7. Sidewalk width — RECOMMENDATION

Proposed: sidewalks render as a companion overlay strip along a road tile's edge (not their own
grid cell), roughly 20-25% of `TILE_W`. Needs confirmation.

## 8. Lighting direction — LOCKED

Key light from the upper-left, warm tone (`#ffe9b8` per `EARTH_LANDS_ART_DIRECTION.md` section 3;
restated as "clear, warm daylight, late-afternoon sun" in `EARTH_WORLD_2026_ART_DIRECTION.md`
section 3). Every road asset must match this exactly.

## 9. Shadow direction and softness — LOCKED

Cast lower-right, shallow angle, soft-edged, 35-45% opacity, baked into each sprite's own canvas
(no live shadow engine exists). Same source as section 8.

## 10. Earth 2026 pavement style — PARTIALLY LOCKED

Palette token `--ew-asphalt` (`#3a3d42`) is locked (`EARTH_WORLD_2026_ART_DIRECTION.md` section 4).
Exact marking pattern is not yet locked -- see section 11.

## 11. Road markings — RECOMMENDATION

Proposed: white dashed lane divider, standard zebra-striped crosswalk at intersections/pedestrian
crossings, no painted arrows or text (keeps silhouettes clean at small scale per
`EARTH_LANDS_ART_DIRECTION.md` section 5's material rule). Needs confirmation.

## 12. Transparent-asset canvas rules — LOCKED

Per `EARTH_LANDS_ART_DIRECTION.md` section 2: terrain tiles = 256x128 canvas, no padding; small
props = 256x256; buildings scale with footprint; icons = 128x128, centered, no ground tile. Every
placeable/prop/building asset requires verified real alpha transparency (raw pixel-buffer sampling
via `sharp`, not visual inspection alone) -- already this session's established practice.

## 13. Asset anchor-point convention — LOCKED

Bottom-center of canvas maps to the center of the object's southernmost occupied cell. In code:
`translate(-50%, -100%)` for standing objects, `translate(-50%, -50%)` for flat terrain/grid tiles
that fill the cell itself. Both are already implemented consistently across every asset this
session.

## 14. Desktop and mobile scale behavior — LOCKED (correction to the older spec)

The Phase 1 responsive-camera system determines on-screen tile size continuously:
`minZoom = max(viewportWidth/ENV_WIDTH, viewportHeight/ENV_HEIGHT)`, clamped to the app's global
zoom floor/ceiling (see `useWorldCamera.ts`, `memberPlotSliceLayout.ts`'s `computeCoverMinZoom`).

This supersedes `EARTH_LANDS_ART_DIRECTION.md` section 7's older per-asset "Desktop size (px)" /
"Mobile size (px)" fields -- there is no longer a fixed desktop-vs-mobile pixel pair per asset,
since actual on-screen size is `footprint x current camera scale`, which changes continuously with
viewport size. The Phase 3A asset model (see `MEMBER_PLOT_ASSET_ARCHITECTURE_PHASE3A.md`) reflects
this correction and does not carry those two fields forward.

## Scope note

This document locks/recommends visual constants only. It authorizes no artwork generation, no road
placement implementation, no Admin Asset Library, no database migration, and no change to the
working camera or placement system. Per standing restrictions: commits, pushes, PRs, merges, and
deployment remain paused.

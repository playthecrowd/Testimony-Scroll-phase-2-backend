# Earth Lands Art Direction — Master Specification

> **SUPERSEDED (2026-07-28).** The medieval/fantasy architectural direction in this document is
> **no longer approved** for the ground world. It has been replaced by
> `docs/EARTH_WORLD_2026_ART_DIRECTION.md` (contemporary 2026 setting, per the newly approved
> "Earth World — 2026" reference screenshot). This document's technical sections — isometric
> projection math (§2), and the render-poc performance findings referenced in §9 — remain valid
> and are reused by the new spec. Its architectural/material/palette direction (§3-6) does not.
> The already-generated assets under `public/images/kingdom-scrolls/earth-lands/` are kept on disk
> for reference only, not for use in the Earth World 2026 build.

Status: **DRAFT — pending approval.** This is deliverable #1 of the Earth Lands asset review
checkpoint. Every terrain tile, road, natural object, building, marker, and relic generated for
Church Land and Member Plots must conform to this document. Do not generate downstream assets
against a different angle, palette, or lighting model than what's locked here — inconsistency
across assets is the single most common way an isometric tile game ends up looking assembled
rather than designed.

Nothing in this document authorizes database migrations, gameplay-system code, or insertion of
new art into the running app. Per standing scope: character work stays paused, no PR/merge/deploy.

## 1. Why this replaces the Checkpoint 1 Earth Lands treatment

Checkpoint 1 rendered the Earth Lands as a single flat background photo (`kingdomScrollsEarthLands`)
with location pins layered on top — closer to a landing-page hero image than a game world. That's
rejected. The Earth Lands, Church Land, and Member Plots are being rebuilt as an assembled
isometric scene: real terrain tiles on a grid, real building sprites at fixed grid footprints, real
placeable objects — the same construction method as a browser-based land-building game, built from
an original Kingdom Scrolls asset kit.

## 2. Isometric camera & grid specification

- **Projection**: 2:1 "true isometric" (dimetric approximation standard to browser tile games —
  not a literal 30°/30°/90° isometric, but the industry-standard diamond-tile convention that
  reads as isometric while keeping tile art cheap to produce and tile cleanly). Camera angle:
  fixed 3/4 top-down, elevation ≈ 30° above the horizon, azimuth locked so every asset is drawn
  from the same corner (north-west-facing key light side visible on every object — see §3).
- **Base tile footprint**: 128×64px at 1x (the on-screen diamond a single grid cell occupies at
  default zoom). Art is authored at 2x (256×128px tile footprint) and exported at 2x/1x via the
  existing Next/Image pipeline, matching this repo's existing `sizes`/responsive-image convention.
- **Grid**: standard offset/diamond grid, addressed by integer `(col, row)` coordinates. One grid
  cell = one terrain tile. Buildings and large objects occupy a declared **footprint** in cells
  (e.g. `2x2`, `3x2`) and are drawn anchored at their footprint's front-most (south) corner so
  they layer correctly with painter's-algorithm depth sorting (`draw order = row + col`, ascending).
- **Canvas conventions per category** (the padded transparent canvas each source PNG is authored
  on, before trimming for the app):
  - Terrain tiles: 256×128px canvas, art fills the full diamond, no padding.
  - Small props (1x1 footprint — rocks, flowers, single relics): 256×256px canvas, tile diamond
    implied at the bottom, object rises into the padding above.
  - Buildings/large objects (footprint ≥ 2x2): canvas height scales with footprint — width =
    `128 * (footprintCols + footprintRows)`, height = `64 * (footprintCols + footprintRows) +
    verticalClearance` where `verticalClearance` is enough headroom for the tallest silhouette in
    that category (roughly 1.5x the footprint's base diamond height; exact value confirmed per
    building during production once reference heights exist).
  - Icons (inventory/UI use): 128×128px canvas, object centered, no ground tile.
- **Anchor point**: every asset's technical spec (see §7) declares its anchor as the grid cell(s)
  its footprint occupies, expressed as the offset from the canvas's bottom-center pixel to the
  center of its southernmost occupied cell. This is what the renderer uses to place the sprite;
  it must be identical across every asset sharing a footprint size.

## 3. Lighting & shadow specification

- **Key light**: single warm "golden hour" directional light from the upper-left of the frame
  (consistent with the existing gateway-beam and reference-screenshot lighting already established
  in Checkpoint 1's Upper Kingdom art), color ≈ `#ffe9b8`, low-medium contrast.
- **Fill light**: soft, cool-neutral ambient (`#8fa5c2`-tinted, very low intensity) so shadow sides
  of objects never go pure black — keeps silhouettes readable at small on-screen sizes.
- **Shadows**: soft-edged, cast to the lower-right at a shallow angle (consistent across every
  asset), opacity ≈ 35-45%, no hard AO occlusion rings. Shadows are baked into each sprite's own
  canvas (not a separate shadow layer) since this renderer has no real-time lighting engine —
  every asset must arrive with its shadow already painted at the correct angle/softness.
- **No asset may use a different light direction, color temperature, or shadow angle than this.**
  A rock lit from the right while its neighboring tree is lit from the left is the fastest way to
  make the scene look like mismatched stock art.

## 4. Color palette

Grounded in the existing Kingdom Scrolls UI theme (`components/kingdom-scrolls/theme.css`) so the
world art and the HUD chrome read as one product, extended with natural terrain colors the UI theme
doesn't need:

| Token | Hex | Use |
|---|---|---|
| `--el-bronze` | `#8a6423` (= `--ks-bronze`) | Built structure trim, path borders, fences |
| `--el-gold` | `#d4a53d` (= `--ks-gold`) | Accent trim, banners, glow states, relic highlights |
| `--el-gold-light` | `#f0d68a` (= `--ks-gold-light`) | Highlight edges, selected-cell glow |
| `--el-grass-healthy` | `#5b8a3a` | Primary healthy grass tile |
| `--el-grass-dry` | `#a68a4a` | Dry/unused grass tile |
| `--el-soil` | `#6b4a30` | Bare soil |
| `--el-soil-tilled` | `#4a3320` | Cultivated soil (darker, furrow texture) |
| `--el-stone` | `#8a8478` | Stone tiles, cliff faces, foundations |
| `--el-sand` | `#d6c193` | Sand / shoreline |
| `--el-water-shallow` | `#5c9fb0` | Shallow water |
| `--el-water-deep` | `#2e5f78` | Deep water |
| `--el-forest-floor` | `#3c4a2a` | Forest floor tile |
| `--el-cloud-edge` | `#e8dcc0` | Cloud-facing land edge (where Earth Lands meets Cloud Passage) |

Structures always carry bronze/gold trim regardless of their base material, so every building reads
as unmistakably "Kingdom Scrolls" even at a glance. Natural tiles stay in the grounded
grass/soil/stone/water range above — no saturated cartoon greens or blues.

## 5. Material & rendering style

Painted-stylized realism: semi-realistic material shading (not flat vector cartoon, not photoreal
render) — the same rendering register as the existing approved Upper Kingdom hero art and the
gateway/archway foreground asset, applied to a game object's compressed, clean-silhouette
requirements. Concretely: readable clean outlines at small on-screen scale, restrained texture
detail (a grass tile reads as grass in one glance, not a photo of a lawn), no fine noise/grain that
would tile visibly or die under compression. Every object needs a **clean, unambiguous silhouette**
when reduced to ~64px on screen — this is the practical test each generated asset must pass before
being accepted into the kit.

## 6. Asset ID & storage convention

- **ID format**: `{category}.{subcategory}.{name}` in kebab-case, e.g. `terrain.grass.healthy`,
  `building.org.headquarters`, `marker.mission.destination`, `relic.call-compass.icon`.
- **Storage path**: `/public/images/kingdom-scrolls/earth-lands/{category}/{asset-id}.{ext}`, e.g.
  `/public/images/kingdom-scrolls/earth-lands/terrain/terrain.grass.healthy.webp`. Mirrors this
  repo's existing `data/backgrounds.ts`-style central registry convention — a matching
  `data/earthLandsAssets.ts` manifest (generated once the kit is approved, not before) will map
  every ID to its path plus the technical fields from §7, the same way `backgrounds.ts` already
  does for the existing hero images.

## 7. Per-asset technical schema

Every asset in every sheet is documented with this exact field set before generation, and the
generated file is checked against it after:

| Field | Notes |
|---|---|
| Asset name | Human-readable |
| Asset ID | Per §6 |
| Category | terrain / road / natural / building-org / building-member / marker / grid / relic |
| Grid footprint | e.g. `1x1`, `2x2`, `3x2`, or `n/a` for icons |
| Anchor point | Per §2 |
| Dimensions (px) | Canvas size per §2 |
| File format | WebP (raster) or SVG (borders/grid/simple icons) |
| Transparency | Yes/no — all placeable objects require alpha |
| Isometric angle | Confirms it matches §2 (single fixed value, not a per-asset choice) |
| Shadow behavior | Baked-in / none (terrain tiles have no cast shadow; objects do) |
| Collision footprint | Which cells within the grid footprint block placement of other objects |
| Placeable | Yes/no — can a player/host place this via the toolbar |
| Rotatable | Yes/no — roads and fences typically yes, buildings typically no for v1 |
| Interactive | Yes/no — does it open a popup / link / action |
| Desktop size | On-screen px at default desktop zoom |
| Mobile size | On-screen px at default mobile zoom (may differ if mobile default zoom differs) |
| Optimization target | Max file size budget (terrain tiles ≤15KB, props ≤40KB, buildings ≤120KB) |
| Storage path | Per §6 |

## 8. File format & optimization standards

- **WebP** for all raster game objects (terrain, natural objects, buildings, relics) — smaller than
  PNG at equivalent quality, and this repo's Next/Image pipeline already serves WebP automatically
  where supported, so no new tooling is needed.
- **SVG** for grid overlays, selection-state outlines, and simple geometric UI (border/highlight
  states) — these need to scale/recolor cleanly and have no photographic detail.
- **PNG fallback** only where WebP alpha causes visible banding on a specific asset during QA —
  decided per-asset, not the default.
- Every placeable/prop/building asset ships with **real alpha transparency**, verified the same way
  Checkpoint 1's foreground/cloud assets were verified before being wired in: raw pixel-buffer alpha
  sampling (via `sharp`), not visual inspection alone. This caught two real defects last checkpoint
  (opaque "transparent" regions, green-spill keying) and remains mandatory for every asset in this
  kit before it's accepted into any sheet.
- No asset ships with baked-in labels, watermarks, or a background — confirmed the same way.

## 9. What this spec does not cover yet

- Exact building silhouette designs (that's the building sheets themselves, produced against this
  spec).
- The renderer/engine question (DOM-vs-Canvas/PixiJS for the assembled isometric scene) — Checkpoint
  1's rendering-POC findings (DOM for interactive chrome, Canvas/PixiJS for scalable world content)
  still apply as the starting assumption, but assembling potentially hundreds of tiles/objects on a
  grid is a materially different rendering problem than a handful of absolutely-positioned markers
  over one background image, and deserves its own POC pass before the first real Church Land build —
  flagged here, not resolved here.
- Database schema for placement/ownership (explicitly out of scope until the two mockups are
  approved, per standing instruction).

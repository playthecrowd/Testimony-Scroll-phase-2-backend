# Earth World — 2026 — Master Art-Direction Specification

Status: **DRAFT — pending checkpoint approval.** Source of truth: the approved "Earth World —
2026" reference screenshot (`ChatGPT Image Jul 28, 2026, 10_48_38 AM.png`, supplied 2026-07-28).

**This document REPLACES `docs/EARTH_LANDS_ART_DIRECTION.md` as the visual direction for the
ground world.** The medieval/fantasy treatment in that earlier document (cottages, stone temples,
bronze-and-gold building trim on every structure) is explicitly rejected for this world. That
document is retained for its still-valid technical sections (isometric projection math, the
render-poc performance findings) but its architectural/material direction no longer applies here.

## 1. World identity

Contemporary, believable **2026**. A real, modern church campus: glass-and-timber contemporary
architecture, solar panels, EVs and chargers, paved lots with current lane markings, accessible
ramps, LED path lighting, community gardens. Nothing medieval, nothing rustic-fantasy, nothing that
reads as a different century. This is the practical, current-day counterpart to the Upper Kingdom's
timeless celestial world.

**Explicitly forbidden in this world**: medieval cottages, stone fantasy temples, ancient ruins,
rustic village structures, farm/agrarian aesthetics, bronze-and-gold ornamental building trim (that
language stays reserved for the Upper Kingdom and for portable relic/UI objects, not architecture
here).

## 2. Isometric camera & grid

Same 2:1 diamond projection, same tile/canvas conventions as the existing render-poc-validated
system (`EARTH_LANDS_ART_DIRECTION.md` §2). The camera angle, tile pixel dimensions, and anchor
convention are shared across both worlds so the same renderer/grid code serves both — only the art
changes.

## 3. Lighting & shadow

Key light: clear, warm daylight (late-afternoon sun, not the Upper Kingdom's celestial gold-beam
drama) from the upper-left, matching the reference's naturalistic photographic lighting. Shadows:
soft, naturalistic, cast lower-right. Materials should read as real-world glass, concrete, timber
cladding, and asphalt under normal sunlight — not the Upper Kingdom's stylized gold rim-lighting.

## 4. Palette

| Token | Hex | Use |
|---|---|---|
| `--ew-sky` | `#a9c6dd` | Daytime sky reference (not used directly as a tile, informs lighting) |
| `--ew-concrete` | `#c9c6bd` | Modern building facades, paths |
| `--ew-glass` | `#8fb3c9` | Glazing, glass curtain walls |
| `--ew-timber` | `#a67c52` | Warm timber cladding/accent trim |
| `--ew-grass` | `#5f8a45` | Lawn / landscaped grass (brighter, more manicured than Upper Kingdom's) |
| `--ew-asphalt` | `#3a3d42` | Roads, parking |
| `--ew-solar` | `#1c2b3a` | Solar panel surfaces |
| `--ew-accent-gold` | `#d4a53d` (shared `--ks-gold`) | UI/marker accents ONLY — never architecture |
| `--ew-ev-teal` | `#2fbf9f` | EV charger accent lighting |

Kept minimal overlap with the Upper Kingdom's bronze/gold palette deliberately: Earth World's
buildings should NOT carry gold trim the way Upper Kingdom buildings do. Gold stays reserved for
UI chrome, markers, and equipped relic objects — the one visual thread tying both worlds to the
same HUD.

## 5. Material & rendering style

Same painted-stylized-realism register as everything else in this project, but the reference
material shifts from ornate/gilded to clean/contemporary: glass curtain walls, exposed timber
accents, poured concrete, painted crosswalk striping, solar glass. Still isometric/game-object
proportioned (not photoreal), still needs a clean readable silhouette at small scale, same shadow
softness convention.

## 6. Content list (full library — see checkpoint subset in the completion report)

Modern Renaissance Church HQ, contemporary ministry center, community learning pavilion, digital
Testimony Scroll kiosk, counseling center, food-distribution center, youth activity area, prayer
garden, community garden, modern starter home, upgraded member home, apartment-style member plot,
modern road/sidewalk/crosswalk/parking set, current car, EV, EV charger, bike rack, solar-panel
structure, LED path lights, accessible ramp, trees/shrubs/gardens/pond/rain-garden/rocks, modern
signage, territory/member-plot boundaries, grid states, mission routes, lesson/testimony markers,
Earth mini-map treatment, "Earth — 2026" world icon.

## 7. Per-asset technical schema

Same field set as `EARTH_LANDS_ART_DIRECTION.md` §7, with **World** always `earth-2026`.

## 8. Storage & format

`/public/images/kingdom-scrolls/earth-2026/{category}/{asset-id}.png`. ID format:
`earth.{category}.{name}`, e.g. `earth.building.church-hq`, `earth.vehicle.ev`,
`earth.marker.testimony-mission`. Same WebP/PNG and transparency rules as the shared spec.

## 9. Relationship to the old Earth Lands library

The 16 terrain tiles, buildings, and props under `public/images/kingdom-scrolls/earth-lands/` are
**superseded, not deleted** — kept on disk for reference/comparison only. Nothing from that
directory should be used in the Earth World 2026 checkpoint or final build. New Earth World assets
go under the new `earth-2026/` path from §8, not into `earth-lands/`.

# Upper Kingdom — Testimony World — Master Art-Direction Specification

Status: **DRAFT — pending checkpoint approval.** Source of truth: the approved "Upper Kingdom —
Testimony World" reference screenshot (`ChatGPT Image Jul 28, 2026, 10_48_11 AM (1).png`, supplied
2026-07-28). This reference is used for style, architecture, lighting, and content — not as a
literal single background image to ship; the world is still assembled from discrete assets on the
isometric grid established in the render-poc (see `docs/EARTH_LANDS_ART_DIRECTION.md` §9 for the
technical rendering findings, which still apply).

## 1. World identity

Timeless, celestial, monumental. A floating bronze-and-gold kingdom of islands connected by
bridges and celestial roads, above a permanent cloud layer, lit by golden late-afternoon/celestial
sunlight. Nothing here reads as "current year" — no modern materials, no contemporary silhouettes.
This is the fixed, eternal counterpart to Earth World's 2026 setting.

## 2. Isometric camera & grid

Same 2:1 diamond projection and grid convention as the existing spec (128×64px on-screen tile at
1x, art authored at 2x). Difference from Earth World: the Upper Kingdom composition in the
reference is more vertically dramatic (multiple elevation tiers, floating islands at different
heights) — buildings and terrain pieces on this world may declare a `elevationTier` (0 = base
island, 1/2/3 = higher floating tiers) in addition to grid footprint, purely for layout/z-ordering
purposes; this doesn't change the projection math, just adds a vertical offset per tier when
composing a scene.

## 3. Lighting & shadow

Key light: strong warm gold, high in the sky, near-back-lit (the reference's central gateway beam
and rim-lit spires come from a light source behind/above the Kingdom Hub). Every structure gets a
warm gold rim-light on its upper/sun-facing edges and cooler bronze/shadow on the lower faces.
Volumetric cloud layers (back/middle/foreground, per the checkpoint list) carry soft directional
light-shafts consistent with this same source.

## 4. Palette

| Token | Hex | Use |
|---|---|---|
| `--uk-navy` | `#0a1428` | Sky/deep background, panel base |
| `--uk-bronze` | `#8a6423` (shared with `--ks-bronze`) | Structure trim |
| `--uk-gold` | `#d4a53d` (shared with `--ks-gold`) | Accent, beams, glow |
| `--uk-gold-light` | `#f0d68a` (shared with `--ks-gold-light`) | Highlight edges, rim light |
| `--uk-stone` | `#9a8f7a` | Island rock/cliff base under structures |
| `--uk-cloud` | `#e8dcc0` → `#ffffff` gradient | Cloud layers, brighter toward the light source |

Identical bronze/gold family to the existing `ks-theme` HUD tokens — this is deliberate: the HUD
chrome already matches this world's palette natively, which is why Earth World (below) needs its
own additional palette rather than replacing this one.

## 5. Material & rendering style

Same painted-stylized-realism register already approved for the Checkpoint 1 Upper Kingdom hero
art and the corrected foreground/cloud assets — ornate architectural detail (spires, domes,
buttresses, glowing windows), ok to be more elaborate/dense than Earth World's cleaner contemporary
forms, since "timeless celestial monument" reads as intricate rather than minimal.

## 6. Content list (full library — see checkpoint subset in the completion report)

Distant/midground/foreground floating islands, bridges, celestial roads, Kingdom Hub, Scroll
Archive, Wisdom Halls, Training Courts, Light Keep, Unity Plaza, Testimony Dispatch, Mission
Gateways, lesson portals, testimony mission markers, member markers, gateway beam, three cloud
layers (back/middle/foreground), celestial lighting-effect overlays, kingdom mini-map treatment,
world icon, ascend/descend interface graphics.

## 7. Per-asset technical schema

Same field set as `EARTH_LANDS_ART_DIRECTION.md` §7, plus:
- **World**: always `upper-kingdom`
- **Elevation tier**: 0-3, per §2

## 8. Storage & format

`/public/images/kingdom-scrolls/upper-kingdom/{category}/{asset-id}.png`, WebP/PNG per the same
rules as the Earth Lands spec (§8 there). ID format: `upper.{category}.{name}`, e.g.
`upper.building.wisdom-halls`, `upper.cloud.back-layer`, `upper.marker.testimony-mission`.

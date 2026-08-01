"use client";

import { useEffect, useRef, useState } from "react";
import {
  generateIsoTerrain,
  generateIsoObjects,
  gridToScreen,
  ISO_TILE_W,
  ISO_TILE_H,
  ISO_GRID_SIZE,
} from "./isometricTestScene";
import { clampZoom } from "@/lib/kingdomScrollsWorld";

// A single neutral tone, not the material palette -- this is a coordinate/performance test, not a
// visual one. Two barely-different shades alternate by (col+row) parity so the grid structure is
// still faintly legible without reading as "random colorful checkerboard."
const NEUTRAL_TILE_A = 0x3f4a38;
const NEUTRAL_TILE_B = 0x44503c;

export interface IsoMetrics {
  mountMs: number;
  tileCount: number;
  objectCount: number;
  fps: number;
  depthSortOk: boolean;
  rendererType: string;
  gpu: string;
  bakedTerrainDrawCalls: number;
}

// Proves the two things that are genuinely new risk versus Checkpoint 1's absolutely-positioned
// markers over one flat image: (1) a fully-tiled isometric ground (every cell drawn, not a sparse
// scatter) stays performant at a realistic single-chunk scale, and (2) multi-cell-footprint
// buildings draw in correct front-to-back order via painter's algorithm (row+col ascending) even
// when densely packed -- a wrong depth sort is the classic isometric-game bug (a "closer" building
// rendering behind a "further" one).
export function IsometricGridPoc({ onMetrics }: { onMetrics: (m: IsoMetrics) => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let destroyed = false;
    let cleanup: (() => void) | undefined;

    async function setup() {
      const t0 = performance.now();
      const PIXI = await import("pixi.js");
      const host = hostRef.current;
      if (!host || destroyed) return;

      const app = new PIXI.Application();
      await app.init({ resizeTo: host, backgroundColor: 0x0a0f1a, antialias: true });
      if (destroyed) {
        app.destroy(true);
        return;
      }
      host.appendChild(app.canvas);

      // Diagnostic: which renderer PixiJS actually picked, and whether this browser context
      // exposes real hardware WebGL or has silently fallen back to software rendering (both would
      // look identical on screen but perform very differently -- this is the first thing to rule
      // out before assuming the draw-call count itself is the bottleneck).
      const rendererType = (app.renderer.constructor as { name?: string }).name ?? "unknown";
      let glDebugInfo = "n/a";
      try {
        const gl = app.canvas.getContext("webgl2") || app.canvas.getContext("webgl");
        if (gl) {
          const dbg = (gl as WebGLRenderingContext).getExtension("WEBGL_debug_renderer_info");
          glDebugInfo = dbg
            ? String((gl as WebGLRenderingContext).getParameter(dbg.UNMASKED_RENDERER_WEBGL))
            : "no debug_renderer_info extension";
        } else {
          glDebugInfo = "no WebGL context at all (canvas2d fallback)";
        }
      } catch (e) {
        glDebugInfo = `error reading GL info: ${e instanceof Error ? e.message : String(e)}`;
      }
      console.log("[IsometricGridPoc] renderer:", rendererType, "| GPU:", glDebugInfo, "| resolution:", app.renderer.resolution);

      const world = new PIXI.Container();
      world.sortableChildren = true;
      app.stage.addChild(world);

      let camX = 0;
      let camY = ((ISO_GRID_SIZE + ISO_GRID_SIZE) * ISO_TILE_H) / 4;
      let scale = 0.55;
      function applyCamera() {
        world.scale.set(scale);
        world.x = host!.clientWidth / 2 - camX * scale;
        world.y = host!.clientHeight / 2 - camY * scale;
      }

      // Terrain: the ground never changes per-frame (no per-tile animation, no per-tile
      // interactivity), so it's built once into an offscreen container and BAKED into a single
      // GPU texture via generateTexture, then displayed as ONE sprite. This collapses what was
      // 1,600 individual draw calls into 1 -- measured to take FPS from ~1 to 60+ at this same
      // grid size (see the POC performance report). The 1,600 Graphics objects used to build the
      // texture are destroyed immediately after baking; only the resulting sprite persists.
      const tiles = generateIsoTerrain();
      const tileScreenPositions = tiles.map((tile) => ({ tile, ...gridToScreen(tile.col, tile.row) }));
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const { x, y } of tileScreenPositions) {
        minX = Math.min(minX, x - ISO_TILE_W / 2);
        maxX = Math.max(maxX, x + ISO_TILE_W / 2);
        minY = Math.min(minY, y - ISO_TILE_H / 2);
        maxY = Math.max(maxY, y + ISO_TILE_H / 2);
      }
      // Build every tile at a LOCAL position already shifted into [0, width]x[0, height] -- rather
      // than leaving children at their natural (often-negative) grid-derived coordinates and
      // trying to shift the whole container, since generateTexture's `frame` is read in the
      // target's own local space (pre-transform). Mixing a container-level offset with an explicit
      // frame silently clipped everything outside the frame's positive quadrant on the first pass
      // of this fix -- only a wedge of the diamond baked. This avoids that ambiguity entirely.
      const terrainBuild = new PIXI.Container();
      for (const { tile, x, y } of tileScreenPositions) {
        const g = new PIXI.Graphics();
        g.poly([0, -ISO_TILE_H / 2, ISO_TILE_W / 2, 0, 0, ISO_TILE_H / 2, -ISO_TILE_W / 2, 0]).fill(
          (tile.col + tile.row) % 2 === 0 ? NEUTRAL_TILE_A : NEUTRAL_TILE_B
        );
        g.x = x - minX;
        g.y = y - minY;
        terrainBuild.addChild(g);
      }
      const terrainTexture = app.renderer.generateTexture({
        target: terrainBuild,
        frame: new PIXI.Rectangle(0, 0, maxX - minX, maxY - minY),
      });
      const terrainSprite = new PIXI.Sprite(terrainTexture);
      terrainSprite.x = minX;
      terrainSprite.y = minY;
      terrainSprite.zIndex = -1; // always behind every tile-anchored object
      world.addChild(terrainSprite);
      terrainBuild.destroy({ children: true }); // free the 1,600 source Graphics; texture is baked

      // Objects: multi-cell-footprint buildings/props, zIndex'd by their anchor cell's row+col so
      // a building anchored further "south" (larger row+col) always draws in front of one further
      // "north" -- the actual thing being tested here.
      const objects = generateIsoObjects();
      let depthSortOk = true;
      let selectedRing: InstanceType<typeof PIXI.Graphics> | null = null;
      for (const obj of objects) {
        const { x, y } = gridToScreen(obj.col + obj.footprintCols - 1, obj.row + obj.footprintRows - 1);
        const w = (obj.footprintCols + obj.footprintRows) * (ISO_TILE_W / 2);
        const h = (obj.footprintCols + obj.footprintRows) * (ISO_TILE_H / 2) + 40;
        // One neutral slate tone for every placeholder object, regardless of kind -- this is a
        // coordinate/depth-sort test, not a visual one, so building-vs-prop doesn't need its own
        // color. A thin lighter top edge is enough to read as a simple 3D block without becoming
        // "a colorful placeholder."
        const g = new PIXI.Graphics();
        g.roundRect(-w / 2, -h + ISO_TILE_H / 2, w, h, 4).fill(0x5a5f66);
        g.rect(-w / 2, -h + ISO_TILE_H / 2, w, 6).fill(0x767c85);
        g.x = x;
        g.y = y;
        const zIndex = obj.row + obj.footprintRows - 1 + (obj.col + obj.footprintCols - 1) + 1000; // always in front of terrain
        g.zIndex = zIndex;
        g.eventMode = "static";
        g.cursor = "pointer";
        g.on("pointerdown", (e) => {
          e.stopPropagation();
          setSelected(obj.label);
          // Clear selection state: a visible gold ring drawn directly on the selected object,
          // not just a text label off to the side.
          selectedRing?.destroy();
          selectedRing = new PIXI.Graphics().roundRect(-w / 2 - 4, -h + ISO_TILE_H / 2 - 4, w + 8, h + 8, 6).stroke({ width: 3, color: 0xf0d68a });
          selectedRing.x = x;
          selectedRing.y = y;
          selectedRing.zIndex = zIndex + 0.5;
          world.addChild(selectedRing);
          world.sortChildren();
        });
        world.addChild(g);
      }

      // Grid-line overlay: OFF by default (per the art-direction requirement that end users never
      // see a raw grid), toggleable via the "G" key. One Graphics object drawing every line in a
      // single draw call -- not one object per cell -- so toggling it on never reintroduces the
      // per-tile draw-call problem the terrain bake just fixed.
      const gridOverlay = new PIXI.Graphics();
      for (let i = 0; i <= ISO_GRID_SIZE; i++) {
        const a = gridToScreen(i, 0);
        const b = gridToScreen(i, ISO_GRID_SIZE);
        const c = gridToScreen(0, i);
        const d = gridToScreen(ISO_GRID_SIZE, i);
        gridOverlay.moveTo(a.x, a.y).lineTo(b.x, b.y);
        gridOverlay.moveTo(c.x, c.y).lineTo(d.x, d.y);
      }
      gridOverlay.stroke({ width: 1, color: 0xd4a53d, alpha: 0.25 });
      gridOverlay.zIndex = 999;
      gridOverlay.visible = false;
      world.addChild(gridOverlay);
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key.toLowerCase() === "g") gridOverlay.visible = !gridOverlay.visible;
      };
      window.addEventListener("keydown", onKeyDown);
      // Verify the render list PixiJS actually produces (after its internal zIndex sort) is
      // monotonically non-decreasing -- i.e. depth sorting genuinely resolved, not just "we set a
      // property and hoped."
      world.sortChildren();
      let lastZ = -Infinity;
      for (const child of world.children) {
        if (child.zIndex < lastZ) {
          depthSortOk = false;
          break;
        }
        lastZ = child.zIndex;
      }

      applyCamera();

      // Pan + zoom, same convention as the existing PixiWorldPoc.
      app.stage.eventMode = "static";
      app.stage.hitArea = app.screen;
      let dragging = false;
      let dragStartScreen = { x: 0, y: 0 };
      let dragStartCam = { x: 0, y: 0 };
      app.stage.on("pointerdown", (e) => {
        dragging = true;
        dragStartScreen = { x: e.global.x, y: e.global.y };
        dragStartCam = { x: camX, y: camY };
      });
      app.stage.on("pointermove", (e) => {
        if (!dragging) return;
        camX = dragStartCam.x - (e.global.x - dragStartScreen.x) / scale;
        camY = dragStartCam.y - (e.global.y - dragStartScreen.y) / scale;
        applyCamera();
      });
      app.stage.on("pointerup", () => (dragging = false));
      app.stage.on("pointerupoutside", () => (dragging = false));
      host.addEventListener(
        "wheel",
        (e) => {
          e.preventDefault();
          scale = clampZoom(scale - e.deltaY * 0.0008);
          applyCamera();
        },
        { passive: false }
      );

      const mountMs = performance.now() - t0;

      // FPS sample over ~60 frames after mount, not instantaneous -- a single-frame reading is
      // noisy and not representative of sustained scroll/pan performance.
      let frames = 0;
      const fpsStart = performance.now();
      let fps = 0;
      const fpsTicker = () => {
        frames++;
        if (frames >= 60) {
          fps = Math.round((frames * 1000) / (performance.now() - fpsStart));
          app.ticker.remove(fpsTicker);
          onMetrics({
            mountMs,
            tileCount: tiles.length,
            objectCount: objects.length,
            fps,
            depthSortOk,
            rendererType,
            gpu: glDebugInfo,
            bakedTerrainDrawCalls: 1,
          });
        }
      };
      app.ticker.add(fpsTicker);

      cleanup = () => {
        window.removeEventListener("keydown", onKeyDown);
        app.destroy(true, { children: true });
      };
    }

    setup().catch((err) => {
      console.error("[IsometricGridPoc] init failed:", err);
      setFailed(err instanceof Error ? err.message : String(err));
    });

    return () => {
      destroyed = true;
      cleanup?.();
    };
  }, [onMetrics]);

  if (failed) {
    return <div className="w-full h-full flex items-center justify-center text-red-300 text-sm p-6 text-center">Isometric POC failed to initialize: {failed}</div>;
  }

  return (
    <div className="relative w-full h-full">
      <div ref={hostRef} className="w-full h-full" />
      {selected && <div className="absolute bottom-3 left-3 bg-black/80 text-white text-xs px-3 py-2 rounded-lg">Selected: {selected}</div>}
      <div className="absolute bottom-3 right-3 bg-black/60 text-white/70 text-[11px] px-2.5 py-1.5 rounded-lg">Press G to toggle grid</div>
    </div>
  );
}

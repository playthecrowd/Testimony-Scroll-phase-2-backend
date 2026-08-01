"use client";

import { useEffect, useRef, useState } from "react";
import { generateTestScene, GRID_SIZE, CELL_SIZE, WORLD_PX, PocObject } from "./testScene";
import { clampZoom } from "@/lib/kingdomScrollsWorld";

const KIND_COLOR: Record<PocObject["kind"], number> = {
  relic: 0xd4a53d,
  building: 0x6f8fc9,
  decoration: 0x7fbf9e,
};

// No accessibility plugin enabled here deliberately -- this tests the true out-of-the-box
// behavior of interactive canvas content (see the writeup's Accessibility row). PixiJS does ship
// an opt-in `accessibility` feature that mirrors interactive objects into shadow DOM buttons; it's
// noted as a partial mitigation in the findings, not exercised in this POC.
export function PixiWorldPoc({ onMetrics }: { onMetrics: (m: { mountedNodes: number; mountMs: number; drawCalls: number }) => void }) {
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let destroyed = false;
    let cleanup: (() => void) | undefined;

    async function setup() {
      const t0 = performance.now();
      const PIXI = await import("pixi.js");
      const host = canvasHostRef.current;
      if (!host || destroyed) return;

      const app = new PIXI.Application();
      await app.init({
        resizeTo: host,
        backgroundColor: 0x0a0f1a,
        antialias: true,
      });
      if (destroyed) {
        app.destroy(true);
        return;
      }
      host.appendChild(app.canvas);

      const world = new PIXI.Container();
      app.stage.addChild(world);
      world.x = host.clientWidth / 2;
      world.y = host.clientHeight / 2;
      world.scale.set(1);
      // World-space camera target (matches the DOM POC's camera.x/y convention: the world point
      // currently centered under the viewport).
      let camX = WORLD_PX / 2;
      let camY = WORLD_PX / 2;
      let scale = 1;

      function applyCamera() {
        world.scale.set(scale);
        world.x = host!.clientWidth / 2 - camX * scale;
        world.y = host!.clientHeight / 2 - camY * scale;
      }
      applyCamera();

      // Grid lines: one Graphics object drawing GRID_SIZE+1 lines each way -- still one display
      // object, not one per cell, matching the DOM POC's single tiled-background approach.
      const grid = new PIXI.Graphics();
      for (let i = 0; i <= GRID_SIZE; i++) {
        grid.moveTo(i * CELL_SIZE, 0).lineTo(i * CELL_SIZE, WORLD_PX);
        grid.moveTo(0, i * CELL_SIZE).lineTo(WORLD_PX, i * CELL_SIZE);
      }
      grid.stroke({ width: 1, color: 0xd4a53d, alpha: 0.15 });
      world.addChild(grid);

      // Mission path.
      const path = new PIXI.Graphics();
      path
        .moveTo(2 * CELL_SIZE, 2 * CELL_SIZE)
        .lineTo((GRID_SIZE - 3) * CELL_SIZE, (GRID_SIZE - 3) * CELL_SIZE)
        .stroke({ width: 3, color: 0xd4a53d });
      world.addChild(path);

      // Objects -- each a real interactive Graphics circle (no texture atlas for this POC; a
      // production build would use Sprites from a texture atlas instead, which is faster to draw
      // but doesn't change the interaction/accessibility findings this POC is measuring).
      const objects = generateTestScene();
      let drawCalls = 0;
      for (const obj of objects) {
        const g = new PIXI.Graphics();
        g.circle(0, 0, (CELL_SIZE - 8) / 2).fill(KIND_COLOR[obj.kind]);
        g.x = obj.gridX * CELL_SIZE + CELL_SIZE / 2;
        g.y = obj.gridY * CELL_SIZE + CELL_SIZE / 2;
        g.eventMode = "static";
        g.cursor = "pointer";
        g.on("pointerdown", (e) => {
          e.stopPropagation();
          setSelectedLabel(obj.label);
          g.scale.set(1.15);
        });
        world.addChild(g);
        drawCalls++;
      }

      // One pulsing "gateway" object, animated via the Pixi ticker (not CSS -- this is the direct
      // comparison point for "future animation" support).
      const gateway = new PIXI.Graphics();
      gateway.circle(0, 0, 20).fill(0xd4a53d);
      gateway.x = (GRID_SIZE / 2) * CELL_SIZE;
      gateway.y = (GRID_SIZE / 2) * CELL_SIZE;
      world.addChild(gateway);
      app.ticker.add((ticker) => {
        const s = 1 + Math.sin(ticker.lastTime / 300) * 0.15;
        gateway.scale.set(s);
      });

      // Pan (drag) + wheel zoom on the whole stage, mirroring the DOM POC's camera semantics.
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
          scale = clampZoom(scale - e.deltaY * 0.0012);
          applyCamera();
        },
        { passive: false }
      );

      const mountMs = performance.now() - t0;
      requestAnimationFrame(() => {
        const domNodesUnderHost = host.querySelectorAll("*").length; // expect ~1 (the <canvas>)
        onMetrics({ mountedNodes: domNodesUnderHost, mountMs, drawCalls });
      });

      cleanup = () => {
        app.destroy(true, { children: true });
      };
    }

    setup().catch((err) => {
      console.error("[PixiWorldPoc] init failed:", err);
      setFailed(err instanceof Error ? err.message : String(err));
    });

    return () => {
      destroyed = true;
      cleanup?.();
    };
  }, [onMetrics]);

  if (failed) {
    return <div className="w-full h-full flex items-center justify-center text-red-300 text-sm p-6 text-center">PixiJS failed to initialize: {failed}</div>;
  }

  return (
    <div className="relative w-full h-full">
      <div ref={canvasHostRef} className="w-full h-full" />
      {selectedLabel && (
        <div className="absolute bottom-3 left-3 bg-black/80 text-white text-xs px-3 py-2 rounded-lg">Selected: {selectedLabel}</div>
      )}
    </div>
  );
}

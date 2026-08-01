"use client";

import { useCallback, useState } from "react";
import { IsometricGridPoc, IsoMetrics } from "./IsometricGridPoc";
import { ISO_GRID_SIZE } from "./isometricTestScene";

// Internal test harness for the isometric-grid rendering POC (Earth Lands art-direction
// checkpoint, §9). Not linked from any navigation, not part of the real Kingdom Scrolls feature.
// This is NOT approved visual direction and must never be presented as Earth Land / Church Land /
// Member Plot art -- it exists only to validate coordinate conversion, depth sorting, camera
// movement, selection, and rendering performance. Debug metrics are hidden by default (press D)
// so a screenshot of this harness doesn't read as "an experience" with instrumentation baked in.
export function IsometricGridPocHarness() {
  const [metrics, setMetrics] = useState<IsoMetrics | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const onMetrics = useCallback((m: IsoMetrics) => setMetrics(m), []);

  return (
    <div className="fixed inset-0 flex flex-col bg-[#04060c] text-white" onKeyDown={(e) => e.key.toLowerCase() === "d" && setShowDebug((v) => !v)} tabIndex={-1}>
      <div className="p-2 border-b-2 border-red-500/60 bg-red-950/40 text-center text-[11px] font-bold uppercase tracking-wide text-red-200">
        Internal Rendering POC -- Not Final Art. Not an approved visual direction for the Kingdom Scrolls world.
      </div>
      {showDebug && (
        <div className="p-3 border-b border-white/10 flex items-center gap-4 flex-wrap text-xs font-mono bg-black/40">
          <span className="font-bold text-sm">Isometric Grid POC (debug -- press D to hide)</span>
          <span>grid: {ISO_GRID_SIZE}x{ISO_GRID_SIZE} ({ISO_GRID_SIZE * ISO_GRID_SIZE} tiles)</span>
          {metrics ? (
            <>
              <span>renderer: {metrics.rendererType}</span>
              <span>gpu: {metrics.gpu}</span>
              <span>mount: {metrics.mountMs.toFixed(1)}ms</span>
              <span>terrain draw calls: {metrics.bakedTerrainDrawCalls} (baked from {metrics.tileCount} tiles)</span>
              <span>objects: {metrics.objectCount}</span>
              <span className={metrics.fps >= 55 ? "text-green-400" : metrics.fps >= 30 ? "text-yellow-400" : "text-red-400"}>
                fps: {metrics.fps}
              </span>
              <span className={metrics.depthSortOk ? "text-green-400" : "text-red-400"}>
                depth sort: {metrics.depthSortOk ? "OK" : "FAILED"}
              </span>
            </>
          ) : (
            <span>measuring...</span>
          )}
        </div>
      )}
      {!showDebug && (
        <button
          type="button"
          onClick={() => setShowDebug(true)}
          className="absolute top-9 right-3 z-10 bg-black/60 text-white/70 text-[11px] px-2.5 py-1.5 rounded-lg"
        >
          Press D for debug metrics
        </button>
      )}
      <div className="flex-1 min-h-0">
        <IsometricGridPoc onMetrics={onMetrics} />
      </div>
    </div>
  );
}

"use client";

import { useCallback, useState } from "react";
import { DomWorldPoc } from "./DomWorldPoc";
import { PixiWorldPoc } from "./PixiWorldPoc";
import { OBJECT_COUNT, GRID_SIZE } from "./testScene";

type Mode = "dom" | "pixi";

interface Metrics {
  mountedNodes: number;
  mountMs: number;
  drawCalls?: number;
}

// Internal rendering-technology proof of concept -- NOT part of the real Kingdom Scrolls feature,
// not linked from any navigation, not wired to real data. Exists to produce measured evidence
// (DOM node count, mount time, interaction behavior, accessibility-tree presence) comparing a
// pure-DOM/CSS world against a PixiJS/Canvas world at the same test scene, per the approved plan's
// pending rendering-architecture decision.
export function RenderPocHarness() {
  const [mode, setMode] = useState<Mode>("dom");
  const [domMetrics, setDomMetrics] = useState<Metrics | null>(null);
  const [pixiMetrics, setPixiMetrics] = useState<Metrics | null>(null);
  const [remountKey, setRemountKey] = useState(0);

  const handleDomMetrics = useCallback((m: Metrics) => setDomMetrics(m), []);
  const handlePixiMetrics = useCallback((m: Metrics) => setPixiMetrics(m), []);

  return (
    <div className="min-h-screen bg-[#04060c] text-white p-4 flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-lg font-bold">Rendering POC — DOM vs PixiJS</h1>
        <span className="text-xs text-gray-400">
          {OBJECT_COUNT} objects on a {GRID_SIZE}×{GRID_SIZE} grid · identical seeded scene
        </span>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => {
              setMode("dom");
              setRemountKey((k) => k + 1);
            }}
            className={`px-3 py-1.5 rounded text-sm font-medium ${mode === "dom" ? "bg-blue-600" : "bg-gray-800"}`}
          >
            DOM / CSS
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("pixi");
              setRemountKey((k) => k + 1);
            }}
            className={`px-3 py-1.5 rounded text-sm font-medium ${mode === "pixi" ? "bg-amber-600" : "bg-gray-800"}`}
          >
            PixiJS / Canvas
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="bg-gray-900 rounded p-2">
          <p className="font-semibold text-blue-400 mb-1">DOM / CSS metrics</p>
          {domMetrics ? (
            <p>
              {domMetrics.mountedNodes} DOM nodes · mounted in {domMetrics.mountMs.toFixed(1)}ms
            </p>
          ) : (
            <p className="text-gray-500">Not run yet — switch to this mode.</p>
          )}
        </div>
        <div className="bg-gray-900 rounded p-2">
          <p className="font-semibold text-amber-400 mb-1">PixiJS / Canvas metrics</p>
          {pixiMetrics ? (
            <p>
              {pixiMetrics.mountedNodes} DOM node(s) under host · {pixiMetrics.drawCalls} draw objects · mounted in {pixiMetrics.mountMs.toFixed(1)}ms
            </p>
          ) : (
            <p className="text-gray-500">Not run yet — switch to this mode.</p>
          )}
        </div>
      </div>

      {/* Two-level wrapper, mirroring KingdomScrollsWorld.tsx's real structure exactly (caught by
          testing this harness live, not assumed): the OUTER div is the flex container that
          stretches its child; the INNER div is a plain block box that receives a definite used
          height from that stretch. DomWorldPoc/PixiWorldPoc's own `h-full` (height:100%) then
          resolves against that inner box. A flex item that sets height:100% on itself directly
          does NOT reliably get the same stretch resolution -- explicitly setting a percentage
          height defeats align-items:stretch's default auto-sizing path, which is exactly the bug
          the first version of this harness hit (0px-tall world, 900 buttons rendered but
          invisible). */}
      <div className="flex-1 min-h-[600px] flex border border-gray-700 rounded overflow-hidden">
        <div className="relative flex-1 min-w-0">
          {mode === "dom" ? <DomWorldPoc key={`dom-${remountKey}`} onMetrics={handleDomMetrics} /> : <PixiWorldPoc key={`pixi-${remountKey}`} onMetrics={handlePixiMetrics} />}
        </div>
      </div>
    </div>
  );
}

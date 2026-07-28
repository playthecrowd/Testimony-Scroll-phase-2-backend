"use client";

import { useState } from "react";
import Image from "next/image";
import { BookOpen, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CameraTarget,
  UPPER_KINGDOM_LOCATIONS,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  UPPER_KINGDOM_Y_RANGE,
  EARTH_LANDS_Y_RANGE,
} from "@/lib/kingdomScrollsWorld";
import { backgrounds } from "@/data/backgrounds";
import { LocationPopup } from "./LocationPopup";

interface PlotMarker {
  x: number;
  y: number;
  label: string;
}

export function MapViewport({
  camera,
  isFlying,
  churchName,
  plot,
  currentLessonTitle,
  currentLessonHref,
  reducedMotion,
  onSelectLesson,
  viewportProps,
}: {
  camera: CameraTarget;
  isFlying: boolean;
  churchName: string | null;
  plot: PlotMarker | null;
  currentLessonTitle: string | null;
  currentLessonHref: string | null;
  reducedMotion: boolean;
  onSelectLesson: () => void;
  // Spread directly onto the outer viewport div -- keeps all pointer/wheel/keyboard wiring owned
  // by the parent's useWorldCamera hook instead of duplicating event plumbing here.
  viewportProps: React.ComponentPropsWithRef<"div">;
}) {
  const transitionClass = isFlying && !reducedMotion ? "transition-transform duration-[650ms] ease-out" : "";
  const [selectedLocationKey, setSelectedLocationKey] = useState<string | null>(null);
  const selectedLocation = UPPER_KINGDOM_LOCATIONS.find((l) => l.key === selectedLocationKey) ?? null;

  return (
    <div
      {...viewportProps}
      className={cn("relative w-full h-full overflow-hidden touch-none select-none cursor-grab active:cursor-grabbing bg-[#04060c] ks-theme", viewportProps.className)}
    >
      <div className="absolute left-1/2 top-1/2">
        <div
          className={cn("absolute", transitionClass)}
          style={{
            width: WORLD_WIDTH,
            height: WORLD_HEIGHT,
            transformOrigin: "0 0",
            transform: `scale(${camera.scale}) translate(${-camera.x}px, ${-camera.y}px)`,
          }}
        >
          {/* Upper Kingdom art -- background hero plus a depth-separated foreground archway/
              railing layer. The foreground went through one rejected generation pass (green-spill
              fringe, opaque archway interiors defeating the depth effect) before this corrected
              pass; verified via sharp raw-alpha pixel sampling (archway interiors now alpha=0,
              zero green-spill pixels in a full scan) before being wired in here. */}
          <div
            className="absolute"
            style={{ left: 0, top: UPPER_KINGDOM_Y_RANGE.start, width: WORLD_WIDTH, height: UPPER_KINGDOM_Y_RANGE.end - UPPER_KINGDOM_Y_RANGE.start }}
          >
            <Image src={backgrounds.homeDashboardHero} alt="" fill sizes="100vw" className="object-cover" priority />
          </div>
          <div
            className="absolute pointer-events-none"
            style={{ left: 0, bottom: 0, width: WORLD_WIDTH, height: 900 }}
          >
            <Image src={backgrounds.kingdomScrollsUpperForeground} alt="" fill sizes="100vw" className="object-cover object-bottom" />
          </div>

          {/* Cloud Passage -- tiled cloud art (drifting slowly, disabled under reduced motion via
              .ks-cloud-drift's rule in theme.css) layered under the gradient blend and the
              two-part gateway beam (bright core + soft bloom), anchored at the Kingdom Hub's spire
              position rather than the world center, per the approved plan's "anchored to a
              specific spire" correction. */}
          <div
            className="absolute inset-x-0 pointer-events-none overflow-hidden"
            style={{ top: UPPER_KINGDOM_Y_RANGE.end - 250, height: 700 }}
          >
            <div
              className="absolute inset-x-0 bottom-0 h-full opacity-80 ks-cloud-drift"
              style={{
                backgroundImage: `url(${backgrounds.kingdomScrollsCloudLayer})`,
                backgroundRepeat: "repeat-x",
                backgroundSize: "1680px 420px",
                backgroundPosition: "bottom left",
              }}
            />
            <div className="w-full h-full bg-gradient-to-b from-transparent via-[#0a1428]/70 to-[#0a1428]" />
            <div
              className="absolute top-0 bottom-0 w-40 -translate-x-1/2 bg-gradient-to-b from-[#f0d68a]/0 via-[#d4a53d]/45 to-[#d4a53d]/0 blur-3xl ks-beam-pulse"
              style={{ left: WORLD_WIDTH / 2 }}
            />
            <div
              className="absolute top-0 bottom-0 w-2 -translate-x-1/2 bg-gradient-to-b from-[#fff6df]/0 via-[#fff6df]/90 to-[#fff6df]/0 ks-beam-pulse"
              style={{ left: WORLD_WIDTH / 2 }}
            />
          </div>

          {/* Earth Lands / Church Land art */}
          <div
            className="absolute bg-[#0a1428]"
            style={{ left: 0, top: EARTH_LANDS_Y_RANGE.start - 300, width: WORLD_WIDTH, height: EARTH_LANDS_Y_RANGE.end - EARTH_LANDS_Y_RANGE.start + 300 }}
          >
            <Image src={backgrounds.kingdomScrollsEarthLands} alt="" fill sizes="100vw" className="object-cover opacity-90" />
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a1428]/60 via-transparent to-[#04060c]/70" />
          </div>

          {/* Upper Kingdom location markers -- each a real, focusable button (closes the "inert
              markers" gap from the approved plan's §2), opening a popup with a real destination
              link where one exists. */}
          {UPPER_KINGDOM_LOCATIONS.map((loc) => (
            <button
              key={loc.key}
              type="button"
              onClick={() => setSelectedLocationKey((cur) => (cur === loc.key ? null : loc.key))}
              aria-label={loc.label}
              aria-expanded={selectedLocationKey === loc.key}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 focus-ring rounded-lg p-1 group"
              style={{ left: loc.x, top: loc.y }}
            >
              <div
                className="w-3.5 h-3.5 rounded-full transition-transform group-hover:scale-125"
                style={{ background: "var(--ks-gold, #d4a53d)", boxShadow: "0 0 12px 4px rgba(212,165,61,0.5)" }}
              />
              <span className="ks-pill text-[11px] font-semibold px-2 py-0.5">{loc.label}</span>
            </button>
          ))}

          {selectedLocation && (
            <LocationPopup
              location={selectedLocation}
              screenX={selectedLocation.x}
              screenY={selectedLocation.y}
              onClose={() => setSelectedLocationKey(null)}
            />
          )}

          {/* Church Land label */}
          {churchName && (
            <div
              className="absolute -translate-x-1/2 flex flex-col items-center gap-1 pointer-events-none"
              style={{ left: WORLD_WIDTH / 2, top: EARTH_LANDS_Y_RANGE.start + 60 }}
            >
              <span className="ks-pill text-sm font-bold px-3 py-1">{churchName}</span>
            </div>
          )}

          {/* Today's lesson marker -- the ONLY real, clickable mission node backed by real data in
              Checkpoint 1 (everything else here is presentational until relics/missions exist --
              see the completion report's deferred-phases list). Links straight to the existing
              lesson route. */}
          {currentLessonTitle && currentLessonHref && (
            <button
              type="button"
              onClick={onSelectLesson}
              className="absolute -translate-x-1/2 -translate-y-full flex flex-col items-center gap-1 focus-ring rounded-lg p-1"
              style={{ left: WORLD_WIDTH / 2, top: EARTH_LANDS_Y_RANGE.start + 160 }}
              aria-label={`Open today's lesson: ${currentLessonTitle}`}
            >
              <span className="w-9 h-9 rounded-full bg-accent-blue border-2 border-accent-blue-light flex items-center justify-center text-white qk-glow-blue">
                <BookOpen size={16} />
              </span>
              <span className="ks-pill text-[11px] font-semibold px-2 py-0.5 max-w-[180px] truncate">{currentLessonTitle}</span>
            </button>
          )}

          {/* My Plot marker -- deterministic presentational position (lib/kingdomScrollsWorld.ts),
              not yet backed by a persisted plot-coordinate table. */}
          {plot && (
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 pointer-events-none"
              style={{ left: plot.x, top: plot.y }}
            >
              <span className="w-8 h-8 rounded-full bg-accent-gold/90 border-2 border-white/80 flex items-center justify-center text-[#04060c] qk-glow-gold">
                <MapPin size={14} />
              </span>
              <span className="ks-pill text-[11px] font-semibold px-2 py-0.5">{plot.label}</span>
            </div>
          )}
        </div>
      </div>

      {/* Ornate bronze frame around the whole viewport -- CSS-drawn, not a raster asset. */}
      <div className="ks-viewport-frame" />
    </div>
  );
}

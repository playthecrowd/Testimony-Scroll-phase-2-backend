"use client";

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

  return (
    <div
      {...viewportProps}
      className={cn("relative w-full h-full overflow-hidden touch-none select-none cursor-grab active:cursor-grabbing bg-[#04060c]", viewportProps.className)}
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
          {/* Upper Kingdom art -- reuses the existing homepage/dashboard hero (a floating
              bronze-and-gold city above clouds), matching Section 4's visual direction with no new
              asset needed for this band. */}
          <div
            className="absolute"
            style={{ left: 0, top: UPPER_KINGDOM_Y_RANGE.start, width: WORLD_WIDTH, height: UPPER_KINGDOM_Y_RANGE.end - UPPER_KINGDOM_Y_RANGE.start }}
          >
            <Image src={backgrounds.homeDashboardHero} alt="" fill sizes="100vw" className="object-cover" priority />
          </div>

          {/* Cloud Passage -- a soft gradient blend plus a glowing vertical beam, connecting the
              two art bands per Section 5 ("A golden beam or gateway connects the layers"). */}
          <div
            className="absolute inset-x-0 pointer-events-none"
            style={{ top: UPPER_KINGDOM_Y_RANGE.end - 250, height: 700 }}
          >
            <div className="w-full h-full bg-gradient-to-b from-transparent via-[#0a1428]/70 to-[#0a1428]" />
            <div
              className="absolute top-0 bottom-0 w-24 -translate-x-1/2 bg-gradient-to-b from-accent-gold/0 via-accent-gold/50 to-accent-gold/0 blur-2xl"
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

          {/* Upper Kingdom location markers */}
          {UPPER_KINGDOM_LOCATIONS.map((loc) => (
            <div
              key={loc.key}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 pointer-events-none"
              style={{ left: loc.x, top: loc.y }}
            >
              <div className="w-3 h-3 rounded-full bg-accent-gold shadow-[0_0_12px_4px_rgba(212,175,55,0.5)]" />
              <span className="text-[11px] font-semibold text-accent-gold bg-[#04060c]/70 px-2 py-0.5 rounded-full whitespace-nowrap">
                {loc.label}
              </span>
            </div>
          ))}

          {/* Church Land label */}
          {churchName && (
            <div
              className="absolute -translate-x-1/2 flex flex-col items-center gap-1 pointer-events-none"
              style={{ left: WORLD_WIDTH / 2, top: EARTH_LANDS_Y_RANGE.start + 60 }}
            >
              <span className="text-sm font-bold text-foreground bg-[#04060c]/70 px-3 py-1 rounded-full whitespace-nowrap border border-accent-blue-light/40">
                {churchName}
              </span>
            </div>
          )}

          {/* Today's lesson marker -- the ONLY real, clickable mission node in Phase 1 (everything
              else here is presentational until relics/missions exist -- see the completion
              report's deferred-phases list). Links straight to the existing lesson route. */}
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
              <span className="text-[11px] font-semibold text-foreground bg-[#04060c]/80 px-2 py-0.5 rounded-full whitespace-nowrap max-w-[180px] truncate">
                {currentLessonTitle}
              </span>
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
              <span className="text-[11px] font-semibold text-accent-gold bg-[#04060c]/80 px-2 py-0.5 rounded-full whitespace-nowrap">
                {plot.label}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

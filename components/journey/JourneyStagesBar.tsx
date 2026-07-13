import { stages } from "./stageMeta";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function JourneyStagesBar({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex flex-nowrap items-start gap-1.5 md:gap-2 min-w-max">
      {stages.map((stage, i) => {
        const Icon = stage.icon;
        return (
          <div key={stage.key} className="flex items-start gap-1.5 md:gap-2 shrink-0">
            <div className="flex items-start gap-2 md:gap-2.5 w-[128px] sm:w-[150px] md:w-[168px] shrink-0">
              <div className="w-8 h-8 md:w-9 md:h-9 shrink-0 rounded-full bg-accent-blue/15 border border-accent-blue/40 flex items-center justify-center text-accent-blue-light">
                <Icon size={15} />
              </div>
              {!compact && (
                <div className="min-w-0">
                  <p className="text-xs md:text-sm font-semibold text-foreground leading-tight">
                    <span className="text-muted mr-1">{i + 1}</span>
                    {stage.label}
                  </p>
                  <p className="text-[10px] md:text-[11px] text-muted leading-snug mt-0.5 line-clamp-2">{stage.description}</p>
                </div>
              )}
            </div>
            {i < stages.length - 1 && (
              <ChevronRight size={14} className={cn("mt-2 md:mt-2.5 text-muted shrink-0", compact && "mt-2")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

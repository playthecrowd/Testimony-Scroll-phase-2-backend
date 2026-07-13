import Link from "next/link";
import { CheckCircle2, Lock } from "lucide-react";
import { JourneyStage } from "@/types";
import { stages, stageStatus } from "./stageMeta";
import { cn } from "@/lib/utils";

export function JourneyStepper({
  lessonId,
  currentStage,
  linkBase,
}: {
  lessonId: string;
  currentStage: JourneyStage;
  linkBase?: (stage: string) => string;
}) {
  return (
    <div className="qk-card p-3 md:p-4 flex flex-wrap items-center gap-2 md:gap-0 md:justify-between">
      {stages.map((stage, i) => {
        const status = stageStatus(currentStage, stage.key);
        const Icon = stage.icon;
        const href = linkBase ? linkBase(stage.key) : `/journey/${lessonId}/${stage.key}`;
        const clickable = status !== "locked";
        const content = (
          <div
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors",
              status === "completed" && "border-accent-blue/40 bg-accent-blue/10 text-accent-blue-light",
              status === "in-progress" && "border-accent-blue-light bg-accent-blue/15 text-white qk-glow-blue",
              status === "available" && "border-border-subtle text-foreground hover:border-accent-blue-light/60",
              status === "locked" && "border-border-subtle text-muted cursor-not-allowed opacity-60"
            )}
          >
            {status === "completed" ? (
              <CheckCircle2 size={16} className="text-accent-blue-light" />
            ) : status === "locked" ? (
              <Lock size={14} />
            ) : (
              <Icon size={16} />
            )}
            <span>{stage.label}</span>
          </div>
        );
        return (
          <div key={stage.key} className="flex items-center gap-2">
            {clickable ? <Link href={href}>{content}</Link> : content}
            {i < stages.length - 1 && <span className="hidden md:block w-6 h-px bg-border-subtle mx-1" />}
          </div>
        );
      })}
    </div>
  );
}

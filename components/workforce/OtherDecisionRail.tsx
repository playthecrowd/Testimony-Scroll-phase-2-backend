import Link from "next/link";
import { WorkforceDecision } from "@/types";
import { CompactDecisionCard } from "./CompactDecisionCard";

export function OtherDecisionRail({ decisions, churchId, totalCount }: { decisions: WorkforceDecision[]; churchId: string; totalCount: number }) {
  return (
    <aside className="w-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground">Other Decisions</h2>
        <Link href={`/workforce/decisions?org=${churchId}`} className="text-xs text-accent-blue hover:underline">
          View all {totalCount}
        </Link>
      </div>
      {decisions.length === 0 ? (
        <p className="text-xs text-muted">No other decisions yet.</p>
      ) : (
        // Below xl (where this rail isn't a persistent side column yet) it scrolls horizontally
        // as a carousel, contained to its own row so the page body never scrolls sideways. At xl+
        // it reverts to the vertical stacked rail.
        <div className="flex xl:block gap-3 xl:space-y-3 overflow-x-auto xl:overflow-x-visible xl:max-h-[720px] xl:overflow-y-auto qk-scrollbar pb-2 xl:pb-0 -mx-1 px-1 xl:mx-0 xl:px-0">
          {decisions.map((d) => (
            <div key={d.id} className="w-64 shrink-0 xl:w-auto">
              <CompactDecisionCard decision={d} />
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}

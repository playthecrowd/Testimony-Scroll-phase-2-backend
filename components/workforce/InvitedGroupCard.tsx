import { WorkforceAvatar } from "./WorkforceAvatar";

// A stacked-avatar cluster for one group of current participants. Real participant names only --
// no fabricated department rosters.
export function InvitedGroupCard({ label, names }: { label: string; names: string[] }) {
  return (
    <div className="qk-card rounded-xl p-3 flex flex-col items-center gap-2 text-center">
      <div className="flex -space-x-2">
        {names.slice(0, 3).map((name, i) => (
          <WorkforceAvatar key={i} name={name} size="sm" className="ring-2 ring-surface" />
        ))}
      </div>
      <span className="text-xs font-medium text-foreground leading-tight">{label}</span>
    </div>
  );
}

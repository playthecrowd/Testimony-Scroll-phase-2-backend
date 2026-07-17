import { Sparkles, type LucideIcon } from "lucide-react";
import { LinkButton } from "@/components/ui/Button";

// Generic "not built yet, but never a 404" placeholder -- same visual language as
// components/journey/StageComingSoon.tsx (kept separate rather than shared, since that
// component is explicitly protected by docs/REGRESSION_CHECKLIST.md and shouldn't be touched
// for a change unrelated to the journey stages).
export function ComingSoon({
  title,
  description,
  backHref,
  backLabel,
  icon: Icon = Sparkles,
}: {
  title: string;
  description: string;
  backHref: string;
  backLabel: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="max-w-lg mx-auto py-24 text-center px-4">
      <div className="w-14 h-14 rounded-full bg-accent-purple/15 border border-accent-purple/40 flex items-center justify-center mx-auto mb-5">
        <Icon size={26} className="text-accent-purple" />
      </div>
      <h1 className="text-xl font-bold text-foreground mb-2">{title}</h1>
      <p className="text-muted text-sm mb-6">{description}</p>
      <LinkButton href={backHref}>{backLabel}</LinkButton>
    </div>
  );
}

import { Sparkles } from "lucide-react";
import { LinkButton } from "@/components/ui/Button";

// Shown instead of a 404 whenever a journey link points at a stage whose page isn't built on real
// Supabase lesson data yet (Experienced/Applied/Added-to-Story/Captured currently still run on
// mock lesson data only, and don't recognize a real lesson id). Every /journey/ link must resolve
// to something branded, never a bare "This page could not be found."
export function StageComingSoon({ stageLabel }: { stageLabel: string }) {
  return (
    <div className="max-w-lg mx-auto py-24 text-center px-4">
      <div className="w-14 h-14 rounded-full bg-accent-purple/15 border border-accent-purple/40 flex items-center justify-center mx-auto mb-5">
        <Sparkles size={26} className="text-accent-purple" />
      </div>
      <h1 className="text-xl font-bold text-foreground mb-2">{stageLabel} is coming soon</h1>
      <p className="text-muted text-sm mb-6">
        This part of your journey isn&apos;t connected yet. Your progress is saved, and we&apos;ll let you know as soon as
        it&apos;s ready.
      </p>
      <LinkButton href="/my-journey">Back to My Journey</LinkButton>
    </div>
  );
}

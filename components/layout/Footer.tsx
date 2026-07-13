import { Globe2, Users, Crown, Sparkles } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border-subtle bg-surface/60 mt-auto">
      <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-4 flex flex-wrap items-center justify-center md:justify-between gap-4 text-sm text-muted">
        <div className="flex items-center gap-2">
          <Globe2 size={16} className="text-accent-blue-light" />
          <span className="text-foreground font-semibold">2,450+</span> Churches Participating
        </div>
        <div className="flex items-center gap-2">
          <Users size={16} className="text-accent-blue-light" />
          <span className="text-foreground font-semibold">185,000+</span> Members On the Journey
        </div>
        <div className="flex items-center gap-2">
          <Crown size={16} className="text-accent-gold" />
          <span className="text-foreground font-semibold">98,004+</span> Stories Added to the Scroll
        </div>
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-accent-purple" />
          One Kingdom. One Mission.
        </div>
      </div>
    </footer>
  );
}

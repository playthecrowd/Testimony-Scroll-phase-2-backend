import Link from "next/link";
import { ScrollText, BookMarked, ArrowRight } from "lucide-react";

export function FeaturedScrollStrip() {
  return (
    <div className="rounded-2xl border border-accent-blue/40 bg-gradient-to-r from-accent-blue/15 via-accent-purple/10 to-transparent px-5 py-5 md:px-7 md:py-6 flex flex-col md:flex-row md:items-center gap-4 md:gap-6 qk-glow-blue">
      <div className="w-11 h-11 rounded-full bg-accent-blue/20 border border-accent-blue/50 flex items-center justify-center text-accent-blue-light shrink-0">
        <ScrollText size={20} />
      </div>
      <div className="flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-accent-blue-light mb-0.5">Featured</p>
        <h2 className="text-lg md:text-xl font-bold text-foreground">Read real stories in the Kingdom Scroll</h2>
        <p className="text-sm text-muted mt-0.5">Every testimony here is real, approved, and becoming part of one connected Kingdom story.</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-2.5 shrink-0">
        <Link
          href="/kingdom-scroll"
          className="inline-flex items-center justify-center gap-1.5 bg-accent-blue hover:bg-accent-blue-light text-white text-sm font-semibold px-5 py-2.5 rounded-lg"
        >
          <ScrollText size={15} /> Kingdom Scroll <ArrowRight size={14} />
        </Link>
        <Link
          href="/story"
          className="inline-flex items-center justify-center gap-1.5 bg-transparent border border-accent-blue-light/60 hover:bg-white/5 text-foreground text-sm font-semibold px-5 py-2.5 rounded-lg"
        >
          <BookMarked size={15} /> Full Story
        </Link>
      </div>
    </div>
  );
}

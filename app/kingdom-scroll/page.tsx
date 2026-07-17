import Link from "next/link";
import { ArrowRight, BookMarked } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { ErrorState } from "@/components/ui/AsyncState";
import { LinkButton } from "@/components/ui/Button";
import { PageBackground } from "@/components/layout/PageBackground";
import { backgrounds } from "@/data/backgrounds";
import { getApprovedPublicTestimonies } from "@/services/supabase/testimonies";
import { KingdomScrollList } from "./KingdomScrollList";

export const dynamic = "force-dynamic";

// Real, Supabase-backed as of Phase 6 (docs/PHASE6_AUDIT.md) -- previously read from
// data/testimonies.ts (mock), including an automatic mock character/story generation on approval
// that the real workflow deliberately does not carry over (production admin controls any real
// character/story relationship, entirely outside this table -- see Phase 7).
export default async function KingdomScrollPage() {
  const supabase = await createClient();

  let testimonies: Awaited<ReturnType<typeof getApprovedPublicTestimonies>> = [];
  let loadError = "";
  try {
    testimonies = await getApprovedPublicTestimonies(supabase);
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      return (
        <div className="max-w-lg mx-auto px-4 py-24">
          <ErrorState message={err.message} />
        </div>
      );
    }
    console.error("[KingdomScrollPage] Failed to load approved testimonies:", err);
    loadError = "We couldn't load the Kingdom Scroll right now. Please try again shortly.";
  }

  return (
    <div className="relative max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <PageBackground src={backgrounds.trailerScreen} opacity={0.4} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">Kingdom Scroll</h1>
          <p className="text-muted text-sm mt-1">Real stories. Real people. Real faith in action.</p>
        </div>
        <div className="flex gap-2">
          <LinkButton href="/kingdom-scroll/my-testimonies" variant="secondary" size="sm">
            My Testimonies
          </LinkButton>
          <LinkButton href="/kingdom-scroll/submit" size="sm">
            Submit a Testimony
          </LinkButton>
        </div>
      </div>

      <Link
        href="/story"
        className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 rounded-2xl border border-accent-blue/40 bg-gradient-to-r from-accent-blue/15 via-accent-purple/10 to-transparent px-5 py-4 qk-glow-blue group"
      >
        <div className="w-10 h-10 rounded-full bg-accent-blue/20 border border-accent-blue/50 flex items-center justify-center text-accent-blue-light shrink-0">
          <BookMarked size={18} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">See how every testimony connects into one story</p>
          <p className="text-xs text-muted">Read the Full Kingdom Story — episodes, characters, and timelines built from this Scroll.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent-blue-light shrink-0">
          Read the Full Story <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
        </span>
      </Link>

      <div className="mt-6">
        {loadError ? <ErrorState message={loadError} /> : <KingdomScrollList testimonies={testimonies} />}
      </div>
    </div>
  );
}

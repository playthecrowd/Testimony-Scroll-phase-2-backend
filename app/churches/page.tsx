import Link from "next/link";
import { Church, Users2, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPublishedChurches } from "@/services/supabase/churches";
import { getPublishedLessonsByChurch } from "@/services/supabase/lessons";
import { PageBackground } from "@/components/layout/PageBackground";
import { backgrounds } from "@/data/backgrounds";
import { ErrorState, EmptyState } from "@/components/ui/AsyncState";
import { SupabaseConfigError } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default async function ChurchesPage() {
  let churches: Awaited<ReturnType<typeof getPublishedChurches>> = [];
  let lessonCounts: Awaited<ReturnType<typeof getPublishedLessonsByChurch>>[] = [];
  let loadError = "";

  try {
    const supabase = await createClient();
    churches = await getPublishedChurches(supabase);
    lessonCounts = await Promise.all(churches.map((c) => getPublishedLessonsByChurch(supabase, c.id)));
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      return (
        <div className="max-w-lg mx-auto px-4 py-24">
          <ErrorState message={err.message} />
        </div>
      );
    }
    // A failed public query (e.g. a column mismatch between code and the connected database)
    // must not crash the whole route. Log full detail server-side only -- never show raw
    // database/query internals to visitors.
    console.error("[ChurchesPage] Failed to load churches:", err);
    loadError = "We couldn't load churches right now. Please try again shortly.";
  }

  return (
    <div className="relative max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <PageBackground src={backgrounds.ticketedExperiences} opacity={0.35} />
      <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
        <Church size={26} className="text-accent-blue-light" /> Churches
      </h1>
      <p className="text-muted text-sm mt-1 mb-6">Explore churches participating in Quest for the Kingdom.</p>

      {loadError ? (
        <ErrorState message={loadError} />
      ) : churches.length === 0 ? (
        <EmptyState message="No churches have published yet." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {churches.map((c, i) => (
            <Link key={c.id} href={`/churches/${c.slug}`} className="qk-card p-4 hover:border-accent-blue-light/50 transition-colors">
              <div className="flex items-center gap-3 mb-3">
                {c.logoUrl && <img src={c.logoUrl} className="w-12 h-12 rounded-xl" alt="" />}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate flex items-center gap-1">
                    {c.name} {c.verified && <CheckCircle2 size={13} className="text-accent-blue-light shrink-0" />}
                  </p>
                  <p className="text-xs text-muted">{[c.city, c.region].filter(Boolean).join(", ")}</p>
                </div>
              </div>
              {c.description && <p className="text-xs text-muted line-clamp-2 mb-3">{c.description}</p>}
              <div className="flex items-center justify-between text-xs text-muted pt-2 border-t border-border-subtle">
                <span className="flex items-center gap-1">
                  <Users2 size={12} /> {c.memberCount.toLocaleString()} members
                </span>
                <span>{lessonCounts[i].length} lessons</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { ErrorState } from "@/components/ui/AsyncState";
import { LinkButton } from "@/components/ui/Button";
import { getMyTestimonies } from "@/services/supabase/testimonies";
import { formatDate } from "@/lib/utils";
import { TestimonyChurchStatus, TestimonyPlatformStatus } from "@/types";

export const dynamic = "force-dynamic";

const CHURCH_STATUS_STYLES: Record<TestimonyChurchStatus, string> = {
  pending: "bg-accent-gold/15 text-accent-gold",
  approved: "bg-accent-blue/15 text-accent-blue-light",
  rejected: "bg-red-500/10 text-red-300",
};

const PLATFORM_STATUS_STYLES: Record<TestimonyPlatformStatus, string> = {
  not_submitted: "bg-surface-2 text-muted",
  pending: "bg-accent-gold/15 text-accent-gold",
  approved: "bg-accent-purple/15 text-accent-purple",
  rejected: "bg-red-500/10 text-red-300",
};

export default async function MyTestimoniesPage() {
  const supabase = await createClient();

  let userId: string | null = null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      return (
        <div className="max-w-lg mx-auto px-4 py-24">
          <ErrorState message={err.message} />
        </div>
      );
    }
    throw err;
  }

  if (!userId) {
    return (
      <div className="max-w-lg mx-auto py-24 text-center px-4">
        <p className="text-foreground font-semibold mb-2">Sign in to see your testimonies.</p>
        <LinkButton href="/login">Sign In</LinkButton>
      </div>
    );
  }

  let testimonies: Awaited<ReturnType<typeof getMyTestimonies>> = [];
  let loadError = "";
  try {
    testimonies = await getMyTestimonies(supabase);
  } catch (err) {
    console.error("[MyTestimoniesPage] Failed to load testimonies:", err);
    loadError = "We couldn't load your testimonies right now. Please try again shortly.";
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Your Testimonies</h1>
        <LinkButton href="/kingdom-scroll/submit" size="sm">
          Submit a Testimony
        </LinkButton>
      </div>
      <p className="text-muted text-sm mb-6">Church review, then Quest for the Kingdom review for public submissions.</p>

      {loadError ? (
        <ErrorState message={loadError} />
      ) : testimonies.length === 0 ? (
        <div className="qk-card p-10 text-center text-muted text-sm">You haven&apos;t submitted a testimony yet.</div>
      ) : (
        <div className="space-y-2.5">
          {testimonies.map((t) => (
            <div key={t.id} className="qk-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{t.title}</p>
                  <p className="text-[11px] text-muted mt-0.5">
                    {t.churchName || "Your church"} · {formatDate(t.createdAt)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${CHURCH_STATUS_STYLES[t.churchStatus]}`}>
                    Church: {t.churchStatus}
                  </span>
                  {t.visibility === "public" && (
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${PLATFORM_STATUS_STYLES[t.platformStatus]}`}>
                      Platform: {t.platformStatus.replace("_", " ")}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

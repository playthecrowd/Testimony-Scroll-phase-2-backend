import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { ErrorState } from "@/components/ui/AsyncState";
import { LinkButton } from "@/components/ui/Button";
import { getApprovedPublicLessonRequests } from "@/services/supabase/lessonRequests";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Public (Part 13 #6-7): approved platform-wide lesson requests. Church-directed requests never
// appear here -- only requests submitted with scope='public' and approved by a production
// administrator (app/admin/lesson-requests). No requester identity is ever shown, matching
// Part 13's "protect member privacy on public requests."
export default async function PublicLessonRequestsPage() {
  const supabase = await createClient();

  let requests: Awaited<ReturnType<typeof getApprovedPublicLessonRequests>> = [];
  let loadError = "";
  try {
    requests = await getApprovedPublicLessonRequests(supabase);
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      return (
        <div className="max-w-lg mx-auto px-4 py-24">
          <ErrorState message={err.message} />
        </div>
      );
    }
    console.error("[PublicLessonRequestsPage] Failed to load approved lesson requests:", err);
    loadError = "We couldn't load lesson requests right now. Please try again shortly.";
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Lesson Requests</h1>
        <LinkButton href="/request-lesson" size="sm">
          Request a Lesson
        </LinkButton>
      </div>
      <p className="text-muted text-sm mb-6">Topics the Quest for the Kingdom community has asked to see taught.</p>

      {loadError ? (
        <ErrorState message={loadError} />
      ) : requests.length === 0 ? (
        <div className="qk-card p-10 text-center text-muted text-sm">No approved lesson requests yet.</div>
      ) : (
        <div className="space-y-2.5">
          {requests.map((r) => (
            <div key={r.id} className="qk-card p-4">
              <p className="text-sm font-medium text-foreground">{r.topic}</p>
              {r.notes && <p className="text-xs text-muted mt-1">{r.notes}</p>}
              <p className="text-[11px] text-muted mt-2">Approved {formatDate(r.updatedAt)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Feather, Clock, FlaskConical } from "lucide-react";
import { getAllTestimonies, approveTestimony } from "@/services/testimonyService";
import { generateCharacterAndStory } from "@/services/storyService";
import { getLesson } from "@/services/lessonService";
import { SectionCard } from "@/components/ui/StatPill";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/utils";
import { Testimony } from "@/types";

// Kingdom Scroll testimonies have no Supabase table yet (Phase 6) -- this card is an explicit
// preview of the review workflow running on the Phase-One mock/localStorage testimony catalog,
// not real per-church data. It intentionally is NOT scoped to the current church (there is no
// church_id on the mock Testimony type to scope by), so its count must never be shown as one of
// the Host Dashboard's real stats -- see app/host-dashboard/page.tsx.
export function TestimonyReviewPreview() {
  const [pending, setPending] = useState<Testimony[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setPending(getAllTestimonies().filter((t) => t.status === "awaiting-review"));
  }, [tick]);

  function approve(id: string) {
    const t = approveTestimony(id);
    if (t) generateCharacterAndStory(t);
    setTick((v) => v + 1);
  }

  return (
    <SectionCard title="Testimony Review (Preview)" icon={Feather}>
      <p className="text-xs text-muted mb-3">
        Preview of the review workflow using sample data. Real, per-church testimony review is coming in a later
        phase.
      </p>
      <div className="space-y-3">
        {pending.map((t) => {
          const lesson = getLesson(t.primaryLessonId);
          return (
            <div key={t.id} className="qk-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{t.title}</p>
                  <p className="text-xs text-muted truncate">
                    {lesson?.title} · {formatDate(t.submittedAt)}
                  </p>
                </div>
                <span className="shrink-0 text-[10px] bg-accent-gold/15 text-accent-gold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Clock size={10} /> Pending
                </span>
              </div>
              <p className="text-xs text-muted mt-2 line-clamp-2">{t.writtenTestimony}</p>
              <Button size="sm" variant="secondary" className="mt-2.5" onClick={() => approve(t.id)}>
                <FlaskConical size={13} /> Dev: Approve Testimony
              </Button>
            </div>
          );
        })}
        {pending.length === 0 && <p className="text-sm text-muted">No sample testimonies awaiting review.</p>}
      </div>
    </SectionCard>
  );
}

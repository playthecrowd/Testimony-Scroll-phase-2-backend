"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PublishedTestimony } from "@/types";
import { updateTestimonyFeaturedAction } from "@/app/admin/testimonies/actions";

// Only approved (visibility='public' AND church_status='approved' AND platform_status='approved')
// testimonies are ever offered here -- a testimony must already be fully approved before it can
// be featured, same as how episodes/events only ever feature already-published rows.
export function ApprovedTestimoniesFeaturedList({ testimonies: initial }: { testimonies: PublishedTestimony[] }) {
  const [testimonies, setTestimonies] = useState(initial);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function toggleFeatured(id: string, featured: boolean) {
    setPendingId(id);
    setError("");
    const result = await updateTestimonyFeaturedAction(id, featured);
    setPendingId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setTestimonies((prev) => prev.map((t) => (t.id === id ? { ...t, featured } : t)));
  }

  if (testimonies.length === 0) {
    return <p className="text-sm text-muted">No approved public testimonies yet.</p>;
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>}
      {testimonies.map((t) => {
        const busy = pendingId === t.id;
        return (
          <div key={t.id} className="qk-card p-3 flex items-center justify-between gap-3">
            <p className="text-sm text-foreground truncate">{t.title}</p>
            <Button
              size="sm"
              variant={t.featured ? "secondary" : "ghost"}
              disabled={busy}
              onClick={() => toggleFeatured(t.id, !t.featured)}
            >
              <Star size={13} fill={t.featured ? "currentColor" : "none"} /> {t.featured ? "Featured" : "Feature"}
            </Button>
          </div>
        );
      })}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PublishedEpisodeStatus } from "@/types";
import { updateEpisodeStatusAction } from "@/app/admin/episodes/actions";

export function EpisodePublishToggle({ episodeId, status }: { episodeId: string; status: PublishedEpisodeStatus }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    setSubmitting(true);
    setError("");
    const nextStatus = status === "draft" ? "published" : "draft";
    const result = await updateEpisodeStatusAction(episodeId, nextStatus);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      {status === "draft" ? (
        <Button onClick={handleClick} disabled={submitting}>
          <Send size={16} /> {submitting ? "Publishing..." : "Publish Episode"}
        </Button>
      ) : (
        <Button variant="secondary" onClick={handleClick} disabled={submitting}>
          <EyeOff size={16} /> {submitting ? "Unpublishing..." : "Unpublish"}
        </Button>
      )}
      {error && <p className="text-xs text-red-300 mt-1.5">{error}</p>}
    </div>
  );
}

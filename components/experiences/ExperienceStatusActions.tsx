"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ChurchExperienceStatus } from "@/types";
import { updateExperienceStatusAction } from "@/app/host-dashboard/experiences/actions";

// Status-based archival only -- an archived Experience is never hard-deleted (spec SS20). This
// component only ever moves status forward/back through the three states; it never removes a row.
export function ExperienceStatusActions({ experienceId, status }: { experienceId: string; status: ChurchExperienceStatus }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleChange(next: ChurchExperienceStatus) {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    const result = await updateExperienceStatusAction(experienceId, next);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {status === "draft" && (
          <>
            <Button size="sm" onClick={() => handleChange("published")} disabled={submitting}>
              {submitting ? "Publishing..." : "Publish"}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => handleChange("archived")} disabled={submitting}>
              Archive
            </Button>
          </>
        )}
        {status === "published" && (
          <>
            <Button size="sm" variant="secondary" onClick={() => handleChange("draft")} disabled={submitting}>
              Unpublish to Draft
            </Button>
            <Button size="sm" variant="secondary" onClick={() => handleChange("archived")} disabled={submitting}>
              Archive
            </Button>
          </>
        )}
        {status === "archived" && (
          <Button size="sm" variant="secondary" onClick={() => handleChange("draft")} disabled={submitting}>
            {submitting ? "Restoring..." : "Restore to Draft"}
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-red-300 mt-2">{error}</p>}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Globe2, Building2 } from "lucide-react";
import { Field } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/utils";
import { LessonRequestStatusBadge } from "@/components/lessonRequests/LessonRequestStatusBadge";
import { PublishedChurch, LessonRequest, LessonRequestScope } from "@/types";
import { submitLessonRequestAction } from "./actions";

export function RequestLessonForm({ churches, myRequests }: { churches: PublishedChurch[]; myRequests: LessonRequest[] }) {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState("");
  const [scope, setScope] = useState<LessonRequestScope>("church");
  const [churchId, setChurchId] = useState(churches[0]?.id ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const result = await submitLessonRequestAction({
      topic,
      notes,
      scope,
      churchId: scope === "church" ? churchId : null,
    });
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setTopic("");
    setNotes("");
    setSubmitted(true);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="qk-card p-5 space-y-4">
        <Field label="Lesson Topic" required>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g., Hearing God's voice in a season of waiting"
            className="qk-input"
          />
        </Field>
        <Field label="Notes (optional)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Anything that helps explain what you're looking for."
            className="qk-input resize-none"
          />
        </Field>

        <div>
          <span className="block text-xs font-medium text-muted mb-1.5">Where should this request go?</span>
          <div className="grid sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setScope("church")}
              className={`qk-card p-3 text-left flex items-start gap-2.5 ${scope === "church" ? "border-accent-blue-light qk-glow-blue" : ""}`}
            >
              <Building2 size={16} className="text-accent-blue-light shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">A specific church</p>
                <p className="text-xs text-muted mt-0.5">Notifies that church&apos;s host directly.</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setScope("public")}
              className={`qk-card p-3 text-left flex items-start gap-2.5 ${scope === "public" ? "border-accent-blue-light qk-glow-blue" : ""}`}
            >
              <Globe2 size={16} className="text-accent-blue-light shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">The whole platform</p>
                <p className="text-xs text-muted mt-0.5">Reviewed by Quest for the Kingdom before appearing publicly.</p>
              </div>
            </button>
          </div>
        </div>

        {scope === "church" && (
          <Field label="Church" required>
            <select value={churchId} onChange={(e) => setChurchId(e.target.value)} className="qk-input">
              {churches.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        {error && <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>}
        {submitted && !error && <p className="text-sm text-accent-blue-light">Request submitted.</p>}

        <Button type="submit" disabled={submitting}>
          <Send size={16} /> {submitting ? "Submitting..." : "Submit Request"}
        </Button>
      </form>

      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">Your Requests</h2>
        {myRequests.length === 0 ? (
          <p className="text-sm text-muted">You haven&apos;t requested a lesson yet.</p>
        ) : (
          <div className="space-y-2">
            {myRequests.map((r) => (
              <div key={r.id} className="qk-card p-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{r.topic}</p>
                  <p className="text-[11px] text-muted">
                    {r.scope === "church" ? r.churchName || "A church" : "Platform-wide"} · {formatDate(r.createdAt)}
                  </p>
                </div>
                <LessonRequestStatusBadge status={r.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { Feather } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { getUserJourneys } from "@/services/journeyService";
import { getUserNotifications } from "@/services/notificationService";
import { getLesson } from "@/services/lessonService";
import { LinkButton } from "@/components/ui/Button";

export default function ContributePage() {
  const { session, ready } = useSession();
  const journeys = ready && session.isLoggedIn ? getUserJourneys(session.user.id) : [];

  if (!ready) return null;
  if (!session.isLoggedIn) {
    return (
      <div className="max-w-lg mx-auto py-24 text-center px-4">
        <p className="text-foreground font-semibold mb-2">Sign in to share your testimony.</p>
        <LinkButton href="/login">Sign In</LinkButton>
      </div>
    );
  }

  const invitations = getUserNotifications(session.user.id).filter((n) => n.type === "testimony-invitation");
  const eligible = journeys.filter((j) => j.stage === "experienced" || j.stage === "applied");

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-8 py-6 md:py-8">
      <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
        <Feather size={24} className="text-accent-blue-light" /> Become a Scroll Contributor
      </h1>
      <p className="text-muted text-sm mt-1 mb-6">
        Choose a completed lesson to share your testimony and add your voice to the Kingdom Scroll.
      </p>

      {invitations.length > 0 && (
        <div className="qk-card p-4 mb-6">
          <h3 className="text-sm font-semibold text-foreground mb-3">Testimony Invitations</h3>
          <div className="space-y-2">
            {invitations.map((n) => (
              <p key={n.id} className="text-sm text-muted">
                &ldquo;{n.message}&rdquo;
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {eligible.map((j) => {
          const lesson = getLesson(j.lessonId);
          if (!lesson) return null;
          return (
            <div key={j.id} className="qk-card p-4 flex items-center gap-3">
              <img src={lesson.featuredImageUrl} className="w-14 h-14 rounded-lg object-cover" alt="" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{lesson.title}</p>
                <p className="text-xs text-muted">{j.stage === "applied" ? "Testimony submitted" : "Ready to share your testimony"}</p>
              </div>
              <LinkButton href={`/journey/${lesson.id}/applied`} size="sm">
                {j.stage === "applied" ? "View Status" : "Share Testimony"}
              </LinkButton>
            </div>
          );
        })}
        {eligible.length === 0 && (
          <div className="qk-card p-10 text-center">
            <p className="text-sm text-muted mb-4">Complete a Quest experience before sharing your testimony.</p>
            <LinkButton href="/lessons">Browse Lessons</LinkButton>
          </div>
        )}
      </div>
    </div>
  );
}

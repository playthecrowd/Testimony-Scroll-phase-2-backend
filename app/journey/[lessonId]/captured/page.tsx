"use client";

import { use, useEffect } from "react";
import { notFound, useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { getLesson } from "@/services/lessonService";
import { startJourney, getJourney } from "@/services/journeyService";
import { useSession } from "@/context/SessionContext";
import { JourneyStepper } from "@/components/journey/JourneyStepper";
import { LinkButton } from "@/components/ui/Button";

export default function CapturedStagePage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = use(params);
  const lesson = getLesson(lessonId);
  const { session, ready } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (ready && session.isLoggedIn && lesson) {
      if (!getJourney(session.user.id, lesson.id)) {
        startJourney(session.user.id, lesson.id);
      }
    }
  }, [ready, session, lesson]);

  if (!lesson) return notFound();
  if (!ready) return null;
  if (!session.isLoggedIn) {
    router.push("/login");
    return null;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6 overflow-x-auto qk-scrollbar">
        <JourneyStepper lessonId={lesson.id} currentStage="captured" />
      </div>
      <div className="qk-card p-8 text-center qk-glow-blue">
        <div className="w-14 h-14 rounded-full bg-accent-blue/15 border border-accent-blue/40 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={26} className="text-accent-blue-light" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Lesson Captured!</h1>
        <p className="text-muted text-sm mb-1">
          &ldquo;{lesson.title}&rdquo; was added to My Journey.
        </p>
        <p className="text-accent-blue-light text-sm font-medium mb-6">Lesson Captured Badge earned 🎉</p>
        <LinkButton href={`/journey/${lesson.id}/studied`}>Continue to Study</LinkButton>
      </div>
    </div>
  );
}

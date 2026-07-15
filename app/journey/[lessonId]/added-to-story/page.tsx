"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BookOpen, UserRound, ScrollText as ScrollIcon, Map, Crown, Play, Sparkles } from "lucide-react";
import { StageComingSoon } from "@/components/journey/StageComingSoon";
import { getLesson } from "@/services/lessonService";
import { useSession } from "@/context/SessionContext";
import { getJourney, completeAddedToStory } from "@/services/journeyService";
import { getTestimony } from "@/services/testimonyService";
import { getCharacterByTestimony, getStoryEntryByTestimony } from "@/services/storyService";
import { JourneyStepper } from "@/components/journey/JourneyStepper";
import { Button, LinkButton } from "@/components/ui/Button";
import { Journey } from "@/types";

export default function AddedToStoryPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = use(params);
  const lesson = getLesson(lessonId);
  const { session, ready } = useSession();
  const router = useRouter();
  const [journey, setJourney] = useState<Journey | null>(null);

  useEffect(() => {
    if (ready && session.isLoggedIn && lesson) {
      const j = getJourney(session.user.id, lesson.id);
      setJourney(j ?? null);
    }
  }, [ready, session, lesson]);

  if (!lesson) return <StageComingSoon stageLabel="Added to the Story" />;
  if (!ready) return null;
  if (!session.isLoggedIn) {
    router.push("/login");
    return null;
  }
  if (!journey) return null;

  if (!journey.testimonyId) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <p className="text-foreground font-semibold mb-2">Submit and get your testimony approved first.</p>
        <LinkButton href={`/journey/${lesson.id}/applied`}>Go to Applied Stage</LinkButton>
      </div>
    );
  }

  const testimony = getTestimony(journey.testimonyId);
  if (!testimony || testimony.status !== "approved") {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <p className="text-foreground font-semibold mb-2">Your testimony is still awaiting review.</p>
        <LinkButton href={`/journey/${lesson.id}/applied`}>Check Status</LinkButton>
      </div>
    );
  }

  const character = getCharacterByTestimony(testimony.id);
  const entry = getStoryEntryByTestimony(testimony.id);
  const published = journey.stage === "added-to-story";

  function publish() {
    const updated = completeAddedToStory(session.user.id, lesson!.id);
    setJourney(updated);
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <div className="mb-6 overflow-x-auto qk-scrollbar">
        <JourneyStepper lessonId={lesson.id} currentStage={journey.stage} />
      </div>

      <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
        <ScrollIcon size={26} className="text-accent-gold" /> Added to the Story
      </h1>
      <p className="text-muted text-sm mt-1 mb-6">Your testimony becomes part of the Kingdom Scroll.</p>

      <div className="grid lg:grid-cols-[1fr_340px] gap-6">
        <div className="qk-card overflow-hidden">
          <div className="relative aspect-video bg-surface-2">
            <img src={testimony.thumbnailUrl} className="w-full h-full object-cover" alt="" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-black/50 backdrop-blur flex items-center justify-center">
                <Play size={22} className="text-white ml-1" fill="white" />
              </div>
            </div>
            {published && (
              <span className="absolute top-3 right-3 flex items-center gap-1 text-[11px] bg-accent-gold/90 text-[#231607] px-2.5 py-1 rounded-full font-semibold">
                <Crown size={12} /> Kingdom Scroll Contributor Seal
              </span>
            )}
          </div>
          <div className="p-5">
            <p className="text-[11px] text-accent-blue-light font-medium uppercase tracking-wide mb-1">Member Testimony</p>
            <h2 className="text-xl font-bold text-foreground mb-2">{testimony.title}</h2>
            <p className="text-sm text-muted italic mb-3">&ldquo;{testimony.writtenTestimony}&rdquo;</p>
            <div className="flex flex-wrap gap-2 text-xs mb-4">
              <span className="bg-surface-2 px-2.5 py-1 rounded-full text-muted">Topic: {testimony.topic}</span>
              <span className="bg-surface-2 px-2.5 py-1 rounded-full text-muted">Scripture: {testimony.scripture}</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              <ActionLink icon={BookOpen} label="Lessons Behind This Testimony" href={`/lessons/${lesson.slug}`} />
              {character && <ActionLink icon={UserRound} label="Meet Their Story Character" href={`/characters/${character.id}`} />}
              {entry && <ActionLink icon={ScrollIcon} label="Read Story Contribution" href={`/story`} />}
              <ActionLink icon={Map} label="View Learning Journey" href="/my-journey" />
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="qk-card p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Your Story&apos;s Impact</h3>
            <div className="space-y-3">
              <ImpactStep icon={Sparkles} title="Member Testimony" desc={`${session.user.fullName} shared their testimony.`} active />
              <ImpactStep icon={UserRound} title="Story Character" desc={character ? `${character.name}, ${character.role.toLowerCase()}.` : "Generating character..."} active={!!character} />
              <ImpactStep icon={ScrollIcon} title="Story Contribution" desc={published ? "Added to the Kingdom Scroll to encourage others." : "Ready to publish to the Kingdom Scroll."} active={published} />
            </div>
            {!published ? (
              <Button onClick={publish} className="w-full justify-center mt-4">
                <Crown size={16} /> Publish to the Kingdom Scroll
              </Button>
            ) : (
              <p className="text-xs text-accent-blue-light text-center mt-4">
                Your story is now part of something bigger. Thank you for being faithful. ✦
              </p>
            )}
          </div>

          {published && (
            <div className="qk-card p-4 text-center qk-glow-gold">
              <Crown size={28} className="text-accent-gold mx-auto mb-2" />
              <p className="text-sm font-semibold text-foreground">Full Kingdom Journey Badge</p>
              <p className="text-xs text-accent-gold mt-1">Earned — journey 100% complete</p>
            </div>
          )}

          <Link href="/kingdom-scroll" className="qk-card p-4 flex items-center justify-between text-sm text-foreground hover:border-accent-blue-light">
            View My Place in the Scroll
            <ScrollIcon size={16} className="text-accent-blue-light" />
          </Link>
        </aside>
      </div>
    </div>
  );
}

function ActionLink({ icon: Icon, label, href }: { icon: React.ElementType; label: string; href: string }) {
  return (
    <Link href={href} className="qk-card p-3 flex items-center gap-2 text-xs font-medium text-foreground hover:border-accent-blue-light">
      <Icon size={14} className="text-accent-blue-light shrink-0" /> {label}
    </Link>
  );
}

function ImpactStep({
  icon: Icon,
  title,
  desc,
  active,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
  active: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 ${active ? "bg-accent-blue/15 border-accent-blue/40 text-accent-blue-light" : "bg-surface-2 border-border-subtle text-muted"}`}>
        <Icon size={14} />
      </div>
      <div>
        <p className="text-xs font-medium text-foreground">{title}</p>
        <p className="text-[11px] text-muted">{desc}</p>
      </div>
    </div>
  );
}

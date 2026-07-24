import Image from "next/image";
import { LinkButton } from "@/components/ui/Button";
import { JourneyStagesBar } from "@/components/journey/JourneyStagesBar";
import { SectionCard } from "@/components/ui/StatPill";
import { PageBackground } from "@/components/layout/PageBackground";
import { FeaturedEventBanner } from "@/components/layout/FeaturedEventBanner";
import { FeaturedScrollStrip } from "@/components/layout/FeaturedScrollStrip";
import { LessonThumbnail } from "@/components/lessons/LessonThumbnail";
import { createClient } from "@/lib/supabase/server";
import { getPublishedLessons } from "@/services/supabase/lessons";
import { getApprovedTestimonies } from "@/services/testimonyService";
import { photo } from "@/lib/images";
import { backgrounds } from "@/data/backgrounds";
import { PublishedLesson } from "@/types";
import { Church, Compass, HelpCircle, Box, Award, ScrollText, ArrowRight, Heart, Clock } from "lucide-react";
import Link from "next/link";

// Anonymous-visitor marketing preview only -- names three of the real, currently-seeded v1 badge
// catalog (Phase 11.3, badge_definitions) so this teaser stays accurate. Not a live query: an
// anonymous visitor's Supabase session authenticates as the `anon` role, and badge_definitions'
// RLS is scoped `to authenticated` only, so a live read here would just return zero rows for a
// signed-out visitor anyway. A short static list avoids both that dead end and the mock catalog
// this used to show (data/badges.ts's six retired journey-stage badge names).
const HOMEPAGE_BADGE_PREVIEW = [
  { slug: "first-lesson-completed", name: "First Lesson Completed" },
  { slug: "first-experience-completed", name: "First Experience Completed" },
  { slug: "kingdom-scroll-contributor", name: "Kingdom Scroll Contributor" },
];

// Repair Batch 4, D20 (Trello gkNWwB0e): this featured card previously read from
// services/lessonService.ts's legacy mock/localStorage catalog, which is how a seed-only lesson
// ("Light in the Darkness", never migrated into Supabase) could be selected and linked to --
// /lessons/[slug] resolves exclusively against the real Supabase catalog (services/supabase/lessons.ts)
// and has no such row, so the card 404'd. Now sourced from the same real, published-lessons query
// every other real lesson listing already uses, so this can never point at a nonexistent lesson
// again, regardless of what's in the (still-present, unrelated) mock seed data.
async function getFeaturedLesson(): Promise<PublishedLesson | null> {
  try {
    const supabase = await createClient();
    const lessons = await getPublishedLessons(supabase);
    return lessons[0] ?? null;
  } catch {
    // Supabase not configured, or the request failed -- the homepage must still render without a
    // featured lesson rather than crash the whole page for an anonymous visitor.
    return null;
  }
}

export default async function HomePage() {
  const featuredLesson = await getFeaturedLesson();
  const testimonies = getApprovedTestimonies().slice(0, 3);
  const badges = HOMEPAGE_BADGE_PREVIEW;

  return (
    <div className="relative">
      {/* Featured "ticketed experiences" art — the first thing visitors see before signing in */}
      <PageBackground src={backgrounds.ticketedExperiences} opacity={0.5} />

      {/* Hero */}
      <section className="max-w-[1600px] mx-auto px-4 md:px-8 pt-10 md:pt-14 pb-8">
        <div className="grid lg:grid-cols-[1fr_360px] gap-8 items-start">
          <div className="min-w-0">
            <h1 className="text-4xl md:text-6xl font-extrabold leading-[1.05] text-foreground max-w-2xl">
              Every lesson becomes a{" "}
              <span className="bg-gradient-to-r from-accent-blue-light to-accent-purple bg-clip-text text-transparent">
                journey.
              </span>
            </h1>
            <p className="text-muted text-base md:text-lg mt-5 max-w-xl">
              Churches capture sermons and lessons. Members study them, join a 3D quest, share how the lesson
              applies, and add to the Quest for the Kingdom Scroll.
            </p>
            <div className="flex flex-wrap gap-3 mt-7">
              <LinkButton href="/signup" size="lg">
                <Compass size={18} /> Join the Journey
              </LinkButton>
              <LinkButton href="/churches" size="lg" variant="secondary">
                <Church size={18} /> Explore Churches
              </LinkButton>
            </div>
            <p className="text-xs text-muted mt-6">Thousands of believers. One Kingdom mission.</p>

            <div className="mt-10 qk-card p-4 md:p-5 overflow-x-auto qk-scrollbar" tabIndex={0}>
              <JourneyStagesBar />
            </div>
          </div>

          <div className="qk-card p-5 hidden lg:block">
            <p className="text-sm italic text-foreground leading-relaxed">
              &ldquo;Train up a child in the way he should go: and when he is old, he will not depart from
              it.&rdquo;
            </p>
            <p className="text-xs text-muted mt-2">— Proverbs 22:6</p>
            <div className="mt-5 space-y-4">
              <div className="flex items-start gap-3">
                <BookIcon />
                <div>
                  <p className="text-sm font-semibold text-foreground">Grow in Truth</p>
                  <p className="text-xs text-muted">Study. Reflect. Understand.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Compass size={18} className="text-accent-blue-light mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Live on Mission</p>
                  <p className="text-xs text-muted">Apply what matters most.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <ScrollText size={18} className="text-accent-gold mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Build the Kingdom</p>
                  <p className="text-xs text-muted">Share your journey.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured campaign — big presence, public, above the fold */}
      <section className="max-w-[1600px] mx-auto px-4 md:px-8 pb-6">
        <FeaturedEventBanner />
      </section>

      {/* Featured Kingdom Scroll / Full Story strip — visible to everyone, logged in or not */}
      <section className="max-w-[1600px] mx-auto px-4 md:px-8 pb-8">
        <FeaturedScrollStrip />
      </section>

      {/* Feature grid */}
      <section className="max-w-[1600px] mx-auto px-4 md:px-8 pb-14 grid md:grid-cols-2 xl:grid-cols-5 gap-4">
        <SectionCard title="Church Archives" action="View all" actionHref="/churches" icon={Church}>
          {featuredLesson && (
            <Link href={`/lessons/${featuredLesson.slug}`} className="block group">
              <LessonThumbnail
                src={featuredLesson.featuredImageUrl}
                alt=""
                rounded="rounded-lg"
                className="mb-2"
                imgClassName="group-hover:scale-105 transition-transform"
                sizes="(min-width: 1280px) 20vw, (min-width: 768px) 50vw, 100vw"
              />
              <p className="text-sm font-semibold text-foreground line-clamp-1">{featuredLesson.title}</p>
              <p className="text-xs text-muted">{featuredLesson.durationLabel}</p>
            </Link>
          )}
          <p className="text-xs text-muted mt-3">Browse sermons and lessons from churches around the world.</p>
          <Link href="/churches" className="text-xs text-accent-blue-light mt-2 inline-flex items-center gap-1 hover:underline">
            Explore Archives <ArrowRight size={12} />
          </Link>
        </SectionCard>

        <SectionCard title="Study Questions" action="View all" actionHref="/lessons" icon={HelpCircle}>
          <div className="space-y-2.5">
            {["What is the central truth of this passage?", "How does this apply to your current season?", "What is God inviting you to do?"].map(
              (q) => (
                <div key={q} className="flex items-start gap-2 text-xs text-foreground">
                  <span className="w-4 h-4 rounded-full border border-border-subtle mt-0.5 shrink-0" />
                  {q}
                </div>
              )
            )}
          </div>
          <p className="text-xs text-muted mt-3">Dig deeper with guided questions that build understanding.</p>
          <Link href="/lessons" className="text-xs text-accent-blue-light mt-2 inline-flex items-center gap-1 hover:underline">
            Explore Questions <ArrowRight size={12} />
          </Link>
        </SectionCard>

        <SectionCard title="3D Quest Experience" action="Enter Quest" actionHref="/lessons" icon={Box}>
          <div className="relative aspect-video rounded-lg overflow-hidden bg-surface-2 mb-2">
            <Image src={photo("quest-preview", 500, 300)} alt="" fill sizes="(min-width: 1280px) 20vw, (min-width: 768px) 50vw, 100vw" className="object-cover" />
            <span className="absolute top-2 left-2 text-[11px] bg-black/60 text-white px-2 py-0.5 rounded-full">Level 7</span>
          </div>
          <p className="text-sm font-semibold text-foreground">The Narrow Path</p>
          <p className="text-xs text-muted">Courage leads the way.</p>
          <p className="text-xs text-muted mt-2">Step into immersive quests that help you live the lesson.</p>
        </SectionCard>

        <SectionCard title="Badges & Achievements" action="View Badges" actionHref="/badges" icon={Award}>
          <div className="grid grid-cols-3 gap-2">
            {badges.map((b) => (
              <div key={b.slug} className="qk-card p-2 flex flex-col items-center text-center">
                <div className="w-9 h-9 rounded-full bg-accent-blue/15 border border-accent-blue/40 flex items-center justify-center mb-1">
                  <Award size={15} className="text-accent-blue-light" />
                </div>
                <span className="text-[11px] text-foreground leading-tight">{b.name}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted mt-3">Earn badges as you grow, serve, and share your story.</p>
        </SectionCard>

        <SectionCard title="Kingdom Scroll" action="Add Story" actionHref="/kingdom-scroll" icon={ScrollText}>
          <div className="space-y-3">
            {testimonies.map((t) => (
              <Link key={t.id} href="/kingdom-scroll" className="flex items-start gap-2 group">
                <Image src={t.thumbnailUrl} width={32} height={32} className="rounded-full object-cover shrink-0" alt="" />
                <div className="min-w-0">
                  <p className="text-xs text-foreground line-clamp-2 group-hover:text-accent-blue-light">{t.writtenTestimony}</p>
                  <p className="text-[10px] text-muted mt-0.5 flex items-center gap-1">
                    <Clock size={10} /> <Heart size={10} /> {t.likeCount}
                  </p>
                </div>
              </Link>
            ))}
          </div>
          <p className="text-xs text-muted mt-3">Real stories. Real impact. Together, we write His story.</p>
          <Link href="/kingdom-scroll" className="text-xs text-accent-blue-light mt-2 inline-flex items-center gap-1 hover:underline">
            Read the Scroll <ArrowRight size={12} />
          </Link>
        </SectionCard>
      </section>
    </div>
  );
}

function BookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-accent-blue-light mt-0.5 shrink-0">
      <path d="M4 4h6a2 2 0 0 1 2 2v14a1.5 1.5 0 0 0-1.5-1.5H4V4Z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M20 4h-6a2 2 0 0 0-2 2v14a1.5 1.5 0 0 1 1.5-1.5H20V4Z" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

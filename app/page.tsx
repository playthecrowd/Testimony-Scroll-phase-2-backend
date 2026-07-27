import Link from "next/link";
import {
  ArrowRight, Users2, BookOpen, HeartHandshake, Globe2, ShieldCheck,
  Compass, CalendarPlus, Mic, Sparkles, MapPin, Radio,
} from "lucide-react";
import { LinkButton } from "@/components/ui/Button";
import { PageBackground } from "@/components/layout/PageBackground";
import { CampaignLessonsMarquee } from "@/components/lessons/CampaignLessonsMarquee";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { selectFeaturedCampaignLessonsForHomepage } from "@/lib/campaignLessonOrder";
import { getCampaignLessons, getCurrentWeekCampaignLesson } from "@/services/supabase/lessons";
import {
  getPlatformActivityCounts,
  getFeaturedExperienceForViewer,
  PlatformActivityCounts,
  FeaturedExperienceForViewer,
} from "@/services/supabase/platformActivity";
import { backgrounds } from "@/data/backgrounds";
import { PublishedLesson } from "@/types";

const EMPTY_ACTIVITY_COUNTS: PlatformActivityCounts = {
  activeExperiencesCount: 0,
  publishedCampaignLessonsCount: 0,
  membersJoinedCount: 0,
  lessonsStartedCount: 0,
  lessonsCompletedCount: 0,
  testimoniesSharedCount: 0,
  pendingRegistrationsCount: 0,
};

export const dynamic = "force-dynamic";

const FEATURE_STRIP = [
  { icon: BookOpen, title: "Weekly Lessons", description: "Biblical truth for everyday life." },
  { icon: Users2, title: "Live Experiences", description: "Real connection. Real impact." },
  { icon: Globe2, title: "Kingdom Impact", description: "Changing lives. Advancing the Kingdom." },
  { icon: ShieldCheck, title: "For Everyone", description: "Youth, leaders, and communities." },
];

// Phase Two homepage rebuild. Every number and card below comes from a real query -- see
// services/supabase/platformActivity.ts's own comments for exactly why the "Kingdom Activity"
// panel and "Featured Experience" card are scoped the way they are (an explicit product decision
// preserving the existing no-public-Experience-discovery rule, not an oversight).
export default async function HomePage() {
  // The homepage is the public front door -- it must always render something, even if Supabase
  // is unreachable or unconfigured, rather than 500 the whole site. Unlike a page with a
  // redirect() call, there's no risk of swallowing an internal Next.js control-flow throw here,
  // so a single try/catch around every data-fetch is safe.
  let user: { id: string } | null = null;
  let campaignLessons: PublishedLesson[] = [];
  let currentWeekLesson: PublishedLesson | null = null;
  let activityCounts: PlatformActivityCounts = EMPTY_ACTIVITY_COUNTS;
  let featuredExperience: FeaturedExperienceForViewer | null = null;

  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    user = authUser;

    [campaignLessons, currentWeekLesson, activityCounts, featuredExperience] = await Promise.all([
      getCampaignLessons(supabase).catch((err) => {
        console.error("[HomePage] Failed to load campaign lessons:", err);
        return [];
      }),
      getCurrentWeekCampaignLesson(supabase).catch((err) => {
        console.error("[HomePage] Failed to load current-week campaign lesson:", err);
        return null;
      }),
      getPlatformActivityCounts(supabase),
      getFeaturedExperienceForViewer(supabase),
    ]);
  } catch (err) {
    if (!(err instanceof SupabaseConfigError)) console.error("[HomePage] Failed to load homepage data:", err);
    // Fall through with the empty defaults above -- the hero, Teach/Host panel, and feature strip
    // are all still meaningful with zero live data.
  }

  const startThisWeekHref = currentWeekLesson ? `/lessons/${currentWeekLesson.slug}` : "/lessons";
  const joinNowHref = user ? "/lessons" : "/signup?next=%2Flessons";

  // The featured row shows every published + featured Year-Round Campaign Lesson (not just the
  // current month) in September -> August, Week 1 -> 4 order, with a slow auto-scroll so visitors
  // notice there's a full year of lessons -- see lib/campaignLessonOrder.ts for the ordering.
  const featuredCampaignLessons = selectFeaturedCampaignLessonsForHomepage(campaignLessons);

  return (
    <div className="relative">
      <PageBackground src={backgrounds.homeDashboardHero} opacity={0.5} />

      {/* Hero */}
      <section className="max-w-[1200px] mx-auto px-4 md:px-8 pt-12 md:pt-16 pb-10 text-center">
        <h1 className="text-4xl md:text-6xl font-extrabold leading-[1.05] text-foreground">Quest for the Kingdom</h1>
        <p className="text-muted text-base md:text-lg mt-4 max-w-xl mx-auto">Weekly lessons. Live experiences. Kingdom impact.</p>
        <div className="flex flex-wrap gap-3 mt-7 justify-center">
          <LinkButton href={startThisWeekHref} size="lg">
            Start This Week&apos;s Lesson <ArrowRight size={18} />
          </LinkButton>
          <LinkButton href="/events/host" size="lg" variant="secondary">
            <CalendarPlus size={18} /> Connect Your Event
          </LinkButton>
        </div>
      </section>

      {/* Weekly campaign lessons */}
      <section className="max-w-[1600px] mx-auto px-4 md:px-8 pb-8">
        {featuredCampaignLessons.length > 0 ? (
          <>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-foreground">Featured Campaign Lessons</h2>
              <Link href="/lessons?tab=campaign" className="text-xs text-accent-blue-light hover:underline inline-flex items-center gap-1">
                View all campaign lessons <ArrowRight size={12} />
              </Link>
            </div>
            <CampaignLessonsMarquee lessons={featuredCampaignLessons} />
          </>
        ) : (
          <div className="qk-card p-8 text-center">
            <p className="text-sm font-semibold text-foreground mb-1">This week&apos;s lesson is on its way</p>
            <p className="text-xs text-muted mb-4">Year-Round Campaign Lessons haven&apos;t been published yet. Check back soon, or browse everything already captured.</p>
            <LinkButton href="/lessons" variant="secondary" size="sm">
              Browse Lessons
            </LinkButton>
          </div>
        )}
      </section>

      {/* Kingdom Activity + Teach/Host */}
      <section className="max-w-[1600px] mx-auto px-4 md:px-8 pb-8 grid xl:grid-cols-[1fr_1fr_360px] gap-4">
        {/* Join a Kingdom Experience */}
        <div className="qk-card p-5 min-w-0">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-accent-blue-light flex items-center gap-1.5">
            <Radio size={12} /> Kingdom Experiences
          </span>
          <h2 className="text-xl font-bold text-foreground mt-1.5 mb-1.5">Join a Kingdom Experience</h2>
          <p className="text-muted text-sm mb-5">See what&apos;s happening across the Kingdom and join an Experience through your church.</p>
          <div className="flex flex-col gap-2.5">
            <LinkButton href={joinNowHref} size="md">
              Join Now
            </LinkButton>
            <LinkButton href="/experiences" size="md" variant="secondary">
              View Sessions
            </LinkButton>
          </div>
          <p className="text-[11px] text-muted mt-3">{user ? "Takes you to your Experiences." : "Creates your member account."}</p>
        </div>

        {/* Kingdom Activity -- real counts only, see platformActivity.ts */}
        <div className="qk-card p-5 min-w-0">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-accent-blue-light">Kingdom Activity</span>
          <h2 className="text-xl font-bold text-foreground mt-1.5 mb-1">Live platform progress</h2>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <ActivityStat icon={HeartHandshake} value={activityCounts.activeExperiencesCount} label="Active Experiences" />
            <ActivityStat icon={Users2} value={activityCounts.membersJoinedCount} label="Members Joined" />
            <ActivityStat icon={BookOpen} value={activityCounts.lessonsCompletedCount} label="Lessons Completed" />
            <ActivityStat icon={Sparkles} value={activityCounts.testimoniesSharedCount} label="Testimonies Shared" />
          </div>
        </div>

        {/* Featured Experience -- signed-out visitors always see the empty state; see
            getFeaturedExperienceForViewer's own comment for why. */}
        <div className="qk-card p-5 flex flex-col">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-accent-blue-light">Featured Experience</span>
          {featuredExperience ? (
            <div className="mt-2 flex-1 flex flex-col">
              <h3 className="text-base font-bold text-foreground leading-snug">{featuredExperience.experience.title}</h3>
              <p className="text-xs text-muted mt-1 flex items-center gap-1">
                <MapPin size={11} /> {featuredExperience.churchName}
                {featuredExperience.experience.city ? ` · ${featuredExperience.experience.city}` : ""}
              </p>
              {featuredExperience.experience.summary && (
                <p className="text-xs text-muted mt-2 line-clamp-3">{featuredExperience.experience.summary}</p>
              )}
              <LinkButton href="/experiences" size="sm" variant="secondary" className="mt-auto pt-3">
                View Experiences
              </LinkButton>
            </div>
          ) : (
            <div className="mt-2 flex-1 flex flex-col">
              <p className="text-sm text-foreground mt-1">No featured experience shown yet.</p>
              <p className="text-xs text-muted mt-1.5 flex-1">
                {user ? "Complete a lesson to unlock and join a Kingdom Experience." : "Sign in or join through your church to see available Kingdom Experiences."}
              </p>
              <LinkButton href={user ? "/experiences" : "/login"} size="sm" variant="secondary" className="mt-auto">
                {user ? "View Experiences" : "Sign In"}
              </LinkButton>
            </div>
          )}
        </div>
      </section>

      {/* Teach or Host */}
      <section className="max-w-[1600px] mx-auto px-4 md:px-8 pb-10">
        <div className="qk-card p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-5">
          <div className="flex-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-accent-gold">Inspire. Equip. Multiply.</span>
            <h2 className="text-xl md:text-2xl font-bold text-foreground mt-1.5">Teach or Host a Lesson Experience</h2>
            <p className="text-muted text-sm mt-1.5 max-w-xl">Share your voice with the Kingdom, or bring a live discipleship Experience to your church.</p>
          </div>
          <div className="flex flex-wrap gap-3 shrink-0">
            <LinkButton href="/become-a-speaker" variant="gold" size="md">
              <Mic size={16} /> Become a Speaker
            </LinkButton>
            <LinkButton href="/experience-builder" variant="secondary" size="md">
              <Compass size={16} /> Host an Experience
            </LinkButton>
          </div>
        </div>
      </section>

      {/* Feature strip */}
      <section className="max-w-[1600px] mx-auto px-4 md:px-8 pb-14 grid sm:grid-cols-2 md:grid-cols-4 gap-4">
        {FEATURE_STRIP.map(({ icon: Icon, title, description }) => (
          <div key={title} className="qk-card p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent-blue/15 border border-accent-blue/30 flex items-center justify-center text-accent-blue-light shrink-0">
              <Icon size={17} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{title}</p>
              <p className="text-xs text-muted mt-0.5">{description}</p>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function ActivityStat({ icon: Icon, value, label }: { icon: React.ElementType; value: number; label: string }) {
  return (
    <div className="qk-card p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} className="text-accent-blue-light" />
        <span className="text-lg font-bold text-foreground leading-none">{value.toLocaleString()}</span>
      </div>
      <p className="text-[11px] text-muted">{label}</p>
    </div>
  );
}

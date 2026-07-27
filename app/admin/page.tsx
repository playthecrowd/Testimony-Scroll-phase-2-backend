import { redirect } from "next/navigation";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { FileText, MessageSquareQuote, CalendarDays, Clapperboard, Users, Church, Star, ScrollText, CalendarRange, Mic } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { getPlatformAdminGate } from "@/lib/adminAuth";
import { ErrorState } from "@/components/ui/AsyncState";
import { NotAuthorized } from "@/components/admin/NotAuthorized";
import { getPendingPublicLessonRequests } from "@/services/supabase/lessonRequests";
import { getPendingPublicTestimonies } from "@/services/supabase/testimonies";
import { getPendingEvents } from "@/services/supabase/events";
import { getSpeakerRequestsForAdmin } from "@/services/supabase/speakerRequests";

export const dynamic = "force-dynamic";

interface AdminLink {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  count?: number;
}

// Landing page for every admin section built across Phases 5-9 (docs/PHASE9_AUDIT.md). Several
// pages already link back to "/admin" as their "Admin Home" breadcrumb; this is that destination.
export default async function AdminHomePage() {
  // createClient() itself throws SupabaseConfigError when env vars are missing -- it must stay
  // inside this try so that failure renders the graceful branded error state below.
  let supabase: Awaited<ReturnType<typeof createClient>>;
  let gate;
  try {
    supabase = await createClient();
    gate = await getPlatformAdminGate(supabase);
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      return (
        <div className="max-w-lg mx-auto px-4 py-24">
          <ErrorState message={err.message} />
        </div>
      );
    }
    throw err;
  }

  if (!gate.userId) redirect("/login");
  if (!gate.isPlatformAdmin) return <NotAuthorized />;

  let pendingLessonRequests = 0;
  let pendingTestimonies = 0;
  let pendingEvents = 0;
  let pendingSpeakerRequests = 0;
  try {
    const [lessonRequests, testimonies, events, speakerRequests] = await Promise.all([
      getPendingPublicLessonRequests(supabase),
      getPendingPublicTestimonies(supabase),
      getPendingEvents(supabase),
      getSpeakerRequestsForAdmin(supabase),
    ]);
    pendingLessonRequests = lessonRequests.length;
    pendingTestimonies = testimonies.length;
    pendingEvents = events.length;
    pendingSpeakerRequests = speakerRequests.filter((r) => r.status === "submitted").length;
  } catch (err) {
    console.error("[AdminHomePage] Failed to load pending counts:", err);
  }

  const links: AdminLink[] = [
    {
      href: "/admin/lesson-requests",
      label: "Lesson Requests",
      description: "Approve or decline member requests for new lessons.",
      icon: FileText,
      count: pendingLessonRequests,
    },
    {
      href: "/admin/testimonies",
      label: "Testimonies",
      description: "Approve testimonies for the Kingdom Scroll and choose featured ones.",
      icon: MessageSquareQuote,
      count: pendingTestimonies,
    },
    {
      href: "/admin/events",
      label: "Events",
      description: "Approve or decline church-submitted events.",
      icon: CalendarDays,
      count: pendingEvents,
    },
    {
      href: "/admin/episodes",
      label: "Episodes",
      description: "Build and publish Kingdom Story episodes.",
      icon: Clapperboard,
    },
    {
      href: "/admin/characters",
      label: "Characters",
      description: "Manage Kingdom Story characters and their linked testimonies.",
      icon: Users,
    },
    {
      href: "/admin/churches",
      label: "Churches",
      description: "Verify churches to display a trust badge platform-wide.",
      icon: Church,
    },
    {
      href: "/admin/lessons",
      label: "Featured Lessons",
      description: "Choose which published lessons are emphasized on the Lessons page.",
      icon: Star,
    },
    {
      href: "/admin/campaign-lessons",
      label: "Featured Campaign Lessons",
      description: "Create, edit, publish, feature, highlight, and bulk-upload Year-Round Campaign Lessons.",
      icon: CalendarRange,
    },
    {
      href: "/admin/speaker-requests",
      label: "Speaker Requests",
      description: "Review people who submitted a \"Become a Speaker\" request.",
      icon: Mic,
      count: pendingSpeakerRequests,
    },
    {
      href: "/admin/audit-log",
      label: "Audit Log",
      description: "Review every moderation decision made across the admin tools.",
      icon: ScrollText,
    },
  ];

  return (
    <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-1">Admin</h1>
      <p className="text-muted text-sm mb-6">Platform-wide moderation and curation tools.</p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {links.map(({ href, label, description, icon: Icon, count }) => (
          <Link key={href} href={href} className="qk-card p-4 flex flex-col gap-2 hover:border-accent-blue-light transition-colors">
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-lg bg-accent-blue/15 border border-accent-blue/30 flex items-center justify-center text-accent-blue-light">
                <Icon size={17} />
              </div>
              {typeof count === "number" && count > 0 && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-accent-blue/20 text-accent-blue-light">
                  {count} pending
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-foreground">{label}</p>
            <p className="text-xs text-muted">{description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

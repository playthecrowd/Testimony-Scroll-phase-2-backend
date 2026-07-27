import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PublishedLesson } from "@/types";
import { cn } from "@/lib/utils";
import { LessonThumbnail } from "./LessonThumbnail";

// Shared "Week N" card used by the homepage's weekly campaign-lesson row (fixed-width, horizontal
// scroll strip) and the Lessons page's Campaign Lessons tab (grid cell) -- one place to keep them
// visually consistent, with the caller controlling sizing via className since the two contexts
// need different widths. Uses the same LessonThumbnail every other real lesson card uses (D20/D6
// precedent: graceful fallback for a missing/broken image, never a raw <Image> that throws on a
// null src) for the admin-entered thumbnail URL.
export function CampaignLessonCard({ lesson, className }: { lesson: PublishedLesson; className?: string }) {
  return (
    <Link
      href={`/lessons/${lesson.slug}`}
      className={cn("qk-card overflow-hidden flex flex-col hover:border-accent-blue-light/50 transition-colors focus-ring", className)}
    >
      <LessonThumbnail
        src={lesson.featuredImageUrl}
        alt={lesson.featuredImageAlt}
        rounded="rounded-none"
        imgClassName="group-hover:scale-105 transition-transform"
        sizes="260px"
      />
      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          {lesson.campaignWeekNumber != null ? (
            <span className="text-[11px] font-semibold text-accent-blue-light uppercase tracking-wide">Week {lesson.campaignWeekNumber}</span>
          ) : (
            <span />
          )}
          {lesson.campaignMonth && (
            <span className="text-[11px] font-medium bg-accent-blue/15 text-accent-blue-light px-2 py-0.5 rounded-full shrink-0">
              {lesson.campaignMonth}
            </span>
          )}
        </div>
        <h3 className="text-base font-bold text-foreground leading-snug mb-1.5 line-clamp-2">{lesson.title}</h3>
        {lesson.shortDescription && <p className="text-xs text-muted line-clamp-2 mb-3 flex-1">{lesson.shortDescription}</p>}
        {lesson.campaignSpeakerName && (
          <div className="flex items-center gap-1.5 mb-3">
            {lesson.campaignSpeakerImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={lesson.campaignSpeakerImageUrl} alt="" className="w-5 h-5 rounded-full object-cover shrink-0" />
            ) : (
              <span className="w-5 h-5 rounded-full bg-accent-blue/20 shrink-0" />
            )}
            <span className="text-xs text-muted truncate">Speaker: {lesson.campaignSpeakerName}</span>
          </div>
        )}
        <span className="mt-auto inline-flex items-center justify-center gap-1.5 bg-accent-blue hover:bg-accent-blue-light text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          Start Lesson <ArrowRight size={14} />
        </span>
      </div>
    </Link>
  );
}

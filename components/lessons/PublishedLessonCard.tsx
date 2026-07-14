import Link from "next/link";
import { Play, FileText, Presentation, Headphones, Users2, Sparkles, Box } from "lucide-react";
import { PublishedLesson } from "@/types";
import { formatDate } from "@/lib/utils";
import { LessonThumbnail } from "./LessonThumbnail";

// Visually identical to components/lessons/LessonCard.tsx (which stays untouched and keeps
// serving the still-mocked homepage). This variant reads already-joined church/speaker data
// off the lesson object instead of doing static getChurchById/getSpeakerById lookups, since a
// real, host-created church doesn't exist in the mock /data files at all.
const contentIcon: Record<string, React.ElementType> = {
  video: Play,
  notes: FileText,
  slides: Presentation,
  audio: Headphones,
  document: FileText,
  transcript: FileText,
};

export function PublishedLessonCard({ lesson }: { lesson: PublishedLesson }) {
  const mediaTypes = Array.from(new Set(lesson.media.map((m) => m.mediaType)));
  const hasVideo = mediaTypes.includes("video");

  return (
    <Link
      href={`/lessons/${lesson.slug}`}
      className="qk-card overflow-hidden flex flex-col group hover:border-accent-blue-light/50 transition-colors focus-ring"
    >
      <LessonThumbnail
        src={lesson.featuredImageUrl}
        alt={lesson.featuredImageAlt}
        imgClassName="group-hover:scale-105 transition-transform duration-300"
        rounded="rounded-none"
        sizes="(min-width: 1536px) 23vw, (min-width: 1024px) 31vw, (min-width: 640px) 48vw, 100vw"
      >
        {hasVideo && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-11 h-11 rounded-full bg-black/50 backdrop-blur flex items-center justify-center">
              <Play size={18} className="text-white ml-0.5" fill="white" />
            </div>
          </div>
        )}
        {lesson.durationLabel && (
          <span className="absolute bottom-2 left-2 text-[11px] bg-black/60 text-white px-1.5 py-0.5 rounded">
            {lesson.durationLabel}
          </span>
        )}
        {lesson.questUrl && (
          <span className="absolute top-2 left-2 text-[11px] bg-accent-purple/80 text-white px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
            <Box size={11} /> Quest
          </span>
        )}
      </LessonThumbnail>

      <div className="p-3.5 flex-1 flex flex-col">
        {lesson.topic && <span className="text-[11px] text-accent-blue-light font-medium mb-1">{lesson.topic}</span>}
        <h3 className="text-sm font-semibold text-foreground leading-snug mb-1.5 line-clamp-2">{lesson.title}</h3>
        {lesson.speaker && (
          <div className="flex items-center gap-1.5 mb-1.5">
            {lesson.speaker.avatarUrl && (
              <img src={lesson.speaker.avatarUrl} alt="" className="w-5 h-5 rounded-full" />
            )}
            <span className="text-xs text-muted truncate">{lesson.speaker.name}</span>
          </div>
        )}
        {lesson.shortDescription && <p className="text-xs text-muted line-clamp-2 mb-2">{lesson.shortDescription}</p>}
        <div className="mt-auto pt-2 flex items-center justify-between border-t border-border-subtle">
          <span className="text-[11px] text-muted">{lesson.date ? formatDate(lesson.date) : ""}</span>
          <div className="flex items-center gap-1.5 text-muted">
            {mediaTypes.map((t) => {
              const Icon = contentIcon[t] ?? Sparkles;
              return <Icon key={t} size={13} />;
            })}
          </div>
        </div>
        {lesson.hosts.length > 0 ? (
          <div className="mt-1.5 flex items-center gap-1 text-[11px] text-muted">
            <Users2 size={12} /> Hosted by {lesson.hosts.length} {lesson.hosts.length === 1 ? "church" : "churches"}
          </div>
        ) : (
          <div className="mt-1.5 flex items-center gap-1 text-[11px] text-muted">
            <Users2 size={12} /> {lesson.church.name}
          </div>
        )}
      </div>
    </Link>
  );
}

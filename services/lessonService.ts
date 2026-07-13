import { Lesson } from "@/types";
import { seedLessons } from "@/data/lessons";
import { loadCollection, saveCollection, newId } from "@/lib/storage";
import { photo } from "@/lib/images";

const KEY = "lessons";

export function getAllLessons(): Lesson[] {
  const stored = loadCollection<Lesson>(KEY, seedLessons);
  // newest first
  return [...stored].sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getLesson(idOrSlug: string): Lesson | undefined {
  return getAllLessons().find((l) => l.id === idOrSlug || l.slug === idOrSlug);
}

export function getLessonsByChurch(churchId: string): Lesson[] {
  return getAllLessons().filter((l) => l.churchId === churchId);
}

export interface CaptureLessonInput {
  title: string;
  topic: string;
  shortDescription: string;
  churchId: string;
  speakerId: string;
  speakerName?: string;
  date: string;
  lessonType: Lesson["lessonType"];
  ministryCategory: string;
  notesUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  slidesUrl?: string;
  pastedNotes?: string;
  primaryScripture: string;
  supportingScriptures: string[];
  tags: string[];
  questUrl?: string;
}

export function submitCapturedLesson(input: CaptureLessonInput): Lesson {
  const all = loadCollection<Lesson>(KEY, seedLessons);
  const slug = input.title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const contentTypes: Lesson["contentTypes"] = [];
  if (input.videoUrl) contentTypes.push("video");
  if (input.audioUrl) contentTypes.push("audio");
  if (input.notesUrl || input.pastedNotes) contentTypes.push("notes");
  if (input.slidesUrl) contentTypes.push("slides");
  const finalContentTypes = contentTypes.length > 1 ? (["multiple", ...contentTypes] as Lesson["contentTypes"]) : contentTypes;

  const lesson: Lesson = {
    id: newId("lesson"),
    slug: slug || newId("lesson"),
    title: input.title,
    shortDescription: input.shortDescription,
    aboutText: input.pastedNotes || input.shortDescription,
    topic: input.topic,
    subject: input.topic,
    ministryCategory: input.ministryCategory,
    churchId: input.churchId,
    speakerId: input.speakerId,
    date: input.date,
    durationLabel: input.videoUrl ? "—" : "",
    contentTypes: finalContentTypes.length ? finalContentTypes : ["notes"],
    lessonType: input.lessonType,
    primaryScripture: input.primaryScripture,
    supportingScriptures: input.supportingScriptures,
    tags: input.tags,
    featuredImageUrl: photo(slug || newId("lesson"), 900, 600),
    notesUrl: input.notesUrl,
    videoUrl: input.videoUrl,
    audioUrl: input.audioUrl,
    slidesUrl: input.slidesUrl,
    pastedNotes: input.pastedNotes,
    questUrl: input.questUrl,
    hostSessions: [],
    contributorsCount: 0,
    createdBySubmission: true,
    isNew: true,
  };

  const updated = [lesson, ...all];
  saveCollection(KEY, updated);
  return lesson;
}

export interface LessonFilters {
  churchId?: string;
  contentType?: string;
  speakerId?: string;
  search?: string;
}

export function filterLessons(filters: LessonFilters): Lesson[] {
  return getAllLessons().filter((l) => {
    if (filters.churchId && filters.churchId !== "all" && l.churchId !== filters.churchId) return false;
    if (filters.speakerId && filters.speakerId !== "all" && l.speakerId !== filters.speakerId) return false;
    if (filters.contentType && filters.contentType !== "all") {
      if (!l.contentTypes.includes(filters.contentType as Lesson["contentTypes"][number])) return false;
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const haystack = `${l.title} ${l.topic} ${l.shortDescription} ${l.tags.join(" ")}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

import { churches } from "@/data/churches";
import { Church } from "@/types";
import { getLessonsByChurch } from "@/services/lessonService";

export function getAllChurches(): Church[] {
  return churches;
}

export function getChurch(idOrSlug: string): Church | undefined {
  return churches.find((c) => c.id === idOrSlug || c.slug === idOrSlug);
}

export function getChurchLessons(churchId: string) {
  return getLessonsByChurch(churchId);
}

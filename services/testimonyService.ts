import { Testimony } from "@/types";
import { seedTestimonies, mayaTestimony } from "@/data/testimonies";
import { loadCollection, saveCollection, newId } from "@/lib/storage";
import { photo } from "@/lib/images";

const KEY = "testimonies";
const seedAll = [...seedTestimonies, mayaTestimony];

export function getAllTestimonies(): Testimony[] {
  return loadCollection<Testimony>(KEY, seedAll);
}

export function getApprovedTestimonies(): Testimony[] {
  return getAllTestimonies()
    .filter((t) => t.status === "approved" && t.visibility === "public")
    .sort((a, b) => (a.approvedAt! < b.approvedAt! ? 1 : -1));
}

export function getTestimony(id: string): Testimony | undefined {
  return getAllTestimonies().find((t) => t.id === id);
}

export function getUserTestimonies(userId: string): Testimony[] {
  return getAllTestimonies().filter((t) => t.userId === userId);
}

export interface SubmitTestimonyInput {
  userId: string;
  primaryLessonId: string;
  supportingLessonIds: string[];
  whatLearned: string;
  howApplied: string;
  situation: string;
  actionTaken: string;
  howHelpsOthers: string;
  writtenTestimony: string;
  applicationScenario?: string;
  visibility: Testimony["visibility"];
  identityDisplay: Testimony["identityDisplay"];
  storyGenerationPermission: boolean;
  futureEpisodePermission: boolean;
  voiceLikenessPermission: boolean;
  title: string;
  topic: string;
  scripture: string;
}

export function submitTestimony(input: SubmitTestimonyInput): Testimony {
  const all = loadCollection<Testimony>(KEY, seedAll);
  const testimony: Testimony = {
    id: newId("testimony"),
    ...input,
    thumbnailUrl: photo(newId("testimony"), 700, 900),
    status: "awaiting-review",
    submittedAt: new Date().toISOString(),
    likeCount: 0,
    commentCount: 0,
    shareCount: 0,
    durationLabel: "—",
  };
  saveCollection(KEY, [testimony, ...all]);
  return testimony;
}

export function approveTestimony(id: string): Testimony | undefined {
  const all = loadCollection<Testimony>(KEY, seedAll);
  const idx = all.findIndex((t) => t.id === id);
  if (idx === -1) return undefined;
  const updated = { ...all[idx], status: "approved" as const, approvedAt: new Date().toISOString() };
  const next = [...all];
  next[idx] = updated;
  saveCollection(KEY, next);
  return updated;
}

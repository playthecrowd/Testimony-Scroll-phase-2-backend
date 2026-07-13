import { StoryEntry } from "@/types";
import { photo } from "@/lib/images";

export const seedStoryEntries: StoryEntry[] = [
  {
    id: "story-1",
    episodeNumber: 1,
    date: "2024-05-12",
    title: "The Narrow Path",
    storyText:
      "The journey begins with a choice — follow the narrow path that leads to life. Elijah stands at the crossroads, unwilling to take the easy way when faithfulness calls him further.",
    characterId: "char-elijah",
    topic: "Faith & Trust",
    scripture: "Matthew 7:13-14",
    arcLabel: "Foundation",
    contributorIds: ["test-david-l"],
    testimonyId: "test-david-l",
    lessonIds: ["lesson-narrow-path"],
    imageUrl: photo("story-narrow-path", 900, 600),
  },
  {
    id: "story-2",
    episodeNumber: 2,
    date: "2024-05-13",
    title: "Faith That Moves Mountains",
    storyText:
      "When faith is not just believing, but acting, mountains are moved because trust becomes bigger than fear. Nathanael comes and sees for himself, and everything changes.",
    characterId: "char-nathanael",
    topic: "Faith & Trust",
    scripture: "Matthew 17:20",
    arcLabel: "Breakthrough",
    contributorIds: ["test-maya"],
    testimonyId: "test-maya",
    lessonIds: ["lesson-faith-moves-mountains"],
    imageUrl: photo("story-faith-mountains", 900, 600),
  },
  {
    id: "story-3",
    episodeNumber: 3,
    date: "2024-05-15",
    title: "The Good Shepherd",
    storyText:
      "He leads, He guards, He restores — you are never alone on the path. Deborah discovers that the Shepherd's voice is louder than the noise of the wilderness around her.",
    characterId: "char-deborah",
    topic: "Identity in Christ",
    scripture: "John 10:11",
    arcLabel: "Protection",
    contributorIds: ["test-lisa-k"],
    testimonyId: "test-lisa-k",
    lessonIds: ["lesson-good-shepherd"],
    imageUrl: photo("story-good-shepherd", 900, 600),
  },
  {
    id: "story-4",
    episodeNumber: 4,
    date: "2024-05-16",
    title: "Grace in the Waiting",
    storyText:
      "Waiting is not wasted. God is writing something beautiful in the in-between, and Hannah learns to trust the pen in His hand.",
    characterId: "char-hannah",
    topic: "Trust & Patience",
    scripture: "Psalm 27:14",
    arcLabel: "Refining",
    contributorIds: ["test-barbara-w"],
    testimonyId: "test-barbara-w",
    lessonIds: ["lesson-grace-in-waiting"],
    imageUrl: photo("story-grace-waiting", 900, 600),
  },
  {
    id: "story-5",
    episodeNumber: 5,
    date: "2024-05-18",
    title: "Light in the Darkness",
    storyText:
      "Called to shine, your light reveals His glory in a world that needs hope. Joseph's detours become the very path that carries light to others.",
    characterId: "char-joseph",
    topic: "Purpose & Calling",
    scripture: "Matthew 5:14-16",
    arcLabel: "Purpose",
    contributorIds: ["test-alex-k"],
    testimonyId: "test-alex-k",
    lessonIds: ["lesson-light-in-darkness"],
    imageUrl: photo("story-light-darkness", 900, 600),
  },
];

export function getStoryEntryById(id: string) {
  return seedStoryEntries.find((s) => s.id === id);
}

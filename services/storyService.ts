import { StoryCharacter, StoryEntry, Testimony } from "@/types";
import { seedCharacters } from "@/data/characters";
import { seedStoryEntries } from "@/data/storyEntries";
import { loadCollection, saveCollection, newId } from "@/lib/storage";
import { photo } from "@/lib/images";

const CHAR_KEY = "characters";
const STORY_KEY = "storyEntries";

const ARC_NAMES = [
  "The Overcomer",
  "The Faithful",
  "The Restored",
  "The Called",
  "The Watchful One",
  "The Steady Heart",
];

export function getAllCharacters(): StoryCharacter[] {
  return loadCollection<StoryCharacter>(CHAR_KEY, seedCharacters);
}

export function getCharacter(id: string): StoryCharacter | undefined {
  return getAllCharacters().find((c) => c.id === id);
}

export function getCharacterByTestimony(testimonyId: string): StoryCharacter | undefined {
  return getAllCharacters().find((c) => c.testimonyId === testimonyId);
}

export function getAllStoryEntries(): StoryEntry[] {
  return loadCollection<StoryEntry>(STORY_KEY, seedStoryEntries).sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function getStoryEntry(id: string): StoryEntry | undefined {
  return getAllStoryEntries().find((s) => s.id === id);
}

export function getStoryEntryByTestimony(testimonyId: string): StoryEntry | undefined {
  return getAllStoryEntries().find((s) => s.testimonyId === testimonyId);
}

// Simulates the AI story-generation pipeline: turns an approved testimony
// into a story character and a connected story entry.
export function generateCharacterAndStory(testimony: Testimony): { character: StoryCharacter; entry: StoryEntry } {
  const existingChar = getCharacterByTestimony(testimony.id);
  const existingEntry = getStoryEntryByTestimony(testimony.id);
  if (existingChar && existingEntry) return { character: existingChar, entry: existingEntry };

  const characters = loadCollection<StoryCharacter>(CHAR_KEY, seedCharacters);
  const entries = loadCollection<StoryEntry>(STORY_KEY, seedStoryEntries);

  const arcLabel = ARC_NAMES[Math.floor(Math.random() * ARC_NAMES.length)];

  const character: StoryCharacter = existingChar ?? {
    id: newId("char"),
    name: testimony.identityDisplay === "anonymous" ? "A Faithful Witness" : testimony.title.split(" ").slice(0, 2).join(" "),
    role: arcLabel,
    description: `A believer shaped by ${testimony.topic.toLowerCase()}, whose story of ${testimony.title.toLowerCase()} became part of the Kingdom's unfolding story.`,
    imageUrl: photo(testimony.id + "-char", 800, 1000),
    quote: testimony.writtenTestimony.split(".")[0] + ".",
    quoteSource: testimony.scripture,
    storyArc: testimony.howHelpsOthers || "A journey of faith that continues to inspire others.",
    arcLabel,
    isKeyCharacter: false,
    testimonyId: testimony.id,
  };

  const entry: StoryEntry = existingEntry ?? {
    id: newId("story"),
    episodeNumber: entries.length + 1,
    date: new Date().toISOString().slice(0, 10),
    title: testimony.title,
    storyText: testimony.writtenTestimony,
    characterId: character.id,
    topic: testimony.topic,
    scripture: testimony.scripture,
    arcLabel,
    contributorIds: [testimony.id],
    testimonyId: testimony.id,
    lessonIds: [testimony.primaryLessonId, ...testimony.supportingLessonIds],
    imageUrl: photo(testimony.id + "-story", 900, 600),
  };

  if (!existingChar) saveCollection(CHAR_KEY, [...characters, character]);
  if (!existingEntry) saveCollection(STORY_KEY, [...entries, entry]);

  return { character, entry };
}

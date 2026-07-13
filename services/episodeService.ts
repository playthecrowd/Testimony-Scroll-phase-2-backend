import { seedEpisodes } from "@/data/episodes";
import { Episode } from "@/types";

export function getAllEpisodes(): Episode[] {
  return [...seedEpisodes].sort((a, b) => b.episodeNumber - a.episodeNumber);
}

export function getEpisode(id: string): Episode | undefined {
  return seedEpisodes.find((e) => e.id === id);
}

export function getFeaturedEpisode(): Episode | undefined {
  return seedEpisodes.find((e) => e.featured) ?? seedEpisodes[0];
}

export function getUpcomingEpisodes(): Episode[] {
  return seedEpisodes.filter((e) => e.upcoming);
}

export function getEpisodesByCharacter(characterId: string): Episode[] {
  return seedEpisodes.filter((e) => e.mainCharacterId === characterId);
}

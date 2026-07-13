"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Users2,
  Clapperboard,
  Tag,
  Search,
  Play,
} from "lucide-react";
import { getAllStoryEntries } from "@/services/storyService";
import { seedCharacters } from "@/data/characters";
import { getEpisodesByCharacter } from "@/services/episodeService";
import { PageBackground } from "@/components/layout/PageBackground";
import { backgrounds } from "@/data/backgrounds";
import { formatDate, cn } from "@/lib/utils";

const viewModes = [
  { key: "book", label: "Book View", icon: BookOpen },
  { key: "timeline", label: "Timeline View", icon: Clapperboard },
  { key: "characters", label: "Characters", icon: Users2 },
  { key: "topics", label: "Topics", icon: Tag },
] as const;

export default function FullStoryPage() {
  const entries = getAllStoryEntries();
  const [mode, setMode] = useState<(typeof viewModes)[number]["key"]>("book");
  const [topicFilter, setTopicFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedCharacterId, setSelectedCharacterId] = useState(entries[0]?.characterId ?? seedCharacters[0].id);

  const topics = Array.from(new Set(entries.map((e) => e.topic)));

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (topicFilter !== "all" && e.topic !== topicFilter) return false;
      if (search && !`${e.title} ${e.storyText}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [entries, topicFilter, search]);

  const selectedCharacter = seedCharacters.find((c) => c.id === selectedCharacterId) ?? seedCharacters[0];
  const relatedEntries = entries.filter((e) => e.characterId === selectedCharacter.id);
  const relatedEpisodes = getEpisodesByCharacter(selectedCharacter.id);
  const completion = Math.round((entries.length / 5) * 100);

  return (
    <div className="relative max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <PageBackground src={backgrounds.chooseHowToJoin} opacity={0.3} />
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">The Full Kingdom Story</h1>
          <p className="text-muted text-sm mt-1">One story. Many lives. All leading to the King.</p>
          <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted">
            <span>
              <span className="text-foreground font-semibold">{entries.length}</span> Episodes
            </span>
            <span>
              <span className="text-foreground font-semibold">{seedCharacters.length}</span> Key Characters
            </span>
            <span>
              <span className="text-foreground font-semibold">{entries.length}</span> Story Entries
            </span>
          </div>
        </div>
        <div className="qk-card px-4 py-3 text-center shrink-0">
          <p className="text-[11px] text-muted">Story Completion</p>
          <p className="text-2xl font-bold text-accent-blue-light">{Math.min(completion, 100)}%</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-1 rounded-lg border border-border-subtle p-1">
          {viewModes.map((v) => (
            <button
              key={v.key}
              onClick={() => setMode(v.key)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5",
                mode === v.key ? "bg-accent-blue text-white" : "text-muted hover:text-foreground"
              )}
            >
              <v.icon size={13} /> {v.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search the story..."
            className="w-full bg-surface-2 border border-border-subtle rounded-lg pl-8 pr-3 py-2 text-sm text-foreground placeholder:text-muted"
          />
        </div>
      </div>

      <div className="grid lg:grid-cols-[220px_1fr_300px] gap-6">
        <div className="space-y-4 order-2 lg:order-1">
          <div>
            <p className="text-xs font-semibold text-muted mb-2">Topics</p>
            <div className="flex flex-wrap lg:flex-col gap-1.5">
              <button
                onClick={() => setTopicFilter("all")}
                className={cn("text-left px-2.5 py-1.5 rounded-lg text-xs", topicFilter === "all" ? "bg-accent-blue/15 text-accent-blue-light" : "text-muted hover:bg-white/5")}
              >
                All Topics
              </button>
              {topics.map((t) => (
                <button
                  key={t}
                  onClick={() => setTopicFilter(t)}
                  className={cn("text-left px-2.5 py-1.5 rounded-lg text-xs", topicFilter === t ? "bg-accent-blue/15 text-accent-blue-light" : "text-muted hover:bg-white/5")}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted mb-2">Key Characters</p>
            <div className="grid grid-cols-3 lg:grid-cols-2 gap-2">
              {seedCharacters.slice(0, 6).map((c) => (
                <button key={c.id} onClick={() => setSelectedCharacterId(c.id)} className="text-center group">
                  <img
                    src={c.imageUrl}
                    className={cn("w-full aspect-square rounded-lg object-cover mb-1", selectedCharacterId === c.id && "ring-2 ring-accent-blue-light")}
                    alt=""
                  />
                  <span className="text-[11px] text-muted group-hover:text-foreground">{c.name}</span>
                </button>
              ))}
            </div>
            <Link href="/characters" className="text-xs text-accent-blue-light hover:underline mt-2 inline-block">
              View All Characters →
            </Link>
          </div>
        </div>

        <div className="order-1 lg:order-2">
          {mode === "characters" ? (
            <div className="grid sm:grid-cols-2 gap-4">
              {seedCharacters.map((c) => (
                <button key={c.id} onClick={() => setSelectedCharacterId(c.id)} className="qk-card p-3 flex items-center gap-3 text-left hover:border-accent-blue-light/50">
                  <img src={c.imageUrl} className="w-14 h-14 rounded-lg object-cover" alt="" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{c.name}</p>
                    <p className="text-xs text-muted">{c.role}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : mode === "topics" ? (
            <div className="space-y-3">
              {topics.map((t) => (
                <div key={t} className="qk-card p-4">
                  <p className="text-sm font-semibold text-foreground mb-2">{t}</p>
                  <p className="text-xs text-muted">{entries.filter((e) => e.topic === t).length} story entries</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="relative pl-8">
              <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border-subtle" />
              <div className="space-y-6">
                {filtered.map((entry) => {
                  const character = seedCharacters.find((c) => c.id === entry.characterId);
                  return (
                    <div key={entry.id} className="relative">
                      <div className="absolute -left-8 top-1 w-8 h-8 rounded-full bg-accent-blue/15 border border-accent-blue/40 flex items-center justify-center text-xs font-semibold text-accent-blue-light">
                        {entry.episodeNumber}
                      </div>
                      <p className="text-xs text-muted mb-1">
                        {formatDate(entry.date)} · Episode {entry.episodeNumber}
                      </p>
                      <div className="qk-card overflow-hidden md:flex">
                        <div className="md:w-56 aspect-video md:aspect-square shrink-0 bg-surface-2">
                          <img src={entry.imageUrl} className="w-full h-full object-cover" alt="" />
                        </div>
                        <div className="p-4">
                          <div className="flex items-center gap-2 mb-1.5">
                            <h3 className="text-base font-semibold text-foreground">{entry.title}</h3>
                            <span className="text-[10px] bg-accent-blue/15 text-accent-blue-light px-2 py-0.5 rounded-full">{entry.arcLabel}</span>
                          </div>
                          <p className="text-sm text-muted leading-relaxed mb-3">{entry.storyText}</p>
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
                            <span>{entry.scripture}</span>
                            <span>·</span>
                            <span>{entry.topic}</span>
                            {character && (
                              <button onClick={() => setSelectedCharacterId(character.id)} className="ml-auto flex items-center gap-1.5 text-accent-blue-light">
                                <img src={character.imageUrl} className="w-5 h-5 rounded-full object-cover" alt="" />
                                {character.name}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {filtered.length === 0 && <p className="text-sm text-muted py-10">No story entries match this filter.</p>}
              </div>
            </div>
          )}
        </div>

        <aside className="order-3">
          <div className="qk-card overflow-hidden sticky top-20">
            <div className="relative aspect-[4/5]">
              <img src={selectedCharacter.imageUrl} className="w-full h-full object-cover" alt="" />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
              {selectedCharacter.isKeyCharacter && (
                <span className="absolute top-3 right-3 text-[10px] bg-accent-blue/80 text-white px-2 py-0.5 rounded-full">Key Character</span>
              )}
              <div className="absolute inset-x-0 bottom-0 p-4">
                <h3 className="text-xl font-bold text-foreground">{selectedCharacter.name}</h3>
                <p className="text-xs text-accent-blue-light">{selectedCharacter.role}</p>
              </div>
            </div>
            <div className="p-4">
              <p className="text-xs italic text-muted mb-1">&ldquo;{selectedCharacter.quote}&rdquo;</p>
              <p className="text-[11px] text-accent-blue-light mb-3">— {selectedCharacter.quoteSource}</p>
              <p className="text-xs font-semibold text-foreground mb-1">About {selectedCharacter.name}</p>
              <p className="text-xs text-muted leading-relaxed mb-3">{selectedCharacter.description}</p>
              <p className="text-xs font-semibold text-foreground mb-1">
                Story Arc <span className="text-[10px] bg-surface-2 px-1.5 py-0.5 rounded ml-1 text-muted">{selectedCharacter.arcLabel}</span>
              </p>
              <p className="text-xs text-muted leading-relaxed mb-4">{selectedCharacter.storyArc}</p>

              {relatedEpisodes.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-foreground mb-1.5">Related Episodes</p>
                  {relatedEpisodes.slice(0, 3).map((ep) => (
                    <Link key={ep.id} href={`/episodes/${ep.id}`} className="flex items-center gap-1.5 text-[11px] text-muted hover:text-accent-blue-light py-1">
                      <Play size={11} /> Episode {ep.episodeNumber} · {ep.title}
                    </Link>
                  ))}
                </div>
              )}

              <Link
                href={`/characters/${selectedCharacter.id}`}
                className="block w-full text-center text-sm font-medium bg-accent-blue hover:bg-accent-blue-light text-white rounded-lg py-2.5"
              >
                Explore {selectedCharacter.name}&apos;s Journey
              </Link>
            </div>
          </div>
          {relatedEntries.length > 1 && (
            <p className="text-[11px] text-muted mt-2 text-center">{relatedEntries.length} story entries feature this character.</p>
          )}
        </aside>
      </div>
    </div>
  );
}

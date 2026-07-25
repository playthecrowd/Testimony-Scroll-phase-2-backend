"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, Users2, Clapperboard, Tag, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDate, cn } from "@/lib/utils";
import { PublishedEpisode, PublishedCharacter } from "@/types";

const viewModes = [
  { key: "book", label: "Book View", icon: BookOpen },
  { key: "timeline", label: "Timeline View", icon: Clapperboard },
  { key: "characters", label: "Characters", icon: Users2 },
  { key: "topics", label: "Topics", icon: Tag },
] as const;

export function FullStoryView({ episodes, characters }: { episodes: PublishedEpisode[]; characters: PublishedCharacter[] }) {
  const [mode, setMode] = useState<(typeof viewModes)[number]["key"]>("book");
  const [topicFilter, setTopicFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [chapterIndex, setChapterIndex] = useState(0);
  const [selectedCharacterId, setSelectedCharacterId] = useState(characters[0]?.id ?? "");

  const topics = Array.from(new Set(episodes.map((e) => e.topic).filter((t): t is string => !!t)));

  const filtered = useMemo(() => {
    return episodes.filter((e) => {
      if (topicFilter !== "all" && e.topic !== topicFilter) return false;
      if (search && !`${e.title} ${e.description ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [episodes, topicFilter, search]);

  const selectedCharacter = characters.find((c) => c.id === selectedCharacterId) ?? characters[0];
  const relatedEpisodes = selectedCharacter ? episodes.filter((e) => e.characters.some((c) => c.id === selectedCharacter.id)) : [];

  const chapter = filtered[Math.min(chapterIndex, filtered.length - 1)];

  if (episodes.length === 0) {
    return <div className="qk-card p-10 text-center text-muted text-sm">No published episodes yet.</div>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-1 rounded-lg border border-border-subtle p-1">
          {viewModes.map((v) => (
            <button
              key={v.key}
              onClick={() => {
                setMode(v.key);
                setChapterIndex(0);
              }}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5",
                mode === v.key ? "bg-accent-blue text-white" : "text-muted hover:text-foreground"
              )}
            >
              <v.icon size={13} /> {v.label}
            </button>
          ))}
        </div>
        {(mode === "book" || mode === "timeline") && (
          <div className="relative flex-1 min-w-[160px] max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setChapterIndex(0);
              }}
              placeholder="Search the story..."
              className="w-full bg-surface-2 border border-border-subtle rounded-lg pl-8 pr-3 py-2 text-sm text-foreground placeholder:text-muted"
            />
          </div>
        )}
      </div>

      {mode === "characters" && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {characters.map((c) => (
            <Link key={c.id} href={`/characters/${c.id}`} className="qk-card p-3 flex items-center gap-3 hover:border-accent-blue-light/50">
              {c.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.imageUrl} className="w-14 h-14 rounded-lg object-cover" alt="" />
              )}
              <div>
                <p className="text-sm font-semibold text-foreground">{c.name}</p>
                {c.role && <p className="text-xs text-muted">{c.role}</p>}
              </div>
            </Link>
          ))}
          {characters.length === 0 && <p className="text-sm text-muted">No characters yet.</p>}
        </div>
      )}

      {mode === "topics" && (
        <div className="space-y-3">
          {topics.map((t) => (
            <button key={t} onClick={() => { setTopicFilter(t); setMode("timeline"); }} className="qk-card p-4 w-full text-left hover:border-accent-blue-light/50">
              <p className="text-sm font-semibold text-foreground mb-1">{t}</p>
              <p className="text-xs text-muted">{episodes.filter((e) => e.topic === t).length} episodes</p>
            </button>
          ))}
          {topics.length === 0 && <p className="text-sm text-muted">No topics yet.</p>}
        </div>
      )}

      {mode === "timeline" && (
        <div className="grid lg:grid-cols-[1fr_300px] gap-6">
          <div className="relative pl-8 min-w-0">
            <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border-subtle" />
            <div className="space-y-6">
              {filtered.map((ep) => (
                <div key={ep.id} className="relative">
                  <div className="absolute -left-8 top-1 w-8 h-8 rounded-full bg-accent-blue/15 border border-accent-blue/40 flex items-center justify-center text-xs font-semibold text-accent-blue-light">
                    {ep.episodeNumber}
                  </div>
                  {ep.releaseDate && <p className="text-xs text-muted mb-1">{formatDate(ep.releaseDate)} · Episode {ep.episodeNumber}</p>}
                  <Link href={`/episodes/${ep.id}`} className="qk-card overflow-hidden md:flex block hover:border-accent-blue-light/50">
                    {ep.thumbnailUrl && (
                      <div className="md:w-56 aspect-video md:aspect-square shrink-0 bg-surface-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={ep.thumbnailUrl} className="w-full h-full object-cover" alt="" />
                      </div>
                    )}
                    <div className="p-4">
                      <h3 className="text-base font-semibold text-foreground mb-1.5">{ep.title}</h3>
                      {ep.description && <p className="text-sm text-muted leading-relaxed mb-3 line-clamp-3">{ep.description}</p>}
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
                        {ep.scripture && <span>{ep.scripture}</span>}
                        {ep.topic && <span>{ep.topic}</span>}
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
              {filtered.length === 0 && <p className="text-sm text-muted py-10">No episodes match this filter.</p>}
            </div>
          </div>
          <CharacterAside characters={characters} selectedCharacter={selectedCharacter} onSelect={setSelectedCharacterId} relatedEpisodes={relatedEpisodes} />
        </div>
      )}

      {mode === "book" && (
        <div className="grid lg:grid-cols-[1fr_300px] gap-6">
          {!chapter ? (
            <p className="text-sm text-muted py-10">No episodes match this filter.</p>
          ) : (
            <div className="qk-card p-6 md:p-8 min-w-0">
              <p className="text-xs text-accent-blue-light font-medium mb-1">
                Chapter {chapterIndex + 1} of {filtered.length}
              </p>
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-1">{chapter.title}</h2>
              <p className="text-xs text-muted mb-5">
                Season {chapter.season} · Episode {chapter.episodeNumber}
                {chapter.releaseDate && ` · ${formatDate(chapter.releaseDate)}`}
              </p>
              {chapter.thumbnailUrl && (
                <div className="aspect-video rounded-xl overflow-hidden bg-surface-2 mb-5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={chapter.thumbnailUrl} className="w-full h-full object-cover" alt="" />
                </div>
              )}
              {chapter.description && <p className="text-base text-foreground leading-relaxed mb-5">{chapter.description}</p>}
              {chapter.quote && (
                <blockquote className="border-l-2 border-accent-blue-light pl-4 italic text-sm text-muted mb-5">
                  &ldquo;{chapter.quote}&rdquo;
                  {chapter.quoteSource && <span className="block not-italic text-xs mt-1">— {chapter.quoteSource}</span>}
                </blockquote>
              )}
              {chapter.characters.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6">
                  {chapter.characters.map((c) => (
                    <Link key={c.id} href={`/characters/${c.id}`} className="text-xs bg-surface-2 hover:bg-white/10 px-2.5 py-1 rounded-full text-foreground">
                      {c.name}
                    </Link>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between pt-4 border-t border-border-subtle">
                <button
                  onClick={() => setChapterIndex((i) => Math.max(0, i - 1))}
                  disabled={chapterIndex === 0}
                  className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={16} /> Previous
                </button>
                <Link href={`/episodes/${chapter.id}`} className="text-xs text-accent-blue-light hover:underline">
                  View Episode Page
                </Link>
                <button
                  onClick={() => setChapterIndex((i) => Math.min(filtered.length - 1, i + 1))}
                  disabled={chapterIndex >= filtered.length - 1}
                  className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Next <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
          <CharacterAside characters={characters} selectedCharacter={selectedCharacter} onSelect={setSelectedCharacterId} relatedEpisodes={relatedEpisodes} />
        </div>
      )}
    </div>
  );
}

function CharacterAside({
  characters,
  selectedCharacter,
  onSelect,
  relatedEpisodes,
}: {
  characters: PublishedCharacter[];
  selectedCharacter: PublishedCharacter | undefined;
  onSelect: (id: string) => void;
  relatedEpisodes: PublishedEpisode[];
}) {
  if (!selectedCharacter) {
    return (
      <aside>
        <div className="qk-card p-4 text-center text-sm text-muted">No characters yet.</div>
      </aside>
    );
  }

  return (
    <aside>
      <div className="qk-card overflow-hidden sticky top-20">
        <div className="relative aspect-[4/5] bg-surface-2">
          {selectedCharacter.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={selectedCharacter.imageUrl} className="w-full h-full object-cover" alt="" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          {selectedCharacter.isKeyCharacter && (
            <span className="absolute top-3 right-3 text-[10px] bg-accent-blue/80 text-white px-2 py-0.5 rounded-full">Key Character</span>
          )}
          <div className="absolute inset-x-0 bottom-0 p-4">
            <h3 className="text-xl font-bold text-foreground">{selectedCharacter.name}</h3>
            {selectedCharacter.role && <p className="text-xs text-accent-blue-light">{selectedCharacter.role}</p>}
          </div>
        </div>
        <div className="p-4">
          {selectedCharacter.quote && (
            <>
              <p className="text-xs italic text-muted mb-1">&ldquo;{selectedCharacter.quote}&rdquo;</p>
              {selectedCharacter.quoteSource && <p className="text-[11px] text-accent-blue-light mb-3">— {selectedCharacter.quoteSource}</p>}
            </>
          )}
          {selectedCharacter.description && (
            <>
              <p className="text-xs font-semibold text-foreground mb-1">About {selectedCharacter.name}</p>
              <p className="text-xs text-muted leading-relaxed mb-3">{selectedCharacter.description}</p>
            </>
          )}
          <Link
            href={`/characters/${selectedCharacter.id}`}
            className="block w-full text-center text-sm font-medium bg-accent-blue hover:bg-accent-blue-light text-white rounded-lg py-2.5"
          >
            Explore {selectedCharacter.name}&apos;s Journey
          </Link>
        </div>
      </div>
      {relatedEpisodes.length > 1 && <p className="text-[11px] text-muted mt-2 text-center">{relatedEpisodes.length} episodes feature this character.</p>}

      <div className="mt-4">
        <p className="text-xs font-semibold text-muted mb-2">All Characters</p>
        <div className="grid grid-cols-3 gap-2">
          {characters.slice(0, 6).map((c) => (
            <button key={c.id} onClick={() => onSelect(c.id)} className="text-center group">
              {c.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.imageUrl}
                  className={cn("w-full aspect-square rounded-lg object-cover mb-1", selectedCharacter.id === c.id && "ring-2 ring-accent-blue-light")}
                  alt=""
                />
              ) : (
                <div className={cn("w-full aspect-square rounded-lg bg-surface-2 mb-1", selectedCharacter.id === c.id && "ring-2 ring-accent-blue-light")} />
              )}
              <span className="text-[11px] text-muted group-hover:text-foreground line-clamp-1">{c.name}</span>
            </button>
          ))}
        </div>
        <Link href="/characters" className="text-xs text-accent-blue-light hover:underline mt-2 inline-block">
          View All Characters →
        </Link>
      </div>
    </aside>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Play, Star, Search, BookOpen, Users2, Calendar } from "lucide-react";
import { getAllEpisodes, getFeaturedEpisode, getUpcomingEpisodes } from "@/services/episodeService";
import { getCharacterById } from "@/data/characters";
import { formatDate } from "@/lib/utils";
import { StatPill } from "@/components/ui/StatPill";
import { PageBackground } from "@/components/layout/PageBackground";
import { backgrounds } from "@/data/backgrounds";

export default function EpisodesPage() {
  const episodes = getAllEpisodes().filter((e) => !e.upcoming);
  const featured = getFeaturedEpisode();
  const upcoming = getUpcomingEpisodes();
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () => episodes.filter((e) => `${e.title} ${e.topic}`.toLowerCase().includes(search.toLowerCase())),
    [episodes, search]
  );

  return (
    <div className="relative max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <PageBackground src={backgrounds.trailerScreen} opacity={0.4} />
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Episodes</h1>
          <p className="text-muted text-sm mt-1">Story episodes built from the Quest for the Kingdom Scroll.</p>
        </div>
        <div className="relative w-full md:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search episodes..."
            className="w-full bg-surface-2 border border-border-subtle rounded-lg pl-8 pr-3 py-2 text-sm text-foreground placeholder:text-muted"
          />
        </div>
      </div>

      <div className="grid xl:grid-cols-[1fr_300px] gap-6">
        <div>
          {featured && (
            <Link href={`/episodes/${featured.id}`} className="qk-card overflow-hidden md:flex mb-6 group">
              <div className="relative md:w-[55%] aspect-video bg-surface-2">
                <img src={featured.thumbnailUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform" alt="" />
                <span className="absolute top-3 left-3 flex items-center gap-1 text-[11px] bg-accent-gold/90 text-[#231607] px-2 py-0.5 rounded-full font-semibold">
                  <Star size={11} /> Featured Episode
                </span>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-14 h-14 rounded-full bg-black/50 backdrop-blur flex items-center justify-center">
                    <Play size={22} className="text-white ml-1" fill="white" />
                  </div>
                </div>
                <span className="absolute bottom-3 right-3 text-[11px] bg-black/60 text-white px-2 py-0.5 rounded">{featured.durationLabel}</span>
              </div>
              <div className="p-5 flex-1">
                <p className="text-xs text-muted mb-1">
                  Episode {featured.episodeNumber} · Season {featured.season}
                </p>
                <h2 className="text-2xl font-bold text-foreground mb-2">{featured.title}</h2>
                <div className="flex gap-2 text-[11px] mb-3">
                  <span className="bg-surface-2 px-2 py-0.5 rounded-full text-muted">{featured.topic}</span>
                  <span className="bg-surface-2 px-2 py-0.5 rounded-full text-muted">{featured.mainCharacterRole}</span>
                </div>
                <p className="text-sm text-muted leading-relaxed">{featured.description}</p>
                {featured.quote && (
                  <p className="text-xs italic text-muted mt-3">
                    &ldquo;{featured.quote}&rdquo; <span className="not-italic text-accent-blue-light">— {featured.quoteSource}</span>
                  </p>
                )}
              </div>
            </Link>
          )}

          <h2 className="text-lg font-semibold text-foreground mb-4">All Episodes ({episodes.length})</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((ep) => (
              <div key={ep.id} className="qk-card overflow-hidden group">
                <Link href={`/episodes/${ep.id}`} className="block">
                  <div className="relative aspect-video bg-surface-2">
                    <img src={ep.thumbnailUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform" alt="" />
                    <span className="absolute top-2 left-2 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded">
                      S{ep.season} · EP{ep.episodeNumber}
                    </span>
                    <span className="absolute bottom-2 right-2 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded">{ep.durationLabel}</span>
                  </div>
                </Link>
                <div className="p-3">
                  <div className="flex gap-1.5 text-[10px] mb-1.5">
                    <span className="bg-surface-2 px-1.5 py-0.5 rounded-full text-muted">{ep.topic}</span>
                    <span className="bg-surface-2 px-1.5 py-0.5 rounded-full text-muted">{ep.mainCharacterRole}</span>
                  </div>
                  <Link href={`/episodes/${ep.id}`}>
                    <p className="text-sm font-semibold text-foreground hover:text-accent-blue-light">{ep.title}</p>
                  </Link>
                  <p className="text-xs text-muted line-clamp-2 mt-1 mb-3">{ep.description}</p>
                  <div className="flex gap-2">
                    <Link href={`/episodes/${ep.id}`} className="flex-1 text-center text-xs font-medium bg-accent-blue hover:bg-accent-blue-light text-white rounded-lg py-1.5 flex items-center justify-center gap-1">
                      <Play size={11} /> Watch Episode
                    </Link>
                    <Link href={`/backstories/${ep.mainCharacterId}`} className="flex-1 text-center text-xs font-medium border border-border-subtle hover:border-accent-blue-light text-foreground rounded-lg py-1.5">
                      Play Backstory
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="space-y-4">
          <StatPill icon={BookOpen} value={episodes.length} label="Total Episodes Released" />
          <StatPill icon={Users2} value={new Set(episodes.map((e) => e.mainCharacterId)).size} label="Featured Characters" />
          {episodes[0] && <StatPill icon={Calendar} value={formatDate(episodes[0].releaseDate)} label={`Latest Release · ${episodes[0].title}`} />}

          <div className="qk-card p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Upcoming Episodes</h3>
            <div className="space-y-3">
              {upcoming.map((ep) => (
                <div key={ep.id} className="flex items-center gap-2.5">
                  <img src={ep.thumbnailUrl} className="w-11 h-11 rounded-lg object-cover" alt="" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{ep.title}</p>
                    <p className="text-[11px] text-muted">{formatDate(ep.releaseDate)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

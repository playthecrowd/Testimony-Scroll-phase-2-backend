"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Play, Search } from "lucide-react";
import { PublishedEpisode } from "@/types";

export function EpisodesList({ episodes }: { episodes: PublishedEpisode[] }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () => episodes.filter((e) => `${e.title} ${e.topic ?? ""}`.toLowerCase().includes(search.toLowerCase())),
    [episodes, search]
  );

  return (
    <div>
      <div className="relative w-full md:w-64 mb-5 ml-auto">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search episodes..."
          className="w-full bg-surface-2 border border-border-subtle rounded-lg pl-8 pr-3 py-2 text-sm text-foreground placeholder:text-muted"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="qk-card p-10 text-center text-muted text-sm">No episodes match right now.</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((ep) => (
            <Link key={ep.id} href={`/episodes/${ep.id}`} className="qk-card overflow-hidden group block">
              <div className="relative aspect-video bg-surface-2">
                {ep.thumbnailUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ep.thumbnailUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform" alt="" />
                )}
                <span className="absolute top-2 left-2 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded">
                  S{ep.season} · EP{ep.episodeNumber}
                </span>
                {ep.durationLabel && (
                  <span className="absolute bottom-2 right-2 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded">{ep.durationLabel}</span>
                )}
              </div>
              <div className="p-3">
                {ep.topic && <span className="text-[10px] bg-surface-2 px-1.5 py-0.5 rounded-full text-muted">{ep.topic}</span>}
                <p className="text-sm font-semibold text-foreground mt-1.5">{ep.title}</p>
                {ep.description && <p className="text-xs text-muted line-clamp-2 mt-1 mb-2">{ep.description}</p>}
                <span className="inline-flex items-center gap-1 text-xs font-medium text-accent-blue-light">
                  <Play size={11} /> Watch Episode
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

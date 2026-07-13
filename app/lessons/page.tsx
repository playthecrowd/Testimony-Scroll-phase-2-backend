"use client";

import { useMemo, useState } from "react";
import { Search, X, Play, FileText, Presentation } from "lucide-react";
import { getAllLessons } from "@/services/lessonService";
import { churches } from "@/data/churches";
import { speakers } from "@/data/speakers";
import { LessonCard } from "@/components/lessons/LessonCard";
import { StatPill } from "@/components/ui/StatPill";
import { BookOpen, Church, Star, Clock3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageBackground } from "@/components/layout/PageBackground";
import { backgrounds } from "@/data/backgrounds";

const tabs = [
  { key: "all", label: "All Lessons" },
  { key: "video", label: "Video Lessons" },
  { key: "notes", label: "Notes & Slides" },
  { key: "new", label: "Recently Added" },
] as const;

export default function LessonsPage() {
  const lessons = getAllLessons();
  const [church, setChurch] = useState("all");
  const [speaker, setSpeaker] = useState("all");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<(typeof tabs)[number]["key"]>("all");

  const filtered = useMemo(() => {
    return lessons.filter((l) => {
      if (church !== "all" && l.churchId !== church) return false;
      if (speaker !== "all" && l.speakerId !== speaker) return false;
      if (search && !`${l.title} ${l.topic} ${l.tags.join(" ")}`.toLowerCase().includes(search.toLowerCase())) return false;
      if (tab === "video" && !l.contentTypes.includes("video")) return false;
      if (tab === "notes" && !(l.contentTypes.includes("notes") || l.contentTypes.includes("slides"))) return false;
      if (tab === "new" && !l.isNew && !l.createdBySubmission) return false;
      return true;
    });
  }, [lessons, church, speaker, search, tab]);

  return (
    <div className="relative max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <PageBackground src={backgrounds.roadToEaster} opacity={0.42} />
      <div className="grid xl:grid-cols-[1fr_300px] gap-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Lessons</h1>
          <p className="text-muted text-sm mt-1 mb-5">Browse every captured lesson, sermon, class, and study resource.</p>

          <div className="qk-card p-4 mb-5 grid sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
            <FilterField label="Church">
              <select value={church} onChange={(e) => setChurch(e.target.value)} className="qk-input">
                <option value="all">All Churches</option>
                {churches.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </FilterField>
            <FilterField label="Speaker">
              <select value={speaker} onChange={(e) => setSpeaker(e.target.value)} className="qk-input">
                <option value="all">All Speakers</option>
                {speakers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </FilterField>
            <FilterField label="Content Type">
              <div className="flex gap-1.5">
                {[
                  { key: "video", icon: Play },
                  { key: "notes", icon: FileText },
                  { key: "slides", icon: Presentation },
                ].map(({ key, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTab(key === "slides" ? "notes" : (key as typeof tab))}
                    className="qk-input w-10 flex items-center justify-center py-2"
                  >
                    <Icon size={15} />
                  </button>
                ))}
              </div>
            </FilterField>
            <FilterField label="Search">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search topics, keywords..."
                  className="qk-input pl-8"
                />
              </div>
            </FilterField>
            <button
              onClick={() => {
                setChurch("all");
                setSpeaker("all");
                setSearch("");
                setTab("all");
              }}
              className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground justify-center py-2.5"
            >
              <X size={13} /> Clear Filters
            </button>
          </div>

          <div className="flex items-center gap-1 mb-5 border-b border-border-subtle overflow-x-auto qk-scrollbar">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "px-3.5 py-2.5 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors",
                  tab === t.key ? "border-accent-blue-light text-foreground" : "border-transparent text-muted hover:text-foreground"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {filtered.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
              {filtered.map((l) => (
                <LessonCard key={l.id} lesson={l} />
              ))}
            </div>
          ) : (
            <div className="qk-card p-10 text-center text-muted text-sm">No lessons match your filters yet. Try clearing filters.</div>
          )}
        </div>

        <aside className="space-y-4">
          <StatPill icon={BookOpen} value={`${lessons.length}+`} label="Captured Lessons Across all churches" />
          <StatPill icon={Church} value={`${churches.length}+`} label="Churches Participating Sharing Kingdom content" />
          <StatPill icon={Star} value="Faith & Trust" label="Most Viewed Topic" />
          <StatPill icon={Clock3} value={lessons[0]?.title ?? "—"} label="Newest Addition" />
        </aside>
      </div>

      <style jsx global>{`
        .qk-input {
          width: 100%;
          background: var(--surface-2);
          border: 1px solid var(--border-subtle);
          border-radius: 0.5rem;
          padding: 0.55rem 0.75rem;
          font-size: 0.8rem;
          color: var(--foreground);
        }
      `}</style>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-medium text-muted mb-1">{label}</span>
      {children}
    </label>
  );
}

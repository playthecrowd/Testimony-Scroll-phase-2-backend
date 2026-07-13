"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Clock,
  Star,
  Church as ChurchIcon,
  Search,
  Heart,
  MessageCircle,
  Share2,
  Play,
  X,
  BookOpen,
  UserRound,
  ScrollText,
  BookMarked,
  ArrowRight,
} from "lucide-react";
import { getApprovedTestimonies } from "@/services/testimonyService";
import { getCharacterByTestimony } from "@/services/storyService";
import { getLesson } from "@/services/lessonService";
import { getUserById, demoMember } from "@/data/users";
import { PageBackground } from "@/components/layout/PageBackground";
import { backgrounds } from "@/data/backgrounds";
import { cn } from "@/lib/utils";

const filterTabs = ["Latest", "Featured", "By Topic", "By Church"] as const;

export default function KingdomScrollPage() {
  const testimonies = getApprovedTestimonies();
  const [filter, setFilter] = useState<(typeof filterTabs)[number]>("Latest");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(testimonies[0]?.id ?? "");
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  const list = useMemo(() => {
    let items = [...testimonies];
    if (filter === "Featured") items = items.filter((t) => t.likeCount > 600);
    if (search) items = items.filter((t) => `${t.title} ${t.topic}`.toLowerCase().includes(search.toLowerCase()));
    return items;
  }, [testimonies, filter, search]);

  const selected = testimonies.find((t) => t.id === selectedId) ?? testimonies[0];

  return (
    <div className="relative max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <PageBackground src={backgrounds.trailerScreen} opacity={0.4} />

      <h1 className="text-3xl md:text-4xl font-bold text-foreground">Kingdom Scroll</h1>
      <p className="text-muted text-sm mt-1">Real stories. Real people. Real faith in action.</p>
      <p className="text-muted text-xs mt-2 max-w-2xl">
        The Kingdom Scroll is a growing collection of testimonies from believers around the world. Each story is
        living proof of God&apos;s faithfulness.
      </p>

      <Link
        href="/story"
        className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 rounded-2xl border border-accent-blue/40 bg-gradient-to-r from-accent-blue/15 via-accent-purple/10 to-transparent px-5 py-4 qk-glow-blue group"
      >
        <div className="w-10 h-10 rounded-full bg-accent-blue/20 border border-accent-blue/50 flex items-center justify-center text-accent-blue-light shrink-0">
          <BookMarked size={18} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">See how every testimony connects into one story</p>
          <p className="text-xs text-muted">Read the Full Kingdom Story — episodes, characters, and timelines built from this Scroll.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent-blue-light shrink-0">
          Read the Full Story <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
        </span>
      </Link>


      <div className="flex flex-wrap items-center gap-3 my-5">
        <div className="flex items-center gap-1 rounded-lg border border-border-subtle p-1">
          {filterTabs.map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1",
                filter === t ? "bg-accent-blue text-white" : "text-muted hover:text-foreground"
              )}
            >
              {t === "Latest" && <Clock size={12} />}
              {t === "Featured" && <Star size={12} />}
              {t === "By Church" && <ChurchIcon size={12} />}
              {t}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search testimonies..."
            className="w-full bg-surface-2 border border-border-subtle rounded-lg pl-8 pr-3 py-2 text-sm text-foreground placeholder:text-muted"
          />
        </div>
      </div>

      <div className="grid xl:grid-cols-[1fr_380px] gap-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {list.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setSelectedId(t.id);
                setMobileDetailOpen(true);
              }}
              className={cn(
                "relative aspect-[3/4] rounded-xl overflow-hidden text-left group",
                selectedId === t.id && "ring-2 ring-accent-blue-light"
              )}
            >
              <img src={t.thumbnailUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform" alt="" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
              <span className="absolute top-2 left-2 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded">{t.durationLabel}</span>
              <div className="absolute inset-x-0 bottom-0 p-2.5">
                <p className="text-white text-xs font-semibold line-clamp-2 leading-tight">{t.title}</p>
                <p className="text-white/70 text-[10px] mt-1">{displayName(t)}</p>
              </div>
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-9 h-9 rounded-full bg-black/50 backdrop-blur flex items-center justify-center">
                  <Play size={14} className="text-white ml-0.5" fill="white" />
                </div>
              </div>
            </button>
          ))}
          {list.length === 0 && <p className="col-span-full text-center text-muted py-16">No testimonies match your search.</p>}
        </div>

        {/* Desktop fixed detail panel */}
        {selected && (
          <div className="hidden xl:block">
            <div className="qk-card p-4 sticky top-20">
              <ScrollDetail testimony={selected} />
            </div>
          </div>
        )}
      </div>

      {/* Mobile detail drawer */}
      {mobileDetailOpen && selected && (
        <div className="fixed inset-0 z-50 xl:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setMobileDetailOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto qk-scrollbar bg-background rounded-t-2xl p-4 border-t border-border-subtle">
            <div className="flex justify-end mb-2">
              <button onClick={() => setMobileDetailOpen(false)} className="p-2 text-muted hover:text-foreground">
                <X size={18} />
              </button>
            </div>
            <ScrollDetail testimony={selected} />
          </div>
        </div>
      )}
    </div>
  );
}

function displayName(t: ReturnType<typeof getApprovedTestimonies>[number]) {
  const user = getUserById(t.userId) ?? demoMember;
  if (t.identityDisplay === "anonymous") return "Anonymous";
  if (t.identityDisplay === "first-name") return user.fullName.split(" ")[0];
  return user.fullName;
}

function ScrollDetail({ testimony }: { testimony: ReturnType<typeof getApprovedTestimonies>[number] }) {
  const character = getCharacterByTestimony(testimony.id);
  const lesson = getLesson(testimony.primaryLessonId);
  const user = getUserById(testimony.userId) ?? demoMember;

  return (
    <div>
      <div className="relative aspect-video rounded-lg overflow-hidden bg-surface-2 mb-3">
        <img src={testimony.thumbnailUrl} className="w-full h-full object-cover" alt="" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-black/50 backdrop-blur flex items-center justify-center">
            <Play size={18} className="text-white ml-0.5" fill="white" />
          </div>
        </div>
        <div className="absolute right-2 bottom-2 flex flex-col items-center gap-2.5 text-white text-[10px]">
          <span className="flex flex-col items-center gap-0.5">
            <Heart size={16} /> {testimony.likeCount}
          </span>
          <span className="flex flex-col items-center gap-0.5">
            <MessageCircle size={16} /> {testimony.commentCount}
          </span>
          <span className="flex flex-col items-center gap-0.5">
            <Share2 size={16} /> {testimony.shareCount}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <img src={user.avatarUrl} className="w-7 h-7 rounded-full" alt="" />
        <div>
          <p className="text-sm font-medium text-foreground">{displayName(testimony)}</p>
        </div>
      </div>

      <h3 className="text-base font-semibold text-foreground mb-2">{testimony.title}</h3>
      <p className="text-sm text-muted leading-relaxed mb-3">&ldquo;{testimony.writtenTestimony}&rdquo;</p>

      <div className="flex flex-wrap gap-2 mb-4">
        <span className="text-[11px] bg-surface-2 px-2 py-1 rounded-full text-muted">Topic: {testimony.topic}</span>
        <span className="text-[11px] bg-surface-2 px-2 py-1 rounded-full text-muted">{testimony.scripture}</span>
      </div>

      <div className="space-y-2">
        {lesson && (
          <Link href={`/lessons/${lesson.slug}`} className="qk-card p-2.5 flex items-center gap-2 text-xs text-foreground hover:border-accent-blue-light">
            <BookOpen size={13} className="text-accent-blue-light" /> View Related Lesson
          </Link>
        )}
        {character && (
          <Link href={`/characters/${character.id}`} className="qk-card p-2.5 flex items-center gap-2 text-xs text-foreground hover:border-accent-blue-light">
            <UserRound size={13} className="text-accent-blue-light" /> Meet Their Story Character
          </Link>
        )}
        <Link href="/story" className="qk-card p-2.5 flex items-center gap-2 text-xs text-foreground hover:border-accent-blue-light">
          <ScrollText size={13} className="text-accent-blue-light" /> Read Story Contribution
        </Link>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, BookOpen, Users2, Feather, Download, CheckCircle2, Clock, FlaskConical } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { getChurchById, churches } from "@/data/churches";
import { getChurchLessons } from "@/services/churchService";
import { getAllTestimonies, approveTestimony } from "@/services/testimonyService";
import { generateCharacterAndStory } from "@/services/storyService";
import { getLesson } from "@/services/lessonService";
import { StatPill, SectionCard } from "@/components/ui/StatPill";
import { Button, LinkButton } from "@/components/ui/Button";
import { LessonThumbnail } from "@/components/lessons/LessonThumbnail";
import { formatDate } from "@/lib/utils";
import { Testimony } from "@/types";

export default function HostDashboardPage() {
  const { session, ready } = useSession();
  const [pending, setPending] = useState<Testimony[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setPending(getAllTestimonies().filter((t) => t.status === "awaiting-review"));
  }, [tick]);

  if (!ready) return null;
  if (!session.isLoggedIn || session.accountType !== "host") {
    return (
      <div className="max-w-lg mx-auto py-24 text-center px-4">
        <p className="text-foreground font-semibold mb-2">Sign in as a Church Host to view this dashboard.</p>
        <LinkButton href="/login">Sign In</LinkButton>
      </div>
    );
  }

  const church = getChurchById(session.user.churchId ?? churches[0].id) ?? churches[0];
  const lessons = getChurchLessons(church.id);

  function approve(id: string) {
    const t = approveTestimony(id);
    if (t) generateCharacterAndStory(t);
    setTick((v) => v + 1);
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <img src={church.logoUrl} className="w-14 h-14 rounded-xl" alt="" />
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
            <Building2 size={22} className="text-accent-blue-light" /> {church.name} Host Dashboard
          </h1>
          <p className="text-muted text-sm">
            {church.city}, {church.state} · {church.memberCount.toLocaleString()} members
          </p>
        </div>
        <Button variant="secondary" className="sm:ml-auto">
          <Download size={16} /> Export Mock Report
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatPill icon={BookOpen} value={lessons.length} label="Lessons Captured" />
        <StatPill icon={Users2} value={church.memberCount.toLocaleString()} label="Church Members" />
        <StatPill icon={Feather} value={pending.length} label="Testimonies Awaiting Review" />
        <StatPill icon={CheckCircle2} value={lessons.filter((l) => l.createdBySubmission).length} label="Submitted This Session" />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <SectionCard title="Review Member Testimonies" icon={Feather}>
          <div className="space-y-3">
            {pending.map((t) => {
              const lesson = getLesson(t.primaryLessonId);
              return (
                <div key={t.id} className="qk-card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{t.title}</p>
                      <p className="text-xs text-muted truncate">
                        {lesson?.title} · {formatDate(t.submittedAt)}
                      </p>
                    </div>
                    <span className="shrink-0 text-[10px] bg-accent-gold/15 text-accent-gold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Clock size={10} /> Pending
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-2 line-clamp-2">{t.writtenTestimony}</p>
                  <Button size="sm" variant="secondary" className="mt-2.5" onClick={() => approve(t.id)}>
                    <FlaskConical size={13} /> Dev: Approve Testimony
                  </Button>
                </div>
              );
            })}
            {pending.length === 0 && <p className="text-sm text-muted">No testimonies awaiting review.</p>}
          </div>
        </SectionCard>

        <SectionCard title="Recent Lesson Submissions" action="Build a Lesson Experience" actionHref="/experience-builder" icon={BookOpen}>
          <div className="space-y-2.5">
            {lessons.slice(0, 8).map((l) => (
              <Link key={l.id} href={`/lessons/${l.slug}`} className="flex items-center gap-2.5 group">
                <LessonThumbnail src={l.featuredImageUrl} alt="" aspect="square" rounded="rounded-lg" className="w-10 h-10 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground truncate group-hover:text-accent-blue-light">{l.title}</p>
                  <p className="text-[11px] text-muted">{formatDate(l.date)}</p>
                </div>
                {l.createdBySubmission && (
                  <span className="text-[10px] bg-accent-blue/15 text-accent-blue-light px-2 py-0.5 rounded-full shrink-0">New</span>
                )}
              </Link>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

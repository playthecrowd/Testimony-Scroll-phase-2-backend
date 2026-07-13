import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users2, CheckCircle2, BookOpen } from "lucide-react";
import { getChurchBySlug, getChurchById } from "@/data/churches";
import { getChurchLessons } from "@/services/churchService";
import { LessonCard } from "@/components/lessons/LessonCard";
import { PageBackground } from "@/components/layout/PageBackground";
import { backgrounds } from "@/data/backgrounds";

export default async function ChurchDetailPage({ params }: { params: Promise<{ churchId: string }> }) {
  const { churchId } = await params;
  const church = getChurchBySlug(churchId) ?? getChurchById(churchId);
  if (!church) return notFound();
  const lessons = getChurchLessons(church.id);

  return (
    <div className="relative max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <PageBackground src={backgrounds.ticketedExperiences} opacity={0.3} />
      <Link href="/churches" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-4">
        <ArrowLeft size={15} /> Back to Churches
      </Link>

      <div className="qk-card p-5 md:p-6 flex flex-col sm:flex-row items-start gap-5 mb-6">
        <img src={church.logoUrl} className="w-16 h-16 rounded-2xl" alt="" />
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            {church.name} {church.verified && <CheckCircle2 size={16} className="text-accent-blue-light" />}
          </h1>
          <p className="text-sm text-muted mt-1">
            {church.city}, {church.state}
          </p>
          <p className="text-sm text-muted mt-3 max-w-2xl">{church.description}</p>
          <div className="flex flex-wrap gap-4 mt-4 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <Users2 size={13} /> {church.memberCount.toLocaleString()} members
            </span>
            <span className="flex items-center gap-1.5">
              <BookOpen size={13} /> {lessons.length} lessons captured
            </span>
          </div>
        </div>
      </div>

      <h2 className="text-lg font-semibold text-foreground mb-4">Church Archive</h2>
      {lessons.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
          {lessons.map((l) => (
            <LessonCard key={l.id} lesson={l} />
          ))}
        </div>
      ) : (
        <div className="qk-card p-10 text-center text-muted text-sm">No lessons captured for this church yet.</div>
      )}
    </div>
  );
}

import Link from "next/link";
import { Church, Users2, CheckCircle2 } from "lucide-react";
import { churches } from "@/data/churches";
import { getChurchLessons } from "@/services/churchService";
import { PageBackground } from "@/components/layout/PageBackground";
import { backgrounds } from "@/data/backgrounds";

export default function ChurchesPage() {
  return (
    <div className="relative max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <PageBackground src={backgrounds.ticketedExperiences} opacity={0.35} />
      <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
        <Church size={26} className="text-accent-blue-light" /> Churches
      </h1>
      <p className="text-muted text-sm mt-1 mb-6">Explore churches participating in Quest for the Kingdom.</p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {churches.map((c) => {
          const lessonCount = getChurchLessons(c.id).length;
          return (
            <Link key={c.id} href={`/churches/${c.slug}`} className="qk-card p-4 hover:border-accent-blue-light/50 transition-colors">
              <div className="flex items-center gap-3 mb-3">
                <img src={c.logoUrl} className="w-12 h-12 rounded-xl" alt="" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate flex items-center gap-1">
                    {c.name} {c.verified && <CheckCircle2 size={13} className="text-accent-blue-light shrink-0" />}
                  </p>
                  <p className="text-xs text-muted">
                    {c.city}, {c.state}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted line-clamp-2 mb-3">{c.description}</p>
              <div className="flex items-center justify-between text-xs text-muted pt-2 border-t border-border-subtle">
                <span className="flex items-center gap-1">
                  <Users2 size={12} /> {c.memberCount.toLocaleString()} members
                </span>
                <span>{lessonCount} lessons</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

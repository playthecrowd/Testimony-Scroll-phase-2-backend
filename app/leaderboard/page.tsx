"use client";

import { useMemo, useState } from "react";
import { Crown, Trophy } from "lucide-react";
import { getLeaderboard } from "@/services/questService";
import { getAllLessons } from "@/services/lessonService";
import { getUserById, demoMember } from "@/data/users";
import { useSession } from "@/context/SessionContext";
import { cn } from "@/lib/utils";
import { PageBackground } from "@/components/layout/PageBackground";
import { backgrounds } from "@/data/backgrounds";

const scopeTabs = ["Global", "My Church"] as const;

export default function LeaderboardPage() {
  const { session, ready } = useSession();
  const [scope, setScope] = useState<(typeof scopeTabs)[number]>("Global");
  const [lessonFilter, setLessonFilter] = useState("all");
  const lessons = getAllLessons();

  const entries = useMemo(() => {
    let list = getLeaderboard(lessonFilter === "all" ? undefined : lessonFilter);
    if (scope === "My Church" && ready && session.isLoggedIn) {
      list = list.filter((e) => {
        const u = getUserById(e.userId) ?? demoMember;
        return u.churchId === session.user.churchId;
      });
    }
    return list.slice(0, 25);
  }, [scope, lessonFilter, ready, session]);

  return (
    <div className="relative max-w-[1200px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <PageBackground src={backgrounds.featuredSpeakers} opacity={0.35} />
      <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
        <Trophy size={26} className="text-accent-gold" /> Leaderboard
      </h1>
      <p className="text-muted text-sm mt-1 mb-5">See how Kingdom Members rank across quests.</p>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex items-center gap-1 rounded-lg border border-border-subtle p-1">
          {scopeTabs.map((t) => (
            <button
              key={t}
              onClick={() => setScope(t)}
              className={cn(
                "px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors",
                scope === t ? "bg-accent-blue text-white" : "text-muted hover:text-foreground"
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <select
          value={lessonFilter}
          onChange={(e) => setLessonFilter(e.target.value)}
          className="bg-surface-2 border border-border-subtle rounded-lg px-3 py-2 text-sm text-foreground"
        >
          <option value="all">All Lessons</option>
          {lessons.map((l) => (
            <option key={l.id} value={l.id}>
              {l.title}
            </option>
          ))}
        </select>
      </div>

      <div className="qk-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted border-b border-border-subtle">
              <th className="py-3 px-4 font-medium">Rank</th>
              <th className="py-3 px-4 font-medium">Member</th>
              <th className="py-3 px-4 font-medium hidden sm:table-cell">Score</th>
              <th className="py-3 px-4 font-medium hidden md:table-cell">Time</th>
              <th className="py-3 px-4 font-medium hidden md:table-cell">Date</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const isMe = ready && session.isLoggedIn && entry.userId === session.user.id;
              return (
                <tr key={entry.userId + entry.lessonId + entry.rank} className={cn("border-b border-border-subtle/60", isMe && "bg-accent-blue/10")}>
                  <td className="py-3 px-4 font-medium text-foreground">
                    {entry.rank <= 3 && <Crown size={13} className="text-accent-gold inline mr-1" />}
                    {entry.rank}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <img src={entry.userAvatarUrl} className="w-7 h-7 rounded-full" alt="" />
                      <span className={cn(isMe ? "text-accent-blue-light font-medium" : "text-foreground")}>
                        {isMe ? `${entry.userName} (You)` : entry.userName}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 hidden sm:table-cell font-semibold text-foreground">{entry.score.toLocaleString()}</td>
                  <td className="py-3 px-4 hidden md:table-cell text-muted">{entry.time}</td>
                  <td className="py-3 px-4 hidden md:table-cell text-muted">{entry.date}</td>
                </tr>
              );
            })}
            {entries.length === 0 && (
              <tr>
                <td colSpan={5} className="py-10 text-center text-muted">
                  No quest results yet for this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

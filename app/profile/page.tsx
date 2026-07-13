"use client";

import { useEffect, useState } from "react";
import { User, Mail, Church as ChurchIcon, Award, Map, Feather } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { getChurchById } from "@/data/churches";
import { getUserJourneys } from "@/services/journeyService";
import { getUserBadges } from "@/services/badgeService";
import { getUserTestimonies } from "@/services/testimonyService";
import { StatPill } from "@/components/ui/StatPill";
import { LinkButton } from "@/components/ui/Button";

export default function ProfilePage() {
  const { session, ready } = useSession();
  const [counts, setCounts] = useState({ journeys: 0, badges: 0, testimonies: 0 });

  useEffect(() => {
    if (ready && session.isLoggedIn) {
      setCounts({
        journeys: getUserJourneys(session.user.id).length,
        badges: getUserBadges(session.user.id).length,
        testimonies: getUserTestimonies(session.user.id).length,
      });
    }
  }, [ready, session]);

  if (!ready) return null;
  if (!session.isLoggedIn) {
    return (
      <div className="max-w-lg mx-auto py-24 text-center px-4">
        <p className="text-foreground font-semibold mb-2">Sign in to view your profile.</p>
        <LinkButton href="/login">Sign In</LinkButton>
      </div>
    );
  }

  const church = session.user.churchId ? getChurchById(session.user.churchId) : undefined;

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 md:py-8">
      <div className="qk-card p-6 flex flex-col sm:flex-row items-center sm:items-start gap-5 mb-6">
        <img src={session.user.avatarUrl} className="w-20 h-20 rounded-full" alt="" />
        <div className="text-center sm:text-left">
          <h1 className="text-2xl font-bold text-foreground">{session.user.fullName}</h1>
          <p className="text-sm text-accent-blue-light font-medium">
            {session.accountType === "host" ? "Church Host" : "Kingdom Member"}
          </p>
          <div className="flex flex-wrap justify-center sm:justify-start gap-4 mt-3 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <Mail size={13} /> {session.user.email}
            </span>
            {church && (
              <span className="flex items-center gap-1.5">
                <ChurchIcon size={13} /> {church.name}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatPill icon={Map} value={counts.journeys} label="Active Journeys" />
        <StatPill icon={Award} value={counts.badges} label="Badges Earned" />
        <StatPill icon={Feather} value={counts.testimonies} label="Testimonies" />
      </div>

      <div className="qk-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <User size={15} className="text-accent-blue-light" /> Account Details
        </h3>
        <div className="space-y-2 text-sm">
          <Row label="Full Name" value={session.user.fullName} />
          <Row label="Email" value={session.user.email} />
          <Row label="Account Type" value={session.accountType === "host" ? "Church Host" : "Kingdom Member"} />
          <Row label="Member Since" value={new Date(session.user.createdAt).toLocaleDateString()} />
        </div>
        <p className="text-[11px] text-muted mt-4">
          Profile editing, avatar upload, and account settings connect to production auth in Phase Two.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border-subtle/60 last:border-0">
      <span className="text-muted">{label}</span>
      <span className="text-foreground font-medium">{value}</span>
    </div>
  );
}

import { LinkButton } from "@/components/ui/Button";
import { JourneyStagesBar } from "@/components/journey/JourneyStagesBar";
import { Compass, Church, Users2, ScrollText } from "lucide-react";
import { PageBackground } from "@/components/layout/PageBackground";
import { backgrounds } from "@/data/backgrounds";

export default function AboutPage() {
  return (
    <div className="relative max-w-4xl mx-auto px-4 md:px-8 py-10 md:py-14">
      <PageBackground src={backgrounds.roadToEaster} opacity={0.4} />
      <h1 className="text-3xl md:text-5xl font-extrabold text-foreground leading-tight">
        Every lesson becomes a{" "}
        <span className="bg-gradient-to-r from-accent-blue-light to-accent-purple bg-clip-text text-transparent">journey.</span>
      </h1>
      <p className="text-muted mt-4 max-w-2xl">
        Quest for the Kingdom transforms church lessons into a complete member journey — from the moment a sermon
        is captured to the moment a testimony becomes part of the Kingdom&apos;s unfolding story.
      </p>

      <div className="qk-card p-5 mt-8 overflow-x-auto qk-scrollbar">
        <JourneyStagesBar />
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mt-8">
        <InfoCard icon={Church} title="For Churches" desc="Capture sermons, lessons, notes, slides, audio, and video links, then build a searchable lesson archive your whole church can use." />
        <InfoCard icon={Compass} title="For Members" desc="Study lessons, join interactive 3D Quest experiences, track scores on the leaderboard, and earn badges as you grow." />
        <InfoCard icon={Users2} title="Testimonies" desc="Submit a testimony connected to what you studied, and see it reviewed and approved by your church host." />
        <InfoCard icon={ScrollText} title="The Kingdom Scroll" desc="Approved testimonies become AI-generated story characters and contributions, woven into one connected Kingdom story." />
      </div>

      <div className="qk-card p-6 text-center mt-10">
        <h2 className="text-xl font-bold text-foreground mb-2">Ready to begin?</h2>
        <p className="text-sm text-muted mb-5">Join thousands of believers already on the journey.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <LinkButton href="/signup">Join the Journey</LinkButton>
          <LinkButton href="/churches" variant="secondary">
            Explore Churches
          </LinkButton>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <div className="qk-card p-4">
      <div className="w-10 h-10 rounded-lg bg-accent-blue/15 border border-accent-blue/30 flex items-center justify-center text-accent-blue-light mb-3">
        <Icon size={18} />
      </div>
      <h3 className="text-sm font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-xs text-muted leading-relaxed">{desc}</p>
    </div>
  );
}

import { CalendarHeart, ArrowRight, Sparkles } from "lucide-react";
import { featuredEvent } from "@/data/featuredEvent";
import { PageBackground } from "@/components/layout/PageBackground";
import { backgrounds } from "@/data/backgrounds";

export default function EventsPage() {
  return (
    <div className="relative max-w-[1200px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <PageBackground src={backgrounds.featuredSpeakers} opacity={0.45} />

      <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
        <CalendarHeart size={26} className="text-accent-gold" /> Events
      </h1>
      <p className="text-muted text-sm mt-1 mb-6">Kingdom-wide campaigns and events happening across the network.</p>

      {/* Featured event — big presence */}
      <a
        href={featuredEvent.href}
        target="_blank"
        rel="noopener noreferrer"
        className="relative block rounded-2xl overflow-hidden group border border-accent-gold/40 qk-glow-gold mb-8"
      >
        <div className="absolute inset-0">
          <img src={featuredEvent.imageUrl} alt="" className="w-full h-full object-cover opacity-45 group-hover:scale-105 transition-transform duration-300" />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(6,10,20,0.55) 0%, rgba(6,10,20,0.92) 80%, rgba(6,10,20,1) 100%)",
            }}
          />
        </div>
        <div className="relative px-6 py-10 md:px-10 md:py-14 text-center">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-accent-gold bg-accent-gold/10 border border-accent-gold/40 px-2.5 py-1 rounded-full mb-4">
            <Sparkles size={12} /> {featuredEvent.tagline}
          </span>
          <h2 className="text-3xl md:text-5xl font-extrabold text-foreground mb-3">{featuredEvent.title}</h2>
          <p className="text-sm md:text-base text-muted max-w-xl mx-auto mb-6">{featuredEvent.description}</p>
          <span className="inline-flex items-center justify-center gap-1.5 bg-accent-gold hover:brightness-110 text-[#231607] text-sm font-semibold px-6 py-3.5 rounded-lg">
            Learn More <ArrowRight size={15} />
          </span>
        </div>
      </a>

      <div className="qk-card p-6 text-center text-sm text-muted">
        More Kingdom-wide events will appear here as churches add them. Check back soon.
      </div>
    </div>
  );
}

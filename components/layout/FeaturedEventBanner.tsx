import Image from "next/image";
import { CalendarHeart, ArrowRight } from "lucide-react";
import { featuredEvent } from "@/data/featuredEvent";

export function FeaturedEventBanner() {
  return (
    <a
      href={featuredEvent.href}
      target="_blank"
      rel="noopener noreferrer"
      className="relative block rounded-2xl overflow-hidden group border border-accent-gold/40 qk-glow-gold"
    >
      <div className="absolute inset-0">
        <Image
          src={featuredEvent.imageUrl}
          alt=""
          fill
          sizes="100vw"
          className="object-cover opacity-45 group-hover:scale-105 transition-transform duration-300"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, rgba(6,10,20,0.95) 0%, rgba(6,10,20,0.75) 45%, rgba(6,10,20,0.35) 100%)",
          }}
        />
      </div>
      <div className="relative px-5 py-6 md:px-8 md:py-8 flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-accent-gold bg-accent-gold/10 border border-accent-gold/40 px-2.5 py-1 rounded-full w-fit">
          <CalendarHeart size={12} /> {featuredEvent.tagline}
        </span>
        <div className="flex-1">
          <h3 className="text-xl md:text-2xl font-bold text-foreground">{featuredEvent.title}</h3>
          <p className="text-sm text-muted mt-1 max-w-xl">{featuredEvent.description}</p>
        </div>
        <span className="inline-flex items-center justify-center gap-1.5 shrink-0 bg-accent-gold hover:brightness-110 text-[#231607] text-sm font-semibold px-5 py-3 rounded-lg w-fit">
          Learn More <ArrowRight size={15} />
        </span>
      </div>
    </a>
  );
}

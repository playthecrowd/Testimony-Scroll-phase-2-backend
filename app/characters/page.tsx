import Link from "next/link";
import { Users2 } from "lucide-react";
import { seedCharacters } from "@/data/characters";
import { PageBackground } from "@/components/layout/PageBackground";
import { backgrounds } from "@/data/backgrounds";

export default function CharactersPage() {
  return (
    <div className="relative max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <PageBackground src={backgrounds.trailerScreen} opacity={0.35} />
      <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
        <Users2 size={26} className="text-accent-blue-light" /> Story Characters
      </h1>
      <p className="text-muted text-sm mt-1 mb-6">
        Characters generated from approved testimonies, carrying real Kingdom stories forward.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {seedCharacters.map((c) => (
          <Link key={c.id} href={`/characters/${c.id}`} className="group">
            <div className="relative aspect-[4/5] rounded-xl overflow-hidden bg-surface-2">
              <img src={c.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform" alt="" />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-3">
                <p className="text-sm font-semibold text-foreground">{c.name}</p>
                <p className="text-[11px] text-accent-blue-light">{c.role}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

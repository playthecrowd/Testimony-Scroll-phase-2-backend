import { Coins, Users, Clock, MapPin } from "lucide-react";
import { DemoShell } from "@/components/workforce/demo/DemoShell";
import { EXPERIENCE_USE_CASES } from "@/lib/workforceDemo";

export const metadata = { title: "Attractions — Plotabl Workforce (Demo)" };

// A4: Attractions / Experience Library. Mock-data-driven -- see EXPERIENCE_USE_CASES in
// lib/workforceDemo.ts. This is the org-wide reusable catalog, independent of any one department
// -- "Select for Decision" is deliberately routed through a real decision/department context
// (Department Experience Catalog) rather than silently assigning it from here.
export default function WorkforceDemoAttractionsPage() {
  return (
    <DemoShell pageType="attractions" searchPlaceholder="Search experiences by capability or focus…">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Attractions</h1>
          <p className="text-sm text-muted mt-1">The complete Plotabl Workforce experience library, independent of any single department.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {EXPERIENCE_USE_CASES.map((exp) => (
            <div key={exp.title} className="qk-card rounded-xl p-4">
              {exp.recommended && <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent-gold/15 text-accent-gold mb-2">Recommended</span>}
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-1">{exp.capability}</div>
              <div className="text-sm font-semibold text-foreground mb-1">{exp.title}</div>
              <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full bg-accent-blue/10 text-accent-blue mb-2">{exp.focus}</span>
              <p className="text-xs text-muted mb-3">{exp.description}</p>
              <div className="grid grid-cols-2 gap-1.5 text-[11px] text-muted mb-3">
                <span className="flex items-center gap-1"><Clock size={11} /> {exp.durationMin} min</span>
                <span className="flex items-center gap-1"><Users size={11} /> Up to {exp.capacity}</span>
                <span className="flex items-center gap-1"><Coins size={11} /> {exp.creditCost} credits</span>
                <span className="flex items-center gap-1"><MapPin size={11} /> {exp.locations.join(", ")}</span>
              </div>
              <p className="text-[10px] text-muted mb-3">{exp.techRequirements}</p>
              <div className="flex gap-2">
                <button className="flex-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors">Preview</button>
                <button className="flex-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors">Requirements</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DemoShell>
  );
}

import Link from "next/link";
import { Target, Layers, CalendarClock, Users2, BarChart3, Building2, Handshake } from "lucide-react";
import { WorkforceLogo } from "./WorkforceLogo";

const FEATURES = [
  { icon: Target, title: "Decision Tracking", body: "Follow every decision from stakeholder intent through workforce implementation, in one pathway." },
  { icon: Layers, title: "Experience Opportunities", body: "Match each decision to a purpose-built Plotabl experience -- demonstration, training, or practice." },
  { icon: CalendarClock, title: "Session Delivery", body: "Propose, approve, and schedule sessions with a clear admission and credit model." },
  { icon: Users2, title: "Collaborative POV", body: "Managers and mentors observe, coach, and compare participant viewpoints in real time." },
  { icon: BarChart3, title: "Analytics & Evidence", body: "Turn session activity into readiness scores and evidence returned to the original decision." },
  { icon: Building2, title: "Vendor Fulfillment", body: "Approved delivery partners scope and produce custom experiences within a defined engagement." },
  { icon: Handshake, title: "Enterprise Partnerships", body: "One platform for every department, from executive intent to the people doing the work." },
];

const PATHWAY = ["Stakeholder", "Department Leadership", "Manager", "Employee"];

export function WorkforcePublicHomepage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 md:px-10 h-16 flex items-center justify-between border-b border-border-subtle">
        <WorkforceLogo />
        <nav className="flex items-center gap-3">
          <Link href="/workforce/login" className="text-sm font-medium text-foreground hover:text-accent-blue px-3 py-2">
            Sign In
          </Link>
          <Link
            href="/workforce/signup"
            className="text-sm font-semibold px-4 py-2 rounded-lg bg-accent-blue text-[#16210a] hover:bg-accent-blue-light transition-colors"
          >
            Get Started
          </Link>
        </nav>
      </header>

      <section className="px-6 md:px-10 py-20 md:py-28 max-w-4xl">
        <h1 className="text-4xl md:text-5xl font-bold text-foreground leading-[1.1] text-balance">
          Move every decision from intent to understanding, action, and measurable outcomes.
        </h1>
        <p className="mt-6 text-lg text-muted max-w-2xl">
          Plotabl Workforce connects decisions to the people, experiences, sessions, and evidence required to bring them to life.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/workforce/signup"
            className="text-sm font-semibold px-5 py-3 rounded-lg bg-accent-blue text-[#16210a] hover:bg-accent-blue-light transition-colors"
          >
            Get Started
          </Link>
          <Link
            href="/workforce/login"
            className="text-sm font-semibold px-5 py-3 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors"
          >
            Sign In
          </Link>
        </div>
      </section>

      <section className="px-6 md:px-10 py-12 border-y border-border-subtle bg-surface-2/60">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted mb-6">The reporting chain every decision travels</h2>
        <div className="flex flex-wrap items-center gap-3">
          {PATHWAY.map((step, i) => (
            <div key={step} className="flex items-center gap-3">
              <span className="px-4 py-2 rounded-full border border-accent-gold/40 bg-accent-gold/10 text-sm font-medium text-foreground">
                {step}
              </span>
              {i < PATHWAY.length - 1 && <span className="text-accent-gold">→</span>}
            </div>
          ))}
        </div>
      </section>

      <section className="px-6 md:px-10 py-16 md:py-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <div key={f.title} className="qk-card p-5 rounded-2xl">
              <f.icon size={22} className="text-accent-blue mb-3" />
              <h3 className="font-semibold text-foreground mb-1.5">{f.title}</h3>
              <p className="text-sm text-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mt-auto px-6 md:px-10 py-8 border-t border-border-subtle text-xs text-muted flex items-center justify-between">
        <span>Plotabl Workforce</span>
        <span>A Plotabl Central module</span>
      </footer>
    </div>
  );
}

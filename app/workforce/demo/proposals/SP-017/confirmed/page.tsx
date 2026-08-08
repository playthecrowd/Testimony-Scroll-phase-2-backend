import Link from "next/link";
import { Check, Copy, LayoutGrid, ListChecks, UserCheck, Calendar as CalendarIcon, Compass, Users, ClipboardCheck } from "lucide-react";
import { DemoShell, DemoNavItem } from "@/components/workforce/demo/DemoShell";
import { SESSION, SESSION_PROPOSAL } from "@/lib/workforceDemo";

export const metadata = { title: "Booking Confirmed — Plotabl Workforce (Demo)" };

// SP-04: Booking Confirmation. Reached only after SP-02's Approve action. The join URL is a real,
// working link -- it goes to the actual Session Control page for FF-042, not a dead placeholder.
export default function BookingConfirmationPage() {
  const joinUrl = `plotabl.workforce/join/${SESSION.id}`;

  return (
    <DemoShell
      pageType="booking-confirmation"
      searchPlaceholder="Search decisions, people, experiences…"
      nav={
        <>
          <DemoNavItem href="/workforce/demo" label="Decision Pool" icon={LayoutGrid} />
          <DemoNavItem href="/workforce/demo" label="My Decisions" icon={ListChecks} />
          <DemoNavItem href="/workforce/demo" label="Assigned to Me" icon={UserCheck} />
          <DemoNavItem href="/workforce/demo" label="Sessions" icon={CalendarIcon} />
          <DemoNavItem href="/workforce/demo" label="Attractions" icon={Compass} />
          <DemoNavItem href="/workforce/demo" label="People & Teams" icon={Users} />
          <DemoNavItem href="/workforce/demo/decisions/D-2048/evidence" label="Evidence & Outcomes" icon={ClipboardCheck} />
        </>
      }
    >
      <div className="max-w-[600px] mx-auto px-4 md:px-8 py-16 text-center space-y-6">
        <div className="w-14 h-14 rounded-full bg-accent-blue/15 border border-accent-blue/40 flex items-center justify-center mx-auto">
          <Check size={26} className="text-accent-blue" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Session Approved & Booked</h1>
          <p className="text-sm text-muted mt-2">
            Proposal {SESSION_PROPOSAL.id} was approved. {SESSION.title} is now scheduled for {new Date(SESSION.startsAt).toLocaleDateString(undefined, { month: "long", day: "numeric" })}.
          </p>
        </div>
        <div className="qk-card rounded-xl p-4 flex items-center justify-between gap-3 text-left">
          <div className="min-w-0">
            <div className="text-[11px] text-muted">Unique join URL</div>
            <div className="text-sm font-mono text-foreground truncate">{joinUrl}</div>
          </div>
          <button className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors shrink-0">
            <Copy size={13} /> Copy
          </button>
        </div>
        <Link
          href="/workforce/demo/sessions/FF-042/control"
          className="inline-block text-sm font-semibold px-5 py-3 rounded-lg bg-accent-blue text-[#16210a] hover:bg-accent-blue-light transition-colors"
        >
          Go to Session Overview
        </Link>
      </div>
    </DemoShell>
  );
}

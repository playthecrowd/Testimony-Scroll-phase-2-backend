"use client";

import { useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, RotateCw, MessageSquare, AlertCircle } from "lucide-react";
import { DemoShell } from "@/components/workforce/demo/DemoShell";
import { WorkforceAvatar } from "@/components/workforce/WorkforceAvatar";
import { SESSION, findPerson } from "@/lib/workforceDemo";

const CHECKS = [
  { label: "Browser", ok: true },
  { label: "Audio", ok: true },
  { label: "Video", ok: true },
  { label: "Network", ok: true },
  { label: "3D Compatibility", ok: true },
];

const FAQ = [
  { q: "What if I lose connection during the session?", a: "Rejoin using the same invitation link -- your progress and admitted status are preserved." },
  { q: "Do I need a VR headset?", a: "No, the mobile avatar experience works fully in-browser. VR is optional for the collaborative breakout." },
];

// D7: Employee Help. Mock-data-driven -- device-check status, controls guide, FAQ, and a facilitator
// contact channel, with no administrative tools exposed.
export default function WorkforceDemoHelpPage({ params }: { params: Promise<{ sessionId: string }> }) {
  void params;
  if (SESSION.id !== "FF-042") notFound();
  const [sent, setSent] = useState(false);
  const host = findPerson(SESSION.hostId);

  return (
    <DemoShell pageType="my-session-help" searchPlaceholder="Search help topics…">
      <div className="max-w-[800px] mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Help</h1>
          <p className="text-sm text-muted mt-1">Technical assistance and session guidance.</p>
        </div>

        <div className="qk-card rounded-2xl p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Device Check</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
            {CHECKS.map((c) => (
              <div key={c.label} className="text-center">
                <CheckCircle2 size={16} className="text-accent-blue mx-auto mb-1" />
                <div className="text-[10px] text-muted">{c.label}</div>
              </div>
            ))}
          </div>
          <button className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors"><RotateCw size={11} /> Run Device Check Again</button>
        </div>

        <div className="qk-card rounded-2xl p-4">
          <h2 className="text-sm font-semibold text-foreground mb-2">Controls Guide</h2>
          <p className="text-xs text-muted">Move with WASD or the on-screen joystick. Tap a highlighted object to inspect it. Use the checkpoint panel to confirm each inspection step.</p>
        </div>

        <div className="qk-card rounded-2xl p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Session FAQ</h2>
          <div className="space-y-3">
            {FAQ.map((f) => (
              <div key={f.q}>
                <div className="text-xs font-semibold text-foreground">{f.q}</div>
                <div className="text-xs text-muted mt-0.5">{f.a}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="qk-card rounded-2xl p-4 flex items-center gap-3">
          <WorkforceAvatar name={host.name} imageUrl={host.portraitUrl} size="md" />
          <div className="min-w-0 flex-1">
            <div className="text-xs text-muted">Facilitator</div>
            <div className="text-sm font-semibold text-foreground">{host.name}</div>
          </div>
          <button
            onClick={() => setSent(true)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-accent-blue text-[#16210a] hover:bg-accent-blue-light transition-colors shrink-0"
          >
            <MessageSquare size={12} /> {sent ? "Message Sent" : "Message Facilitator"}
          </button>
        </div>

        {sent && (
          <p className="text-xs text-accent-blue flex items-center gap-1.5"><AlertCircle size={12} /> Your message was sent to {host.name} for this session (FF-042).</p>
        )}

        <Link href="/workforce/demo/my-session/FF-042/world" className="inline-block text-xs font-semibold text-accent-blue hover:underline">← Return to Session</Link>
      </div>
    </DemoShell>
  );
}

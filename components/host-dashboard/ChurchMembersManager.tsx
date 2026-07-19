"use client";

import { useState } from "react";
import { Send, Users2, Mail } from "lucide-react";
import { SectionCard } from "@/components/ui/StatPill";
import { Button } from "@/components/ui/Button";
import { ShareLinkCard } from "@/components/ui/ShareLinkCard";
import { formatDate } from "@/lib/utils";
import { PublishedChurch, ChurchMember, ChurchInvite } from "@/types";
import { createInvitesAction, revokeInviteAction } from "@/app/host-dashboard/members/actions";

function splitEmails(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function ChurchMembersManager({
  church,
  members,
  invites: initialInvites,
}: {
  church: PublishedChurch;
  members: ChurchMember[];
  invites: ChurchInvite[];
}) {
  const [singleEmail, setSingleEmail] = useState("");
  const [bulkEmails, setBulkEmails] = useState("");
  const [invites, setInvites] = useState(initialInvites);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function sendInvites(emails: string[]) {
    setError("");
    setMessage("");
    if (emails.length === 0) return;
    setSubmitting(true);
    const result = await createInvitesAction({ churchId: church.id, emails });
    setSubmitting(false);

    if (result.error && !result.created?.length) {
      setError(result.error);
      return;
    }
    if (result.created?.length) {
      setInvites((prev) => [...result.created!, ...prev]);
    }
    const parts: string[] = [];
    if (result.created?.length) parts.push(`${result.created.length} invite${result.created.length === 1 ? "" : "s"} created.`);
    if (result.invalidEmails?.length) parts.push(`${result.invalidEmails.length} address(es) weren't valid emails and were skipped.`);
    if (result.failedEmails?.length) parts.push(`${result.failedEmails.length} address(es) couldn't be invited (maybe already pending).`);
    setMessage(parts.join(" "));
  }

  async function handleSingleInvite(e: React.FormEvent) {
    e.preventDefault();
    await sendInvites([singleEmail]);
    setSingleEmail("");
  }

  async function handleBulkInvite(e: React.FormEvent) {
    e.preventDefault();
    await sendInvites(splitEmails(bulkEmails));
    setBulkEmails("");
  }

  async function handleRevoke(inviteId: string) {
    const result = await revokeInviteAction(inviteId);
    if (result.error) {
      setError(result.error);
      return;
    }
    setInvites((prev) => prev.map((i) => (i.id === inviteId ? { ...i, status: "revoked" } : i)));
  }

  const pendingInvites = invites.filter((i) => i.status === "pending");

  return (
    <div className="space-y-5">
      <SectionCard title="Share & QR Code" icon={Users2}>
        <p className="text-xs text-muted mb-3">
          Anyone with this link can join {church.name} as a Kingdom Member once they&apos;re signed in.
        </p>
        <ShareLinkCard path={`/join/${church.slug}`} />
      </SectionCard>

      <div className="grid lg:grid-cols-2 gap-5">
        <SectionCard title="Invite by Email" icon={Mail}>
          <form onSubmit={handleSingleInvite} className="flex gap-2">
            <input
              type="email"
              required
              value={singleEmail}
              onChange={(e) => setSingleEmail(e.target.value)}
              placeholder="member@email.com"
              className="qk-input flex-1"
            />
            <Button type="submit" size="sm" disabled={submitting}>
              <Send size={13} /> Invite
            </Button>
          </form>
        </SectionCard>

        <SectionCard title="Bulk Import (CSV / paste)" icon={Users2}>
          <form onSubmit={handleBulkInvite} className="space-y-2">
            <textarea
              value={bulkEmails}
              onChange={(e) => setBulkEmails(e.target.value)}
              rows={3}
              placeholder={"One email per line or comma-separated:\nalice@email.com, bob@email.com"}
              className="qk-input w-full"
            />
            <Button type="submit" size="sm" variant="secondary" disabled={submitting || !bulkEmails.trim()}>
              Import Emails
            </Button>
          </form>
        </SectionCard>
      </div>

      {error && <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>}
      {message && !error && <p className="text-sm text-accent-blue-light">{message}</p>}

      {pendingInvites.length > 0 && (
        <SectionCard title={`Pending Invites (${pendingInvites.length})`} icon={Mail}>
          <div className="space-y-2">
            {pendingInvites.map((invite) => (
              <div key={invite.id} className="flex items-center justify-between gap-2 qk-card p-3">
                <div className="min-w-0">
                  <p className="text-sm text-foreground truncate">{invite.email}</p>
                  <p className="text-[11px] text-muted">Invited {formatDate(invite.createdAt)}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => handleRevoke(invite.id)}>
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <SectionCard title={`Members (${members.length})`} icon={Users2}>
        {members.length === 0 ? (
          <p className="text-sm text-muted">No members yet -- share your join link or send an invite to get started.</p>
        ) : (
          <div className="space-y-2">
            {members.map((m) => (
              <div key={m.membershipId} className="flex items-center justify-between gap-2 qk-card p-3">
                <div className="min-w-0">
                  <p className="text-sm text-foreground truncate">{m.fullName || m.email}</p>
                  <p className="text-[11px] text-muted truncate">
                    {m.email} · Joined {formatDate(m.joinedAt)}
                  </p>
                </div>
                <span className="shrink-0 text-[10px] bg-accent-blue/15 text-accent-blue-light px-2 py-0.5 rounded-full capitalize">
                  {m.role}
                </span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

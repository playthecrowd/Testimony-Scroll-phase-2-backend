"use client";

import { useState } from "react";
import { Send, Mic } from "lucide-react";
import { Field } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { PublishedChurch } from "@/types";
import { submitSpeakerRequestAction } from "./actions";

export function BecomeASpeakerForm({ churches, defaultChurchId }: { churches: PublishedChurch[]; defaultChurchId?: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [churchAffiliation, setChurchAffiliation] = useState("");
  const [churchId, setChurchId] = useState(defaultChurchId ?? "");
  const [topic, setTopic] = useState("");
  const [bio, setBio] = useState("");
  const [message, setMessage] = useState("");
  const [headshotUrl, setHeadshotUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const result = await submitSpeakerRequestAction({
      name,
      email,
      phone,
      churchAffiliation,
      churchId: churchId || null,
      topic,
      bio,
      message,
      headshotUrl,
    });
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="qk-card p-6 text-center">
        <Mic size={28} className="text-accent-gold mx-auto mb-3" />
        <p className="text-base font-semibold text-foreground mb-1.5">Thank you for stepping forward</p>
        <p className="text-sm text-muted">Your speaker request has been submitted for review. We&apos;ll be in touch soon.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="qk-card p-5 space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Full Name" required>
          <input value={name} onChange={(e) => setName(e.target.value)} className="qk-input" />
        </Field>
        <Field label="Email" required>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="qk-input" />
        </Field>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Phone">
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="qk-input" />
        </Field>
        <Field label="Church Affiliation">
          <input
            value={churchAffiliation}
            onChange={(e) => setChurchAffiliation(e.target.value)}
            placeholder="e.g., Grace Community Church"
            className="qk-input"
          />
        </Field>
      </div>

      <Field label="Church (if you're connected to one on Quest for the Kingdom)">
        <select value={churchId} onChange={(e) => setChurchId(e.target.value)} className="qk-input">
          <option value="">Not listed / no church selected</option>
          {churches.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Speaker Topic / Category">
        <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g., Youth discipleship, marriage, evangelism" className="qk-input" />
      </Field>

      <Field label="Short Bio">
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="qk-input resize-none" />
      </Field>

      <Field label="Message / Request Details">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          placeholder="Tell us more about what you'd like to speak about, and any experience relevant to it."
          className="qk-input resize-none"
        />
      </Field>

      <Field label="Profile Image / Headshot URL (optional)">
        <input value={headshotUrl} onChange={(e) => setHeadshotUrl(e.target.value)} placeholder="https://..." className="qk-input" />
      </Field>

      {error && <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>}

      <Button type="submit" disabled={submitting}>
        <Send size={16} /> {submitting ? "Submitting..." : "Submit Speaker Request"}
      </Button>
    </form>
  );
}

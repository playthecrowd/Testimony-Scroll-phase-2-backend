"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Field } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { EpisodeInput } from "@/services/supabase/episodes";
import { PublishedEpisode } from "@/types";
import { createEpisodeAction, updateEpisodeAction } from "@/app/admin/episodes/actions";

export function EpisodeForm({ episode }: { episode?: PublishedEpisode }) {
  const router = useRouter();
  const [season, setSeason] = useState(String(episode?.season ?? 1));
  const [episodeNumber, setEpisodeNumber] = useState(String(episode?.episodeNumber ?? 1));
  const [title, setTitle] = useState(episode?.title ?? "");
  const [description, setDescription] = useState(episode?.description ?? "");
  const [durationLabel, setDurationLabel] = useState(episode?.durationLabel ?? "");
  const [topic, setTopic] = useState(episode?.topic ?? "");
  const [scripture, setScripture] = useState(episode?.scripture ?? "");
  const [thumbnailUrl, setThumbnailUrl] = useState(episode?.thumbnailUrl ?? "");
  const [quote, setQuote] = useState(episode?.quote ?? "");
  const [quoteSource, setQuoteSource] = useState(episode?.quoteSource ?? "");
  const [featured, setFeatured] = useState(episode?.featured ?? false);
  const [releaseDate, setReleaseDate] = useState(episode?.releaseDate ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const input: EpisodeInput = {
      season: Number(season) || 1,
      episodeNumber: Number(episodeNumber) || 1,
      title,
      description,
      durationLabel,
      topic,
      scripture,
      thumbnailUrl,
      quote,
      quoteSource,
      featured,
      releaseDate,
    };
    const result = episode ? await updateEpisodeAction(episode.id, input) : await createEpisodeAction(input);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.push(episode ? `/admin/episodes/${episode.id}/edit` : `/admin/episodes/${result.id}/edit`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="qk-card p-5 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Season" required>
          <input type="number" min={1} value={season} onChange={(e) => setSeason(e.target.value)} className="qk-input" />
        </Field>
        <Field label="Episode Number" required>
          <input type="number" min={1} value={episodeNumber} onChange={(e) => setEpisodeNumber(e.target.value)} className="qk-input" />
        </Field>
      </div>

      <Field label="Title" required>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="qk-input" />
      </Field>

      <Field label="Description">
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="qk-input resize-none" />
      </Field>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Topic">
          <input value={topic} onChange={(e) => setTopic(e.target.value)} className="qk-input" />
        </Field>
        <Field label="Scripture">
          <input value={scripture} onChange={(e) => setScripture(e.target.value)} className="qk-input" />
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Duration">
          <input value={durationLabel} onChange={(e) => setDurationLabel(e.target.value)} placeholder="e.g., 12 min" className="qk-input" />
        </Field>
        <Field label="Release Date">
          <input type="date" value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} className="qk-input" />
        </Field>
      </div>

      <Field label="Thumbnail URL">
        <input value={thumbnailUrl} onChange={(e) => setThumbnailUrl(e.target.value)} placeholder="https://..." className="qk-input" />
      </Field>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Quote">
          <input value={quote} onChange={(e) => setQuote(e.target.value)} className="qk-input" />
        </Field>
        <Field label="Quote Source">
          <input value={quoteSource} onChange={(e) => setQuoteSource(e.target.value)} className="qk-input" />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
        Featured episode
      </label>

      {error && <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>}

      <Button type="submit" disabled={submitting}>
        <Save size={16} /> {submitting ? "Saving..." : episode ? "Save Episode" : "Create Episode Draft"}
      </Button>
    </form>
  );
}

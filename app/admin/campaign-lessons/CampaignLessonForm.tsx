"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Field } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { CampaignLessonInput } from "@/services/supabase/lessons";
import { PublishedLesson } from "@/types";
import { createCampaignLessonAction, updateCampaignLessonAction } from "./actions";

const MONTHS = [
  "September", "October", "November", "December", "January", "February",
  "March", "April", "May", "June", "July", "August",
];

export function CampaignLessonForm({ lesson }: { lesson?: PublishedLesson }) {
  const router = useRouter();
  const [campaignName, setCampaignName] = useState(lesson?.campaignName ?? "");
  const [campaignSprintSeason, setCampaignSprintSeason] = useState(lesson?.campaignSprintSeason ?? "");
  const [campaignMonth, setCampaignMonth] = useState(lesson?.campaignMonth ?? MONTHS[0]);
  const [campaignMonthNumber, setCampaignMonthNumber] = useState(lesson?.campaignMonthNumber?.toString() ?? "1");
  const [campaignWeekNumber, setCampaignWeekNumber] = useState(lesson?.campaignWeekNumber?.toString() ?? "1");
  const [campaignMonthlyTheme, setCampaignMonthlyTheme] = useState(lesson?.campaignMonthlyTheme ?? "");
  const [campaignMonthlyVerse, setCampaignMonthlyVerse] = useState(lesson?.campaignMonthlyVerse ?? "");
  const [title, setTitle] = useState(lesson?.title ?? "");
  const [shortDescription, setShortDescription] = useState(lesson?.shortDescription ?? "");
  const [aboutText, setAboutText] = useState(lesson?.aboutText ?? "");
  const [campaignWeeklyVerse, setCampaignWeeklyVerse] = useState(lesson?.campaignWeeklyVerse ?? "");
  const [campaignSpeakerName, setCampaignSpeakerName] = useState(lesson?.campaignSpeakerName ?? "");
  const [campaignSpeakerBio, setCampaignSpeakerBio] = useState(lesson?.campaignSpeakerBio ?? "");
  const [campaignSpeakerImageUrl, setCampaignSpeakerImageUrl] = useState(lesson?.campaignSpeakerImageUrl ?? "");
  const [featuredImageUrl, setFeaturedImageUrl] = useState(lesson?.featuredImageUrl ?? "");
  const [isFeatured, setIsFeatured] = useState(lesson?.featured ?? false);
  const [isHighlighted, setIsHighlighted] = useState(lesson?.isHighlighted ?? false);
  const [isPublished, setIsPublished] = useState(lesson?.status === "published");
  const [sortOrder, setSortOrder] = useState(lesson?.sortOrder?.toString() ?? "0");
  const [displayStartDate, setDisplayStartDate] = useState(lesson?.displayStartDate ?? "");
  const [linkedExperienceId, setLinkedExperienceId] = useState(lesson?.linkedExperienceId ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const input: CampaignLessonInput = {
      campaignName,
      campaignSprintSeason,
      campaignMonth,
      campaignMonthNumber: campaignMonthNumber ? Number(campaignMonthNumber) : null,
      campaignWeekNumber: campaignWeekNumber ? Number(campaignWeekNumber) : null,
      campaignMonthlyTheme,
      campaignMonthlyVerse,
      title,
      shortDescription,
      aboutText,
      campaignWeeklyVerse,
      campaignSpeakerName,
      campaignSpeakerBio,
      campaignSpeakerImageUrl,
      featuredImageUrl,
      isFeatured,
      isHighlighted,
      sortOrder: sortOrder ? Number(sortOrder) : 0,
      displayStartDate,
      linkedExperienceId: linkedExperienceId.trim() || null,
    };

    const result = lesson
      ? await updateCampaignLessonAction(lesson.id, { ...input, status: isPublished ? "published" : "draft" })
      : await createCampaignLessonAction(input);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.push(`/admin/campaign-lessons/${lesson ? lesson.id : result.id}/edit`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="qk-card p-5 space-y-5 max-w-3xl">
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">Campaign</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Campaign Name" required>
            <input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="e.g., Kingdom Harvest" className="qk-input" />
          </Field>
          <Field label="Sprint / Season">
            <input value={campaignSprintSeason} onChange={(e) => setCampaignSprintSeason(e.target.value)} placeholder="e.g., Year 1" className="qk-input" />
          </Field>
          <Field label="Month">
            <select value={campaignMonth} onChange={(e) => setCampaignMonth(e.target.value)} className="qk-input">
              {MONTHS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </Field>
          <Field label="Month Number (1-12)">
            <input type="number" min={1} max={12} value={campaignMonthNumber} onChange={(e) => setCampaignMonthNumber(e.target.value)} className="qk-input" />
          </Field>
          <Field label="Week Number">
            <input type="number" min={1} max={5} value={campaignWeekNumber} onChange={(e) => setCampaignWeekNumber(e.target.value)} className="qk-input" />
          </Field>
          <Field label="Display Start Date">
            <input type="date" value={displayStartDate} onChange={(e) => setDisplayStartDate(e.target.value)} className="qk-input" />
          </Field>
        </div>
        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <Field label="Monthly Theme">
            <input value={campaignMonthlyTheme} onChange={(e) => setCampaignMonthlyTheme(e.target.value)} className="qk-input" />
          </Field>
          <Field label="Monthly Bible Verse">
            <input value={campaignMonthlyVerse} onChange={(e) => setCampaignMonthlyVerse(e.target.value)} className="qk-input" />
          </Field>
        </div>
      </div>

      <div className="border-t border-border-subtle pt-4">
        <h2 className="text-sm font-semibold text-foreground mb-3">Lesson</h2>
        <div className="space-y-4">
          <Field label="Lesson Title" required>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="qk-input" />
          </Field>
          <Field label="Lesson Summary">
            <textarea value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} rows={2} className="qk-input resize-none" />
          </Field>
          <Field label="Lesson Content / Notes">
            <textarea value={aboutText} onChange={(e) => setAboutText(e.target.value)} rows={5} className="qk-input resize-none" />
          </Field>
          <Field label="Weekly Verse (if available)">
            <input value={campaignWeeklyVerse} onChange={(e) => setCampaignWeeklyVerse(e.target.value)} className="qk-input" />
          </Field>
          <Field label="Thumbnail / Image URL">
            <input value={featuredImageUrl} onChange={(e) => setFeaturedImageUrl(e.target.value)} placeholder="https://..." className="qk-input" />
          </Field>
        </div>
      </div>

      <div className="border-t border-border-subtle pt-4">
        <h2 className="text-sm font-semibold text-foreground mb-3">Speaker</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Speaker Name">
            <input value={campaignSpeakerName} onChange={(e) => setCampaignSpeakerName(e.target.value)} className="qk-input" />
          </Field>
          <Field label="Speaker Image URL">
            <input value={campaignSpeakerImageUrl} onChange={(e) => setCampaignSpeakerImageUrl(e.target.value)} placeholder="https://..." className="qk-input" />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Speaker Bio">
            <textarea value={campaignSpeakerBio} onChange={(e) => setCampaignSpeakerBio(e.target.value)} rows={3} className="qk-input resize-none" />
          </Field>
        </div>
      </div>

      <div className="border-t border-border-subtle pt-4">
        <h2 className="text-sm font-semibold text-foreground mb-3">Display</h2>
        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <Field label="Sort Order">
            <input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="qk-input" />
          </Field>
          <Field label="Linked Experience ID (optional)">
            <input value={linkedExperienceId} onChange={(e) => setLinkedExperienceId(e.target.value)} placeholder="Experience UUID" className="qk-input" />
          </Field>
        </div>
        <div className="flex flex-wrap gap-5">
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} />
            Featured
          </label>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={isHighlighted} onChange={(e) => setIsHighlighted(e.target.checked)} />
            Highlighted
          </label>
          {/* Publishing is only offered once a lesson exists -- same convention as every other
              lesson-creation flow in this app (submitLessonDraft always creates a draft; publishing
              is a separate, subsequent action). A brand-new campaign lesson always starts as draft. */}
          {lesson && (
            <label className="flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} />
              Published
            </label>
          )}
        </div>
        {!lesson && <p className="text-[11px] text-muted mt-2">New campaign lessons start as a draft -- publish it from the edit page once you&apos;re ready.</p>}
      </div>

      {error && <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>}

      <Button type="submit" disabled={submitting}>
        <Save size={16} /> {submitting ? "Saving..." : lesson ? "Save Campaign Lesson" : "Create Campaign Lesson"}
      </Button>
    </form>
  );
}

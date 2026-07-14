"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { buildThumbnailPath, uploadLessonThumbnail, deleteLessonThumbnailByUrl } from "@/services/supabase/lessonThumbnails";
import { updateLessonThumbnail } from "@/app/lessons/[lessonId]/actions";
import { Button } from "@/components/ui/Button";
import { ThumbnailUploadField } from "./ThumbnailUploadField";
import { PublishedLesson } from "@/types";

// Shown only to a Host/Admin who manages this lesson's church (parent decides visibility --
// mutations are additionally enforced server-side by the lessons_update_managed RLS policy and
// the storage.objects policies, so this component is a UX convenience, not the security boundary).
export function ThumbnailEditorPanel({ lesson, churchId }: { lesson: PublishedLesson; churchId: string }) {
  const router = useRouter();
  const [currentUrl, setCurrentUrl] = useState(lesson.featuredImageUrl);
  const [currentAlt, setCurrentAlt] = useState(lesson.featuredImageAlt ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(lesson.featuredImageUrl);
  const [alt, setAlt] = useState(lesson.featuredImageAlt ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

  function handleSelectFile(f: File) {
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setError("");
    setSavedMessage("");
  }

  function handleRemovePreview() {
    // Clears only the pending, unsaved selection -- the saved thumbnail is untouched until
    // "Remove Thumbnail" / "Restore Default" below is used.
    setFile(null);
    setPreviewUrl(currentUrl);
    setAlt(currentAlt);
  }

  async function handleSaveReplacement() {
    if (!file) return;
    setSaving(true);
    setError("");
    setSavedMessage("");
    const supabase = createClient();
    const uniqueId = crypto.randomUUID();
    const path = buildThumbnailPath(churchId, lesson.id, uniqueId, file.name);

    const uploadResult = await uploadLessonThumbnail(supabase, path, file);
    if (uploadResult.error) {
      setSaving(false);
      setError(`Upload failed: ${uploadResult.error}`);
      return;
    }

    const updateResult = await updateLessonThumbnail({
      lessonId: lesson.id,
      lessonSlug: lesson.slug,
      churchSlug: lesson.church.slug,
      featuredImageUrl: uploadResult.publicUrl,
      featuredImageAlt: alt || null,
    });
    if (updateResult.error) {
      setSaving(false);
      setError(updateResult.error);
      return;
    }

    // Delete the old object only now that the new upload and DB update both succeeded.
    const previousUrl = currentUrl;
    await deleteLessonThumbnailByUrl(supabase, previousUrl);

    setCurrentUrl(uploadResult.publicUrl);
    setCurrentAlt(alt || "");
    setFile(null);
    setSaving(false);
    setSavedMessage("Thumbnail updated.");
    router.refresh();
  }

  async function handleClear(restoreFallback: boolean) {
    setSaving(true);
    setError("");
    setSavedMessage("");
    const previousUrl = currentUrl;

    const updateResult = await updateLessonThumbnail({
      lessonId: lesson.id,
      lessonSlug: lesson.slug,
      churchSlug: lesson.church.slug,
      featuredImageUrl: null,
      featuredImageAlt: null,
    });
    if (updateResult.error) {
      setSaving(false);
      setError(updateResult.error);
      return;
    }

    const supabase = createClient();
    await deleteLessonThumbnailByUrl(supabase, previousUrl);

    setCurrentUrl(null);
    setCurrentAlt("");
    setFile(null);
    setPreviewUrl(null);
    setAlt("");
    setSaving(false);
    setSavedMessage(restoreFallback ? "Restored the default thumbnail." : "Thumbnail removed.");
    router.refresh();
  }

  return (
    <div className="qk-card p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3">Edit Thumbnail</h3>
      <ThumbnailUploadField
        previewUrl={previewUrl}
        alt={alt}
        onSelectFile={handleSelectFile}
        onRemove={handleRemovePreview}
        onAltChange={setAlt}
        disabled={saving}
        label="Replace Thumbnail"
      />
      {error && <p className="text-xs text-red-300 mt-2">{error}</p>}
      {savedMessage && <p className="text-xs text-accent-blue-light mt-2">{savedMessage}</p>}
      <div className="flex flex-wrap gap-2 mt-3">
        {file && (
          <Button size="sm" onClick={handleSaveReplacement} disabled={saving}>
            {saving ? "Saving..." : "Save Replacement"}
          </Button>
        )}
        {!file && currentUrl && (
          <>
            <Button size="sm" variant="secondary" onClick={() => handleClear(false)} disabled={saving}>
              Remove Thumbnail
            </Button>
            <Button size="sm" variant="secondary" onClick={() => handleClear(true)} disabled={saving}>
              Restore Default
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

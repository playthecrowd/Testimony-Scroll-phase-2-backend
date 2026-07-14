"use client";

import { useRef, useState } from "react";
import { Upload, X, RefreshCw } from "lucide-react";
import { validateThumbnailFile, checkThumbnailAspectRatio, THUMBNAIL_ACCEPTED_TYPES } from "@/lib/lessonThumbnail";

interface ThumbnailUploadFieldProps {
  previewUrl: string | null;
  alt: string;
  onSelectFile: (file: File) => void;
  onRemove: () => void;
  onAltChange: (alt: string) => void;
  disabled?: boolean;
  label?: string;
}

// Handles browse/drag-drop/preview/replace/remove/alt-text for a single lesson thumbnail. The
// file is only ever handed back to the parent via onSelectFile -- nothing here ever uploads
// anything, so the caller controls exactly when (e.g. only after form submit) the upload happens.
export function ThumbnailUploadField({
  previewUrl,
  alt,
  onSelectFile,
  onRemove,
  onAltChange,
  disabled,
  label = "Lesson Thumbnail",
}: ThumbnailUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");

  function handleFile(file: File | undefined | null) {
    if (!file) return;
    const validationError = validateThumbnailFile(file);
    if (validationError) {
      setError(validationError);
      setWarning("");
      return;
    }
    setError("");
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setWarning(checkThumbnailAspectRatio(img.naturalWidth, img.naturalHeight) ?? "");
      URL.revokeObjectURL(objectUrl);
    };
    img.src = objectUrl;
    onSelectFile(file);
  }

  return (
    <div>
      <span className="block text-xs font-medium text-muted mb-1.5">{label}</span>

      {previewUrl ? (
        <div className="relative aspect-video rounded-lg overflow-hidden bg-surface-2 border border-border-subtle">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt={alt || ""} className="w-full h-full object-cover" />
          <div className="absolute top-2 right-2 flex gap-1.5">
            <button
              type="button"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1 text-[11px] font-medium bg-black/60 hover:bg-black/75 text-white px-2 py-1 rounded-md"
            >
              <RefreshCw size={11} /> Replace
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                onRemove();
                setError("");
                setWarning("");
                if (inputRef.current) inputRef.current.value = "";
              }}
              className="inline-flex items-center gap-1 text-[11px] font-medium bg-black/60 hover:bg-black/75 text-white px-2 py-1 rounded-md"
            >
              <X size={11} /> Remove
            </button>
          </div>
        </div>
      ) : (
        <label
          className={`qk-input flex flex-col items-center justify-center gap-1.5 text-center cursor-pointer py-8 text-muted transition-colors ${
            dragging ? "border-accent-blue-light bg-accent-blue/5" : ""
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFile(e.dataTransfer.files?.[0]);
          }}
        >
          <Upload size={20} />
          <span className="text-xs">Drag &amp; drop an image here or click to browse</span>
          <span className="text-[11px] text-muted/80">1200 × 675 pixels recommended · JPG, PNG, or WEBP · up to 5 MB</span>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept={THUMBNAIL_ACCEPTED_TYPES.join(",")}
            disabled={disabled}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </label>
      )}

      {/* Hidden input also backs the "Replace" button when a preview is already showing. */}
      {previewUrl && (
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={THUMBNAIL_ACCEPTED_TYPES.join(",")}
          disabled={disabled}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      )}

      {error && <p className="text-xs text-red-300 mt-1.5">{error}</p>}
      {!error && warning && <p className="text-xs text-accent-gold mt-1.5">{warning}</p>}

      <div className="mt-2.5">
        <span className="block text-xs font-medium text-muted mb-1.5">Image Alternative Text</span>
        <input
          value={alt}
          onChange={(e) => onAltChange(e.target.value)}
          placeholder="Briefly describe the image for screen readers"
          className="qk-input"
          disabled={disabled}
        />
      </div>
    </div>
  );
}

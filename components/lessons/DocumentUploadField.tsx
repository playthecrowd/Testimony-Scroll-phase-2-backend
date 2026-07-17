"use client";

import { useRef, useState } from "react";
import { Upload, X, File as FileIcon, RefreshCw } from "lucide-react";
import { validateDocumentFile, DOCUMENT_ACCEPTED_TYPES } from "@/lib/lessonDocument";

interface DocumentUploadFieldProps {
  file: File | null;
  onSelectFile: (file: File) => void;
  onRemove: () => void;
  disabled?: boolean;
}

// Gives the previously inert "Upload Notes (PDF, DOCX, TXT)" dropzone a real, working file input
// (docs/PHASE3_AUDIT.md section 3a). Mirrors ThumbnailUploadField's browse/drag-drop/replace/
// remove shape, minus the image preview -- the file is only ever handed back via onSelectFile;
// the actual Storage upload happens after the lesson exists (same deferred-upload pattern
// ExperienceBuilderForm already uses for the thumbnail).
export function DocumentUploadField({ file, onSelectFile, onRemove, disabled }: DocumentUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");

  function handleFile(selected: File | undefined | null) {
    if (!selected) return;
    const validationError = validateDocumentFile(selected);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    onSelectFile(selected);
  }

  return (
    <div>
      {file ? (
        <div className="qk-input flex items-center gap-2.5 py-3">
          <FileIcon size={18} className="text-accent-blue-light shrink-0" />
          <span className="text-sm text-foreground truncate flex-1">{file.name}</span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="p-1.5 rounded-lg hover:bg-white/5 text-muted"
            aria-label="Replace file"
          >
            <RefreshCw size={14} />
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              onRemove();
              setError("");
              if (inputRef.current) inputRef.current.value = "";
            }}
            className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-300"
            aria-label="Remove file"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <label
          className={`qk-input flex flex-col items-center justify-center gap-1.5 text-center cursor-pointer py-6 text-muted transition-colors ${
            dragging ? "border-accent-blue-light bg-accent-blue/5" : ""
          }`}
          onClick={(e) => {
            e.preventDefault();
            inputRef.current?.click();
          }}
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
          <Upload size={18} />
          <span className="text-xs">Drag &amp; drop your file here or click to browse</span>
          <span className="text-[11px] text-muted/80">PDF, DOCX, or TXT · up to 20 MB</span>
        </label>
      )}
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={[...DOCUMENT_ACCEPTED_TYPES, ".pdf", ".docx", ".txt"].join(",")}
        disabled={disabled}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {error && <p className="text-xs text-red-300 mt-1.5">{error}</p>}
    </div>
  );
}

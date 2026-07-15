"use client";

import { Trash2, Plus, ChevronUp, ChevronDown, FileText, Play, Headphones, Presentation, File } from "lucide-react";
import { isValidMediaUrl } from "@/lib/lessonForm";
import { EditableMediaItem } from "@/lib/mediaDiff";
import { LessonMediaType } from "@/types";

// Extends the pure EditableMediaItem (id/mediaType/url/content/title/sortOrder -- what actually
// gets saved) with a client-only `key` used purely for stable React list identity, since a
// freshly-added row has no id yet. Never sent to the server.
export interface MediaItemFormRow extends EditableMediaItem {
  key: string;
}

const MEDIA_TYPE_OPTIONS: { value: LessonMediaType; label: string; icon: React.ElementType }[] = [
  { value: "notes", label: "Notes", icon: FileText },
  { value: "video", label: "Video", icon: Play },
  { value: "audio", label: "Audio", icon: Headphones },
  { value: "slides", label: "Slides", icon: Presentation },
  { value: "document", label: "Document", icon: File },
  { value: "transcript", label: "Transcript", icon: FileText },
];

interface MediaItemsEditorProps {
  items: MediaItemFormRow[];
  onChange: (items: MediaItemFormRow[]) => void;
  disabled?: boolean;
}

export function MediaItemsEditor({ items, onChange, disabled }: MediaItemsEditorProps) {
  function updateItem(key: string, patch: Partial<MediaItemFormRow>) {
    onChange(items.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  function removeItem(key: string) {
    onChange(
      items
        .filter((item) => item.key !== key)
        .map((item, i) => ({ ...item, sortOrder: i }))
    );
  }

  function moveItem(key: string, direction: -1 | 1) {
    const index = items.findIndex((item) => item.key === key);
    const targetIndex = index + direction;
    if (index === -1 || targetIndex < 0 || targetIndex >= items.length) return;
    const next = items.slice();
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    onChange(next.map((item, i) => ({ ...item, sortOrder: i })));
  }

  function addItem() {
    onChange([
      ...items,
      {
        key: crypto.randomUUID(),
        id: null,
        mediaType: "notes",
        url: "",
        content: "",
        title: "",
        sortOrder: items.length,
      },
    ]);
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const isTranscript = item.mediaType === "transcript";
        const urlError = !isTranscript && item.url && !isValidMediaUrl(item.url) ? "This doesn't look like a valid web address." : "";
        return (
          <div key={item.key} className="qk-card p-3.5 space-y-2.5">
            <div className="flex items-center gap-2">
              <select
                value={item.mediaType}
                onChange={(e) => updateItem(item.key, { mediaType: e.target.value as LessonMediaType })}
                disabled={disabled}
                aria-label="Media type"
                className="qk-input w-auto"
              >
                {MEDIA_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <input
                value={item.title}
                onChange={(e) => updateItem(item.key, { title: e.target.value })}
                placeholder="Title (optional)"
                aria-label="Media title"
                disabled={disabled}
                className="qk-input flex-1"
              />
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => moveItem(item.key, -1)}
                  disabled={disabled || index === 0}
                  aria-label="Move up"
                  className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed text-muted"
                >
                  <ChevronUp size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => moveItem(item.key, 1)}
                  disabled={disabled || index === items.length - 1}
                  aria-label="Move down"
                  className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed text-muted"
                >
                  <ChevronDown size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => removeItem(item.key)}
                  disabled={disabled}
                  aria-label="Remove media item"
                  className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-300 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>

            {isTranscript ? (
              <textarea
                value={item.content}
                onChange={(e) => updateItem(item.key, { content: e.target.value })}
                placeholder="Paste the transcript text"
                rows={3}
                disabled={disabled}
                aria-label="Transcript content"
                className="qk-input resize-none"
              />
            ) : (
              <div>
                <input
                  value={item.url}
                  onChange={(e) => updateItem(item.key, { url: e.target.value })}
                  placeholder="https://..."
                  disabled={disabled}
                  aria-label="Media URL"
                  aria-invalid={!!urlError}
                  aria-describedby={urlError ? `media-url-error-${item.key}` : undefined}
                  className="qk-input"
                />
                {urlError && (
                  <p id={`media-url-error-${item.key}`} className="text-xs text-red-300 mt-1">
                    {urlError}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}

      {items.length === 0 && <p className="text-xs text-muted">No media items yet. Add at least one below.</p>}

      <button
        type="button"
        onClick={addItem}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-accent-blue-light hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Plus size={15} /> Add another item
      </button>
    </div>
  );
}

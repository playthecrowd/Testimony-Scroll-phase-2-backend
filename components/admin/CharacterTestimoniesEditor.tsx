"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PublishedTestimony, CharacterRelatedTestimony } from "@/types";
import { updateCharacterTestimoniesAction } from "@/app/admin/characters/actions";

interface Selection {
  testimonyId: string;
  note: string;
}

// "Approved testimonies can contribute to a character's developing story" (Part 16) -- always
// admin-curated here, never automatic. Only fully-approved public testimonies are offered, since
// that's all character_testimonies' own RLS would ever surface publicly anyway.
export function CharacterTestimoniesEditor({
  characterId,
  approvedTestimonies,
  initialSelections,
}: {
  characterId: string;
  approvedTestimonies: PublishedTestimony[];
  initialSelections: CharacterRelatedTestimony[];
}) {
  const [selections, setSelections] = useState<Selection[]>(
    initialSelections.map((s) => ({ testimonyId: s.id, note: s.note ?? "" }))
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function isSelected(id: string) {
    return selections.some((s) => s.testimonyId === id);
  }

  function toggle(id: string) {
    setSaved(false);
    setSelections((prev) => (prev.some((s) => s.testimonyId === id) ? prev.filter((s) => s.testimonyId !== id) : [...prev, { testimonyId: id, note: "" }]));
  }

  function updateNote(id: string, note: string) {
    setSelections((prev) => prev.map((s) => (s.testimonyId === id ? { ...s, note } : s)));
  }

  async function handleSave() {
    setSubmitting(true);
    setError("");
    const result = await updateCharacterTestimoniesAction(characterId, selections);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSaved(true);
  }

  if (approvedTestimonies.length === 0) {
    return <p className="text-sm text-muted">No approved public testimonies exist yet to connect.</p>;
  }

  return (
    <div className="space-y-3">
      {approvedTestimonies.map((t) => {
        const selected = isSelected(t.id);
        const selection = selections.find((s) => s.testimonyId === t.id);
        return (
          <div key={t.id} className={`qk-card p-3 ${selected ? "border-accent-blue-light qk-glow-blue" : ""}`}>
            <button type="button" onClick={() => toggle(t.id)} className="flex items-start gap-2.5 w-full text-left">
              <div className={`w-5 h-5 rounded-md border shrink-0 flex items-center justify-center ${selected ? "bg-accent-blue border-accent-blue" : "border-border-subtle"}`}>
                {selected && <Check size={13} className="text-white" />}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{t.title}</p>
                <p className="text-xs text-muted line-clamp-2">{t.writtenTestimony}</p>
              </div>
            </button>
            {selected && (
              <input
                value={selection?.note ?? ""}
                onChange={(e) => updateNote(t.id, e.target.value)}
                placeholder="Note on how this contributes to the character's story (optional)"
                className="qk-input text-xs mt-2"
              />
            )}
          </div>
        );
      })}

      {error && <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>}
      {saved && !error && <p className="text-sm text-accent-blue-light">Saved.</p>}

      <Button size="sm" onClick={handleSave} disabled={submitting}>
        {submitting ? "Saving..." : "Save Connections"}
      </Button>
    </div>
  );
}

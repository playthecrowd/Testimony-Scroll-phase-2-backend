"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PublishedCharacter, EpisodeCharacterLink } from "@/types";
import { updateEpisodeCharactersAction } from "@/app/admin/episodes/actions";

interface Selection {
  characterId: string;
  roleNote: string;
}

export function EpisodeCharactersEditor({
  episodeId,
  allCharacters,
  initialSelections,
}: {
  episodeId: string;
  allCharacters: PublishedCharacter[];
  initialSelections: EpisodeCharacterLink[];
}) {
  const [selections, setSelections] = useState<Selection[]>(
    initialSelections.map((s) => ({ characterId: s.id, roleNote: s.roleNote ?? "" }))
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function toggle(id: string) {
    setSaved(false);
    setSelections((prev) => (prev.some((s) => s.characterId === id) ? prev.filter((s) => s.characterId !== id) : [...prev, { characterId: id, roleNote: "" }]));
  }

  function updateNote(id: string, roleNote: string) {
    setSelections((prev) => prev.map((s) => (s.characterId === id ? { ...s, roleNote } : s)));
  }

  async function handleSave() {
    setSubmitting(true);
    setError("");
    const result = await updateEpisodeCharactersAction(episodeId, selections);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSaved(true);
  }

  if (allCharacters.length === 0) {
    return <p className="text-sm text-muted">No characters exist yet -- create one first.</p>;
  }

  return (
    <div className="space-y-2.5">
      {allCharacters.map((c) => {
        const selected = selections.some((s) => s.characterId === c.id);
        const selection = selections.find((s) => s.characterId === c.id);
        return (
          <div key={c.id} className={`qk-card p-3 ${selected ? "border-accent-blue-light qk-glow-blue" : ""}`}>
            <button type="button" onClick={() => toggle(c.id)} className="flex items-center gap-2.5 w-full text-left">
              <div className={`w-5 h-5 rounded-md border shrink-0 flex items-center justify-center ${selected ? "bg-accent-blue border-accent-blue" : "border-border-subtle"}`}>
                {selected && <Check size={13} className="text-white" />}
              </div>
              <span className="text-sm text-foreground">{c.name}</span>
            </button>
            {selected && (
              <input
                value={selection?.roleNote ?? ""}
                onChange={(e) => updateNote(c.id, e.target.value)}
                placeholder="Role in this episode (optional)"
                className="qk-input text-xs mt-2"
              />
            )}
          </div>
        );
      })}

      {error && <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>}
      {saved && !error && <p className="text-sm text-accent-blue-light">Saved.</p>}

      <Button size="sm" onClick={handleSave} disabled={submitting}>
        {submitting ? "Saving..." : "Save Characters"}
      </Button>
    </div>
  );
}

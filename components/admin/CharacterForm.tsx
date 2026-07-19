"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Field } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { CharacterInput } from "@/services/supabase/characters";
import { PublishedCharacter } from "@/types";
import { createCharacterAction, updateCharacterAction } from "@/app/admin/characters/actions";

export function CharacterForm({ character }: { character?: PublishedCharacter }) {
  const router = useRouter();
  const [name, setName] = useState(character?.name ?? "");
  const [role, setRole] = useState(character?.role ?? "");
  const [description, setDescription] = useState(character?.description ?? "");
  const [imageUrl, setImageUrl] = useState(character?.imageUrl ?? "");
  const [quote, setQuote] = useState(character?.quote ?? "");
  const [quoteSource, setQuoteSource] = useState(character?.quoteSource ?? "");
  const [isKeyCharacter, setIsKeyCharacter] = useState(character?.isKeyCharacter ?? false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const input: CharacterInput = { name, role, description, imageUrl, quote, quoteSource, isKeyCharacter };
    const result = character ? await updateCharacterAction(character.id, input) : await createCharacterAction(input);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.push(character ? `/admin/characters/${character.id}/edit` : `/admin/characters/${result.id}/edit`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="qk-card p-5 space-y-4 max-w-xl">
      <Field label="Name" required>
        <input value={name} onChange={(e) => setName(e.target.value)} className="qk-input" />
      </Field>
      <Field label="Role / Archetype">
        <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g., The Overcomer" className="qk-input" />
      </Field>
      <Field label="Backstory / Description">
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="qk-input resize-none" />
      </Field>
      <Field label="Image URL">
        <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." className="qk-input" />
      </Field>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Quote">
          <input value={quote} onChange={(e) => setQuote(e.target.value)} className="qk-input" />
        </Field>
        <Field label="Quote Source">
          <input value={quoteSource} onChange={(e) => setQuoteSource(e.target.value)} placeholder="e.g., Testimony, Season 1" className="qk-input" />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" checked={isKeyCharacter} onChange={(e) => setIsKeyCharacter(e.target.checked)} />
        Key character (featured prominently on the Full Story page)
      </label>

      {error && <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>}

      <Button type="submit" disabled={submitting}>
        <Save size={16} /> {submitting ? "Saving..." : character ? "Save Character" : "Create Character"}
      </Button>
    </form>
  );
}

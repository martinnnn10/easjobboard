"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NoteForm({ orgSlug, applicationId }: { orgSlug: string; applicationId: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/o/${orgSlug}/applications/${applicationId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Couldn't save the note.");
        return;
      }
      setText("");
      router.refresh();
    } catch {
      setError("Couldn't save the note.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        className="field-input min-h-20"
        placeholder="Add a note — phone screen impressions, availability, next steps…"
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button type="submit" disabled={saving || !text.trim()} className="btn-secondary text-sm">
        {saving ? "Saving…" : "Add note"}
      </button>
    </form>
  );
}

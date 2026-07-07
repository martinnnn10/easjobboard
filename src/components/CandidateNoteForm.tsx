"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const KINDS = ["Note", "Call", "Meeting", "Text"] as const;

export function CandidateNoteForm({ orgSlug, candidateId }: { orgSlug: string; candidateId: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [kind, setKind] = useState<(typeof KINDS)[number]>("Note");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/o/${orgSlug}/candidates/${candidateId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, kind }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Couldn't save.");
        return;
      }
      setText("");
      router.refresh();
    } catch {
      setError("Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              kind === k
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            {k}
          </button>
        ))}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Log a call, note, or next step for this candidate…"
        className="field-input min-h-20"
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button type="submit" disabled={saving || !text.trim()} className="btn-primary text-sm">
        {saving ? "Saving…" : "Add to timeline"}
      </button>
    </form>
  );
}

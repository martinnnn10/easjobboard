"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Member = { id: string; name: string };

export function CandidateCrmPanel({
  orgSlug,
  candidateId,
  initialTags,
  initialOwnerId,
  members,
  canEdit,
}: {
  orgSlug: string;
  candidateId: string;
  initialTags: string[];
  initialOwnerId: string;
  members: Member[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [tags, setTags] = useState<string[]>(initialTags);
  const [owner, setOwner] = useState(initialOwnerId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(patch: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/o/${orgSlug}/candidates/${candidateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Couldn't save.");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("Network error.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addTag(value: string) {
    const t = value.trim();
    if (!t || tags.some((x) => x.toLowerCase() === t.toLowerCase())) return;
    const next = [...tags, t];
    setTags(next);
    await save({ tags: next });
  }

  async function removeTag(tag: string) {
    const next = tags.filter((t) => t !== tag);
    setTags(next);
    await save({ tags: next });
  }

  async function changeOwner(value: string) {
    setOwner(value);
    await save({ owner_user_id: value });
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="section-label">Tags</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {tags.length === 0 ? <span className="text-sm text-zinc-400">No tags yet</span> : null}
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white"
            >
              {tag}
              {canEdit ? (
                <button
                  type="button"
                  aria-label={`Remove ${tag}`}
                  disabled={busy}
                  onClick={() => removeTag(tag)}
                  className="text-zinc-300 hover:text-white disabled:opacity-50"
                >
                  ×
                </button>
              ) : null}
            </span>
          ))}
        </div>
        {canEdit ? (
          <input
            type="text"
            placeholder="Add a tag and press Enter (e.g. Rehire, Top prospect)"
            disabled={busy}
            className="field-input mt-2"
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              void addTag(e.currentTarget.value);
              e.currentTarget.value = "";
            }}
          />
        ) : null}
      </div>

      <div>
        <p className="section-label">Owner</p>
        {canEdit ? (
          <select
            value={owner}
            disabled={busy}
            onChange={(e) => changeOwner(e.target.value)}
            className="field-input mt-2 max-w-xs"
          >
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        ) : (
          <p className="mt-1 text-sm text-zinc-700">
            {members.find((m) => m.id === owner)?.name ?? "Unassigned"}
          </p>
        )}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

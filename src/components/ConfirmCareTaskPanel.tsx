"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CARE_OUTCOMES, CONTACT_METHODS, type ContactMethod } from "@/lib/care-meta";

export function ConfirmCareTaskPanel({
  orgSlug,
  taskId,
  canConfirm,
}: {
  orgSlug: string;
  taskId: string;
  canConfirm: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<ContactMethod>("call");
  const [outcome, setOutcome] = useState<string>(CARE_OUTCOMES[0].key);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!canConfirm) {
    return <span className="text-xs text-zinc-400">Assigned to another recruiter</span>;
  }

  async function post(url: string, body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Couldn't save.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setOpen(true)} className="btn-primary px-2.5 py-1 text-xs">
          Confirm outreach
        </button>
        <button
          type="button"
          onClick={() => post(`/api/o/${orgSlug}/care-tasks/${taskId}`, { action: "snooze", days: 1 })}
          disabled={busy}
          className="text-xs text-zinc-500 hover:underline"
        >
          Snooze 1d
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
      <div className="flex flex-wrap gap-1.5">
        {CONTACT_METHODS.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMethod(m.key)}
            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
              method === m.key ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white text-zinc-700"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <select value={outcome} onChange={(e) => setOutcome(e.target.value)} className="field-input py-2 text-sm">
        {CARE_OUTCOMES.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>
      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Note (optional)"
        className="field-input py-2 text-sm"
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            post(`/api/o/${orgSlug}/care-tasks/${taskId}/confirm`, { contact_method: method, outcome, notes })
          }
          className="btn-primary text-sm"
        >
          {busy ? "Saving…" : "Save confirmation"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary text-sm">
          Cancel
        </button>
      </div>
    </div>
  );
}

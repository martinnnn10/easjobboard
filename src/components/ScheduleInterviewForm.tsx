"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { INTERVIEW_TYPES } from "@/lib/care-meta";

type JobOption = { id: string; title: string };

export function ScheduleInterviewForm({
  orgSlug,
  candidateId,
  jobs,
  defaultJobId,
  compact,
}: {
  orgSlug: string;
  candidateId: string;
  jobs: JobOption[];
  defaultJobId?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch(`/api/o/${orgSlug}/candidates/${candidateId}/interviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: form.get("job_id"),
          interview_title: form.get("interview_title"),
          interview_type: form.get("interview_type"),
          interview_datetime: form.get("interview_datetime"),
          location: form.get("location"),
          hiring_manager: form.get("hiring_manager"),
          stage: form.get("stage"),
          client: form.get("client"),
          notes: form.get("notes"),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Couldn't schedule.");
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
      <button type="button" onClick={() => setOpen(true)} className={compact ? "btn-secondary text-xs px-2.5 py-1" : "btn-secondary text-sm"}>
        Schedule interview
      </button>
    );
  }

  if (jobs.length === 0) {
    return <p className="text-sm text-zinc-400">Attach this candidate to a job first.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
      <p className="text-sm font-semibold text-zinc-800">Schedule interview</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-zinc-600">Job req</span>
          <select name="job_id" defaultValue={defaultJobId ?? jobs[0]?.id} className="field-input py-2 text-sm">
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-zinc-600">Date &amp; time</span>
          <input name="interview_datetime" type="datetime-local" required className="field-input py-2 text-sm" />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-zinc-600">Type</span>
          <select name="interview_type" defaultValue="phone_screen" className="field-input py-2 text-sm">
            {INTERVIEW_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-zinc-600">Stage</span>
          <input name="stage" placeholder="e.g. 1st round" className="field-input py-2 text-sm" />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-zinc-600">Title (optional)</span>
          <input name="interview_title" placeholder="e.g. Panel with maintenance lead" className="field-input py-2 text-sm" />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-zinc-600">Location / link</span>
          <input name="location" placeholder="Plant address or video link" className="field-input py-2 text-sm" />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-zinc-600">Hiring manager / contact</span>
          <input name="hiring_manager" className="field-input py-2 text-sm" />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-zinc-600">Client / company</span>
          <input name="client" className="field-input py-2 text-sm" />
        </label>
      </div>
      <label className="block space-y-1">
        <span className="text-xs font-medium text-zinc-600">Notes</span>
        <input name="notes" placeholder="Prep notes, directions…" className="field-input py-2 text-sm" />
      </label>
      <p className="text-xs text-zinc-500">
        We&apos;ll auto-create pre-interview, day-of, and post-interview follow-up tasks with a 12-hour SLA.
      </p>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="btn-primary text-sm">
          {busy ? "Scheduling…" : "Schedule + create tasks"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary text-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}

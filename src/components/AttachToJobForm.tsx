"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type JobOption = { id: string; title: string };

/** Attach a candidate to one of the org's jobs (opens an application). */
export function AttachToJobForm({
  orgSlug,
  candidateId,
  jobs,
}: {
  orgSlug: string;
  candidateId: string;
  jobs: JobOption[];
}) {
  const router = useRouter();
  const [jobId, setJobId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!jobId) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/o/${orgSlug}/candidates/${candidateId}/applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Couldn't attach.");
        return;
      }
      setJobId("");
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  if (jobs.length === 0) {
    return <p className="text-sm text-zinc-400">Create a job first to attach this candidate.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <p className="section-label">Attach to a job</p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={jobId}
          disabled={busy}
          onChange={(e) => setJobId(e.target.value)}
          className="field-input max-w-xs"
        >
          <option value="">Choose a job…</option>
          {jobs.map((job) => (
            <option key={job.id} value={job.id}>
              {job.title}
            </option>
          ))}
        </select>
        <button type="submit" disabled={busy || !jobId} className="btn-secondary text-sm">
          {busy ? "Attaching…" : "Attach"}
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}

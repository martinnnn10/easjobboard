"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Member = { id: string; name: string };

/** Inline recruiter picker for a candidate on a job req; assigns on change. */
export function AssignRecruiterSelect({
  orgSlug,
  jobId,
  candidateId,
  recruiters,
  currentRecruiterId,
}: {
  orgSlug: string;
  jobId: string;
  candidateId: string;
  recruiters: Member[];
  currentRecruiterId: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(currentRecruiterId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function change(recruiterId: string) {
    if (!recruiterId) return;
    setValue(recruiterId);
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/o/${orgSlug}/jobs/${jobId}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidate_id: candidateId, recruiter_id: recruiterId }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Couldn't assign.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <select
        value={value}
        disabled={busy}
        onChange={(e) => change(e.target.value)}
        className="field-input max-w-[12rem] py-1.5 text-sm"
      >
        <option value="">Assign recruiter…</option>
        {recruiters.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

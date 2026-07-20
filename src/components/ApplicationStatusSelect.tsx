"use client";

import { useState } from "react";
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABELS,
  type ApplicationStatus,
} from "@/lib/application-status";

const STYLES: Record<ApplicationStatus, string> = {
  new: "bg-sky-50 text-sky-700 border-sky-200",
  screening: "bg-amber-50 text-amber-700 border-amber-200",
  interview: "bg-slate-100 text-slate-700 border-slate-300",
  offer: "bg-teal-50 text-teal-700 border-teal-200",
  hired: "bg-green-50 text-green-700 border-green-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
};

export function ApplicationStatusSelect({
  orgSlug,
  applicationId,
  initialStatus,
}: {
  orgSlug: string;
  applicationId: string;
  initialStatus: ApplicationStatus;
}) {
  const [status, setStatus] = useState<ApplicationStatus>(initialStatus);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  async function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value as ApplicationStatus;
    const previous = status;
    setStatus(next);
    setSaving(true);
    setError(false);

    try {
      const response = await fetch(`/api/o/${orgSlug}/applications/${applicationId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!response.ok) throw new Error("Failed to update status");
    } catch {
      setStatus(previous);
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={status}
        onChange={handleChange}
        disabled={saving}
        aria-label="Candidate stage"
        className={`rounded-full border px-2.5 py-1 text-xs font-medium outline-none transition disabled:opacity-60 ${STYLES[status]}`}
      >
        {APPLICATION_STATUSES.map((value) => (
          <option key={value} value={value}>
            {APPLICATION_STATUS_LABELS[value]}
          </option>
        ))}
      </select>
      {error ? <span className="text-xs text-red-600">Save failed</span> : null}
    </div>
  );
}

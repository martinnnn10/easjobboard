"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Clones a job into a new draft and navigates to its editor — for reposting the
 * same role in a different city without retyping everything.
 */
export function DuplicateJobButton({ orgSlug, jobId }: { orgSlug: string; jobId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function duplicate() {
    setBusy(true);
    try {
      const response = await fetch(`/api/o/${orgSlug}/jobs/${jobId}/duplicate`, { method: "POST" });
      if (!response.ok) {
        setBusy(false);
        return;
      }
      const data = (await response.json()) as { job?: { id: string } };
      if (data.job?.id) {
        router.push(`/o/${orgSlug}/admin/jobs/${data.job.id}/edit`);
        router.refresh();
      } else {
        setBusy(false);
      }
    } catch {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={duplicate}
      disabled={busy}
      className="text-blue-600 hover:underline disabled:opacity-50"
    >
      {busy ? "Duplicating…" : "Duplicate"}
    </button>
  );
}

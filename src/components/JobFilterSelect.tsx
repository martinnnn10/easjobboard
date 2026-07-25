"use client";

import { useRouter } from "next/navigation";

/**
 * Job filter for the Applicants page: choosing a job deep-links to that job's
 * scoped applicants (preserving the current category view); "All jobs" clears
 * back to the org-wide list.
 */
export function JobFilterSelect({
  orgSlug,
  jobs,
  currentJobId,
  view,
}: {
  orgSlug: string;
  jobs: { id: string; title: string; status: string }[];
  currentJobId?: string;
  view?: string;
}) {
  const router = useRouter();
  const viewQs = view && view !== "all" ? `&view=${view}` : "";
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="font-medium text-zinc-600">Job</span>
      <select
        value={currentJobId ?? ""}
        onChange={(e) => {
          const id = e.target.value;
          router.push(
            id ? `/o/${orgSlug}/admin/applicants?job=${encodeURIComponent(id)}${viewQs}` : `/o/${orgSlug}/admin/applicants`,
          );
        }}
        className="field-input max-w-[16rem] py-1.5 text-sm"
      >
        <option value="">All jobs</option>
        {jobs.map((j) => (
          <option key={j.id} value={j.id}>
            {j.title}
            {j.status !== "published" ? ` (${j.status})` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

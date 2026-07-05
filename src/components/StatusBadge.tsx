import type { JobStatus } from "@/lib/db";

const STYLES: Record<JobStatus, string> = {
  draft: "bg-zinc-100 text-zinc-700",
  published: "bg-green-100 text-green-800",
  closed: "bg-red-100 text-red-800",
};

export function StatusBadge({ status }: { status: JobStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}>
      {status}
    </span>
  );
}

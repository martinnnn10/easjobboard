import Link from "next/link";
import type { ApplicationCategory } from "@/lib/applications";

/** Per-job intelligence counts (mirror getJobScreeningSummaries field names). */
export type JobCounts = {
  applicants: number;
  completed: number; // "Screened"
  strongFit: number;
  needsReview: number;
  highRisk: number;
  callsDue: number;
};

/** Deep-link into a job's filtered applicants: /admin/applicants?job=…&view=…. */
export function jobApplicantsHref(orgSlug: string, jobId: string, view?: ApplicationCategory): string {
  const base = `/o/${orgSlug}/admin/applicants?job=${encodeURIComponent(jobId)}`;
  return view && view !== "all" ? `${base}&view=${view}` : base;
}

const ITEMS: { key: keyof JobCounts; view: ApplicationCategory; label: string; tone: string }[] = [
  { key: "applicants", view: "all", label: "Applicants", tone: "text-zinc-800" },
  { key: "completed", view: "screened", label: "Screened", tone: "text-zinc-800" },
  { key: "strongFit", view: "strong-fit", label: "Strong fit", tone: "text-brand-700" },
  { key: "needsReview", view: "review", label: "Review", tone: "text-amber-600" },
  { key: "highRisk", view: "high-risk", label: "High risk", tone: "text-red-600" },
  { key: "callsDue", view: "calls-due", label: "Calls due", tone: "text-brand-700" },
];

/**
 * Clickable intelligence counts that drill straight into a job's filtered
 * applicants. A count > 0 is a link to exactly those candidates; a zero renders
 * muted and non-clickable (no useful destination), per the workflow spec.
 */
export function DrilldownCounts({
  orgSlug,
  jobId,
  counts,
  size = "md",
}: {
  orgSlug: string;
  jobId: string;
  counts: JobCounts;
  size?: "sm" | "md";
}) {
  const pad = size === "sm" ? "px-2 py-1" : "px-2.5 py-1.5";
  return (
    <div className="flex flex-wrap gap-1.5">
      {ITEMS.map((it) => {
        const n = counts[it.key];
        if (n > 0) {
          return (
            <Link
              key={it.key}
              href={jobApplicantsHref(orgSlug, jobId, it.view)}
              className={`inline-flex items-center gap-1 rounded-lg bg-zinc-50 ${pad} text-xs ring-1 ring-zinc-200 transition-colors hover:bg-brand-50 hover:ring-brand-200 ${it.tone}`}
            >
              <span className="font-semibold tabular-nums">{n}</span>
              <span className="text-zinc-500">{it.label}</span>
            </Link>
          );
        }
        return (
          <span
            key={it.key}
            className={`inline-flex items-center gap-1 rounded-lg bg-zinc-50 ${pad} text-xs text-zinc-400 ring-1 ring-zinc-100`}
          >
            <span className="font-semibold tabular-nums">0</span>
            <span>{it.label}</span>
          </span>
        );
      })}
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DuplicateJobButton } from "@/components/DuplicateJobButton";
import { DrilldownCounts, jobApplicantsHref } from "@/components/JobDrilldownCounts";
import { StatusBadge } from "@/components/StatusBadge";
import type { ApplicationCategory } from "@/lib/applications";
import type { JobStatus } from "@/lib/db";

export type JobRow = {
  id: string;
  title: string;
  slug: string;
  location: string;
  status: JobStatus;
  screenLabel: string | null;
  applicants: number;
  completed: number;
  strongFit: number;
  needsReview: number;
  highRisk: number;
  callsDue: number;
  hasApplications: boolean;
};

type BulkAction = "publish" | "draft" | "close" | "duplicate" | "delete";

/** A count cell that drills into the job's filtered applicants when > 0. */
function CountCell({
  orgSlug,
  jobId,
  n,
  view,
  tone = "text-zinc-700",
}: {
  orgSlug: string;
  jobId: string;
  n: number;
  view: ApplicationCategory;
  tone?: string;
}) {
  if (n <= 0) return <span className="text-zinc-400">0</span>;
  return (
    <Link
      href={jobApplicantsHref(orgSlug, jobId, view)}
      className={`font-semibold tabular-nums hover:underline ${tone}`}
    >
      {n}
    </Link>
  );
}

/** Prominent primary action — the hiring workflow's main door into a job. */
function ViewApplicantsButton({
  orgSlug,
  job,
  className = "",
}: {
  orgSlug: string;
  job: JobRow;
  className?: string;
}) {
  return (
    <Link
      href={jobApplicantsHref(orgSlug, job.id)}
      className={`inline-flex items-center justify-center rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 ${className}`}
    >
      {job.applicants > 0 ? `View ${job.applicants} applicant${job.applicants === 1 ? "" : "s"}` : "View applicants"}
    </Link>
  );
}

export function JobsTable({
  orgSlug,
  writable,
  sourcingOn,
  rows,
}: {
  orgSlug: string;
  writable: boolean;
  sourcingOn: boolean;
  rows: JobRow[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteText, setDeleteText] = useState("");

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const selectedRows = rows.filter((r) => selected.has(r.id));
  const selectedWithApps = selectedRows.filter((r) => r.hasApplications).length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  }

  function resetBulk() {
    setSelected(new Set());
    setConfirmingDelete(false);
    setDeleteText("");
    setError("");
  }

  async function runBulk(action: BulkAction, confirmDelete = false) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/o/${orgSlug}/jobs/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobIds: [...selected], action, confirmDelete }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Bulk action failed.");
        return;
      }
      resetBulk();
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  /** Single-job close/archive (non-destructive; keeps application history). */
  async function closeOne(jobId: string) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/o/${orgSlug}/jobs/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobIds: [jobId], action: "close" }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) setError(data.error ?? "Could not close the job.");
      else router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  /** Secondary actions, tucked behind a native <details> menu. */
  function MoreMenu({ job }: { job: JobRow }) {
    const itemCls = "block w-full rounded px-2 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-100";
    return (
      <details className="relative">
        <summary className="btn-secondary cursor-pointer list-none text-sm [&::-webkit-details-marker]:hidden">
          More ▾
        </summary>
        <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-zinc-200 bg-white p-1 shadow-lg">
          {writable ? <DuplicateJobButton orgSlug={orgSlug} jobId={job.id} className={itemCls} /> : null}
          {job.status === "published" ? (
            <a
              href={`/o/${orgSlug}/jobs/${job.slug}/flyer`}
              target="_blank"
              rel="noreferrer"
              className={itemCls}
            >
              View flyer
            </a>
          ) : null}
          <Link href={`/o/${orgSlug}/admin/jobs/${job.id}#distribution`} className={itemCls}>
            Distribution
          </Link>
          {writable && sourcingOn ? (
            <Link href={`/o/${orgSlug}/admin/jobs/${job.id}/source`} className={itemCls}>
              Source candidates
            </Link>
          ) : null}
          {writable && job.status !== "closed" ? (
            <button type="button" disabled={busy} onClick={() => closeOne(job.id)} className={itemCls}>
              Close / archive
            </button>
          ) : null}
        </div>
      </details>
    );
  }

  return (
    <div className="space-y-3">
      {writable && selected.size > 0 ? (
        <div className="rounded-xl border border-brand-200 bg-brand-50 p-3">
          {confirmingDelete ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-zinc-900">
                Permanently delete {selected.size} {selected.size === 1 ? "job" : "jobs"}?
              </p>
              {selectedWithApps > 0 ? (
                <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  {selectedWithApps} of these {selectedWithApps === 1 ? "job has" : "jobs have"} applications. Closing or
                  archiving keeps their history — permanent deletion cannot be undone. Consider <strong>Close</strong>{" "}
                  instead.
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-zinc-600">
                  Type <span className="font-mono font-semibold">DELETE</span> to confirm:
                </span>
                <input
                  value={deleteText}
                  onChange={(e) => setDeleteText(e.target.value)}
                  className="w-28 rounded-lg border border-zinc-300 px-2 py-1 text-sm"
                  placeholder="DELETE"
                  autoFocus
                />
                <button
                  type="button"
                  disabled={busy || deleteText !== "DELETE"}
                  onClick={() => runBulk("delete", true)}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {busy ? "Deleting…" : "Permanently delete"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setConfirmingDelete(false);
                    setDeleteText("");
                  }}
                  className="btn-secondary text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-zinc-900">
                {selected.size} {selected.size === 1 ? "job" : "jobs"} selected
              </span>
              <span className="mx-1 h-4 w-px bg-zinc-300" aria-hidden />
              <button type="button" disabled={busy} onClick={() => runBulk("publish")} className="btn-secondary text-sm">
                Publish
              </button>
              <button type="button" disabled={busy} onClick={() => runBulk("draft")} className="btn-secondary text-sm">
                Move to draft
              </button>
              <button type="button" disabled={busy} onClick={() => runBulk("close")} className="btn-secondary text-sm">
                Close / archive
              </button>
              <button type="button" disabled={busy} onClick={() => runBulk("duplicate")} className="btn-secondary text-sm">
                Duplicate
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmingDelete(true)}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                Delete
              </button>
              <button type="button" onClick={resetBulk} className="ml-auto text-sm text-zinc-500 hover:text-zinc-800">
                Clear
              </button>
            </div>
          )}
          {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        </div>
      ) : null}

      {error && selected.size === 0 ? <p className="text-sm text-red-600">{error}</p> : null}

      {/* ── Desktop table (md and up) ─────────────────────────────────────── */}
      <div className="hidden overflow-x-auto rounded-xl border border-zinc-200 bg-white md:block">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
            <tr>
              {writable ? (
                <th className="px-3 py-3">
                  <input
                    type="checkbox"
                    aria-label="Select all jobs"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-zinc-300"
                  />
                </th>
              ) : null}
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Applicants</th>
              <th className="px-4 py-3 text-right font-medium">Screened</th>
              <th className="px-4 py-3 text-right font-medium">Strong-fit</th>
              <th className="px-4 py-3 text-right font-medium">Review</th>
              <th className="px-4 py-3 text-right font-medium">High-risk</th>
              <th className="px-4 py-3 text-right font-medium">Calls due</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((job) => {
              const isSelected = selected.has(job.id);
              return (
                <tr key={job.id} className={`border-b border-zinc-100 last:border-0 ${isSelected ? "bg-brand-50/40" : ""}`}>
                  {writable ? (
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Select ${job.title}`}
                        checked={isSelected}
                        onChange={() => toggle(job.id)}
                        className="h-4 w-4 rounded border-zinc-300"
                      />
                    </td>
                  ) : null}
                  <td className="px-4 py-3">
                    <Link href={`/o/${orgSlug}/admin/jobs/${job.id}`} className="font-medium text-zinc-900 hover:text-brand-700">
                      {job.title}
                    </Link>
                    <div className="text-xs text-zinc-500">{job.location}</div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={job.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <CountCell orgSlug={orgSlug} jobId={job.id} n={job.applicants} view="all" />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <CountCell orgSlug={orgSlug} jobId={job.id} n={job.completed} view="screened" />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <CountCell orgSlug={orgSlug} jobId={job.id} n={job.strongFit} view="strong-fit" tone="text-brand-700" />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <CountCell orgSlug={orgSlug} jobId={job.id} n={job.needsReview} view="review" tone="text-amber-600" />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <CountCell orgSlug={orgSlug} jobId={job.id} n={job.highRisk} view="high-risk" tone="text-red-600" />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <CountCell orgSlug={orgSlug} jobId={job.id} n={job.callsDue} view="calls-due" tone="text-brand-700" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <ViewApplicantsButton orgSlug={orgSlug} job={job} />
                      {writable ? (
                        <Link href={`/o/${orgSlug}/admin/jobs/${job.id}/edit`} className="btn-secondary text-sm">
                          Edit
                        </Link>
                      ) : null}
                      <MoreMenu job={job} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Mobile cards (below md) ───────────────────────────────────────── */}
      <div className="space-y-3 md:hidden">
        {rows.map((job) => (
          <div key={job.id} className="card space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link
                  href={`/o/${orgSlug}/admin/jobs/${job.id}`}
                  className="font-semibold text-zinc-900 hover:text-brand-700"
                >
                  {job.title}
                </Link>
                <p className="text-xs text-zinc-500">{job.location}</p>
              </div>
              <StatusBadge status={job.status} />
            </div>

            <DrilldownCounts orgSlug={orgSlug} jobId={job.id} counts={job} size="sm" />

            <div className="flex flex-wrap items-center gap-2">
              <ViewApplicantsButton orgSlug={orgSlug} job={job} className="flex-1" />
              {writable ? (
                <Link href={`/o/${orgSlug}/admin/jobs/${job.id}/edit`} className="btn-secondary text-sm">
                  Edit
                </Link>
              ) : null}
              <MoreMenu job={job} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

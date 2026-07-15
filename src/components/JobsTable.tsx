"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DuplicateJobButton } from "@/components/DuplicateJobButton";
import { StatusBadge } from "@/components/StatusBadge";
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

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
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
              <th className="px-4 py-3 font-medium">Screen</th>
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
                  <td className="px-4 py-3">
                    {job.screenLabel ? (
                      <span className="inline-flex rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                        {job.screenLabel}
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-400">No screen</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-zinc-700">{job.applicants}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-zinc-700">{job.completed}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className={job.strongFit ? "font-semibold text-brand-700" : "text-zinc-400"}>{job.strongFit}</span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className={job.needsReview ? "font-semibold text-amber-600" : "text-zinc-400"}>{job.needsReview}</span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className={job.highRisk ? "font-semibold text-red-600" : "text-zinc-400"}>{job.highRisk}</span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {job.callsDue ? (
                      <Link href={`/o/${orgSlug}/admin/queue`} className="font-semibold text-brand-700 hover:underline">
                        {job.callsDue}
                      </Link>
                    ) : (
                      <span className="text-zinc-400">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2 text-sm">
                      {writable ? (
                        <>
                          <Link href={`/o/${orgSlug}/admin/jobs/${job.id}/edit`} className="text-brand-700 hover:underline">
                            Edit
                          </Link>
                          {sourcingOn ? (
                            <Link href={`/o/${orgSlug}/admin/jobs/${job.id}/source`} className="text-brand-700 hover:underline">
                              Source
                            </Link>
                          ) : null}
                          <DuplicateJobButton orgSlug={orgSlug} jobId={job.id} />
                        </>
                      ) : null}
                      {job.status === "published" ? (
                        <>
                          <a href={`/o/${orgSlug}/jobs/${job.slug}`} className="text-brand-700 hover:underline" target="_blank" rel="noreferrer">
                            View
                          </a>
                          <a href={`/o/${orgSlug}/jobs/${job.slug}/flyer`} className="text-brand-700 hover:underline" target="_blank" rel="noreferrer">
                            Flyer
                          </a>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

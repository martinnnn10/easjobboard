"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { JobScreeningMetrics } from "@/lib/screen-metrics";

type Attached = {
  label: string;
  isBuiltin: boolean;
  screenId: string;
  questionCount: number;
  minutes: number;
  version: number;
  newerAvailable: boolean;
};
type Option = { id: string; title: string; version: number };

/**
 * The job command center's Screening section. Everything a recruiter needs to
 * manage a job's skills screen — see what's attached, its funnel and outcomes,
 * attach/replace a screen, and jump to invite candidates — without leaving the
 * job. Replacing pins a new version for FUTURE invites only.
 */
export function JobScreeningPanel({
  orgSlug,
  jobId,
  writable,
  attached,
  metrics,
  options,
}: {
  orgSlug: string;
  jobId: string;
  writable: boolean;
  attached: Attached | null;
  metrics: JobScreeningMetrics;
  options: Option[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [choice, setChoice] = useState("");

  async function attach(screenId: string) {
    if (!screenId) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/o/${orgSlug}/screens/${screenId}/attach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean };
      if (!res.ok) {
        setError(data.error ?? "Couldn't attach the screen.");
        return;
      }
      setPickerOpen(false);
      setChoice("");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const hasFunnel = metrics.invited > 0 || metrics.completed > 0;

  return (
    <div className="card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Screening</h2>
          <p className="text-xs text-zinc-500">The practical skills screen for this role — who can actually do the job.</p>
        </div>
        <Link href={`/o/${orgSlug}/admin/screens`} className="text-sm font-medium text-brand-700 hover:underline">
          Manage screens →
        </Link>
      </div>

      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p> : null}

      {attached ? (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-zinc-900">{attached.label}</span>
                <span className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-zinc-600">
                  {attached.isBuiltin ? "Built-in" : attached.version > 0 ? `Custom · v${attached.version}` : "Custom"}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-zinc-500">
                {attached.questionCount} question{attached.questionCount === 1 ? "" : "s"} · ~{attached.minutes} min
              </p>
            </div>
            {writable ? (
              <div className="flex flex-wrap gap-2">
                {!attached.isBuiltin && attached.screenId ? (
                  <Link href={`/o/${orgSlug}/admin/screens/${attached.screenId}?step=preview`} className="btn-secondary px-2.5 py-1 text-xs">
                    View screen
                  </Link>
                ) : null}
                {options.length > 0 ? (
                  <button type="button" onClick={() => setPickerOpen((v) => !v)} disabled={busy} className="btn-secondary px-2.5 py-1 text-xs">
                    Replace
                  </button>
                ) : null}
                <Link href={`/o/${orgSlug}/admin/candidates`} className="btn-primary px-2.5 py-1 text-xs">
                  Invite candidates
                </Link>
              </div>
            ) : null}
          </div>
          {attached.newerAvailable ? (
            <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">
              A newer version of this screen is published. Replace to use it for future invites — completed results keep
              their version.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-5 text-center">
          <p className="font-semibold text-zinc-900">No screen attached</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-zinc-500">
            Attach a practical skills screen so you can tell who can actually do this job before you interview.
          </p>
          {writable ? (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              {options.length > 0 ? (
                <button type="button" onClick={() => setPickerOpen((v) => !v)} className="btn-secondary text-sm">
                  Attach a screen
                </button>
              ) : null}
              <Link href={`/o/${orgSlug}/admin/screens`} className="btn-primary text-sm">
                {options.length > 0 ? "Build a new screen" : "Create your first screen"}
              </Link>
            </div>
          ) : (
            <p className="mt-2 text-xs text-zinc-400">Ask a recruiter to attach a screen.</p>
          )}
        </div>
      )}

      {/* Attach/replace picker */}
      {pickerOpen && writable ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-zinc-50 p-3">
          <select value={choice} onChange={(e) => setChoice(e.target.value)} className="field-input min-w-0 flex-1 py-1.5 text-sm">
            <option value="">Choose a published screen…</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title} (v{o.version})
              </option>
            ))}
          </select>
          <button type="button" onClick={() => attach(choice)} disabled={busy || !choice} className="btn-primary px-3 py-1.5 text-sm">
            {attached ? "Replace" : "Attach"}
          </button>
        </div>
      ) : null}

      {/* Funnel + outcomes */}
      {hasFunnel ? (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            <Metric label="Invited" value={metrics.invited} />
            <Metric label="Accepted" value={metrics.delivered} title="Mail server accepted the message — inbox delivery not independently confirmed." />
            <Metric label="Opened" value={metrics.opened} title="Secure link was accessed (scanners may occasionally trigger this)." />
            <Metric label="Started" value={metrics.started} title="Candidate began answering." />
            <Metric label="Completed" value={metrics.completed} />
            <Metric label="Failed" value={metrics.failed} tone={metrics.failed > 0 ? "red" : undefined} />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label="Avg score" value={metrics.averageScore ?? "—"} />
            <Metric label="Strong-fit" value={metrics.strongFit} tone="green" />
            <Metric label="Review" value={metrics.review} tone="amber" />
            <Metric label="High-risk" value={metrics.highRisk} tone="red" />
          </div>
        </div>
      ) : attached ? (
        <p className="text-sm text-zinc-500">
          No candidates invited yet.{" "}
          {writable ? (
            <Link href={`/o/${orgSlug}/admin/candidates`} className="font-medium text-brand-700 hover:underline">
              Select candidates to invite →
            </Link>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
  title,
}: {
  label: string;
  value: number | string;
  tone?: "green" | "amber" | "red";
  title?: string;
}) {
  const toneCls =
    tone === "green"
      ? "text-green-700"
      : tone === "amber"
        ? "text-amber-700"
        : tone === "red"
          ? "text-red-600"
          : "text-zinc-900";
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-2.5 text-center" title={title}>
      <p className={`text-xl font-bold ${toneCls}`}>{value}</p>
      <p className="text-[11px] text-zinc-500">{label}</p>
    </div>
  );
}

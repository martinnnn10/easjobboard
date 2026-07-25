"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ScreenRecord } from "@/lib/screen-store";

type LibraryScreen = ScreenRecord & { jobsUsing: number };
type Starter = { key: string; label: string; blurb: string; category: string };
type JobOption = { id: string; title: string; status: string };

/**
 * The org's skills-screen library. Manufacturing recruiters start from an
 * approved template or a blank screen, then manage everything (edit, preview,
 * duplicate, attach, archive) without leaving this page.
 */
export function ScreenLibrary({
  orgSlug,
  screens,
  starters,
  attachableJobs,
  categoryLabels,
  canWrite,
}: {
  orgSlug: string;
  screens: LibraryScreen[];
  starters: Starter[];
  attachableJobs: JobOption[];
  categoryLabels: Record<string, string>;
  canWrite: boolean;
}) {
  const router = useRouter();
  const base = `/o/${orgSlug}/admin/screens`;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showStarters, setShowStarters] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const active = screens.filter((s) => s.status !== "archived");
  const archived = screens.filter((s) => s.status === "archived");
  const visible = showArchived ? screens : active;

  async function post(url: string, body?: unknown): Promise<Record<string, unknown> | null> {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        setError((data.error as string) ?? "Something went wrong.");
        return null;
      }
      return data;
    } catch {
      setError("Network error. Please try again.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function createBlank() {
    const data = await post(`/api/o/${orgSlug}/screens`, {
      title: "New skills screen",
      category: "custom",
    });
    const screen = data?.screen as ScreenRecord | undefined;
    if (screen) router.push(`${base}/${screen.id}`);
  }

  async function createFromStarter(starter: Starter) {
    const data = await post(`/api/o/${orgSlug}/screens`, {
      seed_from: starter.key,
      category: starter.category,
    });
    const screen = data?.screen as ScreenRecord | undefined;
    if (screen) router.push(`${base}/${screen.id}`);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Skills Screens</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Build practical, job-specific screens that show who can actually do the work — then attach them to roles and
            send them to candidates.
          </p>
        </div>
        {canWrite ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowStarters((v) => !v)}
              className="btn-secondary"
              disabled={busy}
            >
              Start from a template
            </button>
            <button type="button" onClick={createBlank} className="btn-primary" disabled={busy}>
              New blank screen
            </button>
          </div>
        ) : null}
      </header>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>
      ) : null}

      {/* Starter templates */}
      {canWrite && (showStarters || active.length === 0) ? (
        <section className="card space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Manufacturing starter templates</h2>
            <p className="text-xs text-zinc-500">
              Approved, ready-to-customize screens. Duplicating one gives you an editable draft — your changes never
              touch the original.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {starters.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => createFromStarter(s)}
                disabled={busy}
                className="group flex flex-col rounded-xl border border-zinc-200 bg-white p-4 text-left transition hover:border-brand-400 hover:shadow-sm disabled:opacity-60"
              >
                <span className="text-xs font-semibold uppercase tracking-wide text-brand-700">
                  {categoryLabels[s.category] ?? "Custom"}
                </span>
                <span className="mt-1 font-semibold text-zinc-900">{s.label}</span>
                <span className="mt-1 text-xs leading-relaxed text-zinc-500">{s.blurb}</span>
                <span className="mt-3 text-xs font-medium text-brand-700 group-hover:underline">Use this template →</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {/* Library */}
      {active.length === 0 && !showArchived ? (
        <EmptyState canWrite={canWrite} />
      ) : (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-700">
              {visible.length} screen{visible.length === 1 ? "" : "s"}
            </h2>
            {archived.length > 0 ? (
              <button
                type="button"
                onClick={() => setShowArchived((v) => !v)}
                className="text-xs font-medium text-zinc-500 hover:text-zinc-800"
              >
                {showArchived ? "Hide archived" : `Show archived (${archived.length})`}
              </button>
            ) : null}
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((screen) => (
              <ScreenCard
                key={screen.id}
                screen={screen}
                base={base}
                categoryLabels={categoryLabels}
                canWrite={canWrite}
                attachableJobs={attachableJobs}
                busy={busy}
                onAction={post}
                onRefresh={() => router.refresh()}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function EmptyState({ canWrite }: { canWrite: boolean }) {
  return (
    <div className="card flex flex-col items-center gap-2 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-2xl">🧰</div>
      <h2 className="text-lg font-semibold text-zinc-900">No screens yet</h2>
      <p className="max-w-md text-sm text-zinc-600">
        {canWrite
          ? "Start from an approved manufacturing template above, or build a blank screen. In a few minutes you'll have a practical assessment you can attach to a job and send to candidates."
          : "No skills screens have been built yet. Ask an owner or recruiter to create one."}
      </p>
    </div>
  );
}

function StatusBadge({ status, unpublished }: { status: string; unpublished: boolean }) {
  const map: Record<string, string> = {
    published: "bg-green-50 text-green-700 border-green-200",
    draft: "bg-amber-50 text-amber-700 border-amber-200",
    archived: "bg-zinc-100 text-zinc-500 border-zinc-200",
  };
  const label = status === "published" ? (unpublished ? "Published · edits pending" : "Published") : status === "draft" ? "Draft" : "Archived";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize ${map[status] ?? map.draft}`}>
      {label}
    </span>
  );
}

function ScreenCard({
  screen,
  base,
  categoryLabels,
  canWrite,
  attachableJobs,
  busy,
  onAction,
  onRefresh,
}: {
  screen: LibraryScreen;
  base: string;
  categoryLabels: Record<string, string>;
  canWrite: boolean;
  attachableJobs: JobOption[];
  busy: boolean;
  onAction: (url: string, body?: unknown) => Promise<Record<string, unknown> | null>;
  onRefresh: () => void;
}) {
  const orgSlug = base.split("/")[2];
  const [attachOpen, setAttachOpen] = useState(false);
  const [attachJob, setAttachJob] = useState("");
  const [attached, setAttached] = useState(false);
  const isArchived = screen.status === "archived";

  async function duplicate() {
    await onAction(`/api/o/${orgSlug}/screens/${screen.id}/duplicate`);
    onRefresh();
  }
  async function archive() {
    await onAction(`/api/o/${orgSlug}/screens/${screen.id}`, { action: isArchived ? "restore" : "archive" });
    onRefresh();
  }
  async function attach() {
    if (!attachJob) return;
    const data = await onAction(`/api/o/${orgSlug}/screens/${screen.id}/attach`, { job_id: attachJob });
    if (data?.ok) {
      setAttached(true);
      setAttachOpen(false);
      onRefresh();
    }
  }

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">
            {categoryLabels[screen.category] ?? "Custom"}
          </p>
          <h3 className="truncate font-semibold text-zinc-900">{screen.title}</h3>
          {screen.targetRole ? <p className="truncate text-xs text-zinc-500">{screen.targetRole}</p> : null}
        </div>
        <StatusBadge status={screen.status} unpublished={screen.hasUnpublishedChanges} />
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-zinc-600">
        <div className="flex justify-between"><dt>Questions</dt><dd className="font-medium text-zinc-800">{screen.questionCount}</dd></div>
        <div className="flex justify-between"><dt>Est. time</dt><dd className="font-medium text-zinc-800">{screen.estimatedMinutes} min</dd></div>
        <div className="flex justify-between"><dt>Scoring</dt><dd className="font-medium text-zinc-800">Weighted</dd></div>
        <div className="flex justify-between"><dt>Jobs using</dt><dd className="font-medium text-zinc-800">{screen.jobsUsing}</dd></div>
        <div className="flex justify-between"><dt>Pass bar</dt><dd className="font-medium text-zinc-800">{screen.passingScore > 0 ? screen.passingScore : "—"}</dd></div>
        <div className="flex justify-between"><dt>Version</dt><dd className="font-medium text-zinc-800">{screen.publishedVersion > 0 ? `v${screen.publishedVersion}` : "—"}</dd></div>
      </dl>

      <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3">
        <Link href={`${base}/${screen.id}?step=preview`} className="btn-secondary px-2.5 py-1 text-xs">
          Preview
        </Link>
        {canWrite ? (
          <>
            <Link href={`${base}/${screen.id}`} className="btn-secondary px-2.5 py-1 text-xs">
              Edit
            </Link>
            <button type="button" onClick={duplicate} disabled={busy} className="btn-secondary px-2.5 py-1 text-xs">
              Duplicate
            </button>
            {screen.status === "published" && !isArchived ? (
              <button
                type="button"
                onClick={() => setAttachOpen((v) => !v)}
                disabled={busy || attachableJobs.length === 0}
                className="btn-secondary px-2.5 py-1 text-xs"
                title={attachableJobs.length === 0 ? "No open jobs to attach to" : undefined}
              >
                Attach to job
              </button>
            ) : null}
            <button
              type="button"
              onClick={archive}
              disabled={busy}
              className="ml-auto text-xs font-medium text-zinc-400 hover:text-zinc-700"
            >
              {isArchived ? "Restore" : "Archive"}
            </button>
          </>
        ) : null}
      </div>

      {attachOpen ? (
        <div className="flex items-center gap-2 rounded-lg bg-zinc-50 p-2">
          <select
            value={attachJob}
            onChange={(e) => setAttachJob(e.target.value)}
            className="field-input flex-1 py-1.5 text-xs"
          >
            <option value="">Choose a job…</option>
            {attachableJobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
                {j.status !== "published" ? ` (${j.status})` : ""}
              </option>
            ))}
          </select>
          <button type="button" onClick={attach} disabled={busy || !attachJob} className="btn-primary px-3 py-1.5 text-xs">
            Attach
          </button>
        </div>
      ) : null}
      {attached ? <p className="text-xs font-medium text-green-700">Attached — future invites use this screen.</p> : null}
    </div>
  );
}

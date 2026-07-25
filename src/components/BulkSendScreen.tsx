"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Candidate = { id: string; name: string; email: string };
type JobOption = { id: string; title: string; screenKey: string };
type ScreenOption = { key: string; label: string };
type BatchResult = { total: number; sent: number; skipped: number; failed: number; emailConfigured: boolean };

/**
 * True bulk send: pick a job + attached screen, select many candidates, and
 * send one screen to all of them in a single action. Dedupes active invites
 * (unless "resend"), tolerates per-candidate failures, and shows a batch
 * summary. Owner/recruiter only (the page gates rendering).
 */
export function BulkSendScreen({
  orgSlug,
  candidates,
  jobs,
  screenOptions,
}: {
  orgSlug: string;
  candidates: Candidate[];
  jobs: JobOption[];
  screenOptions: ScreenOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [jobId, setJobId] = useState("");
  const [screenKey, setScreenKey] = useState("");
  const [screenTouched, setScreenTouched] = useState(false);
  const [resend, setResend] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<BatchResult | null>(null);

  const selectableCandidates = useMemo(() => candidates.filter((c) => c.email), [candidates]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return selectableCandidates;
    return selectableCandidates.filter(
      (c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q),
    );
  }, [selectableCandidates, query]);

  const selectedJob = jobs.find((j) => j.id === jobId);
  const effectiveScreenKey = screenTouched && screenKey ? screenKey : selectedJob?.screenKey || screenKey;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function selectAllFiltered() {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = filtered.every((c) => next.has(c.id));
      if (allSelected) filtered.forEach((c) => next.delete(c.id));
      else filtered.forEach((c) => next.add(c.id));
      return next;
    });
  }

  async function send() {
    setError("");
    if (!jobId) return setError("Choose a job to screen these candidates for.");
    if (!effectiveScreenKey) return setError("This job has no screen configured — pick one.");
    if (selected.size === 0) return setError("Select at least one candidate.");
    setBusy(true);
    try {
      const res = await fetch(`/api/o/${orgSlug}/screens/bulk-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: jobId,
          screen_key: effectiveScreenKey,
          candidate_ids: [...selected],
          resend,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as BatchResult & { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Bulk send failed.");
        return;
      }
      setResult({ total: data.total, sent: data.sent, skipped: data.skipped, failed: data.failed, emailConfigured: data.emailConfigured });
      setSelected(new Set());
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (jobs.length === 0 || selectableCandidates.length === 0) return null;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary text-sm">
        Bulk send skills screen
      </button>
    );
  }

  const allFilteredSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id));

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Bulk send skills screen</h2>
          <p className="text-xs text-zinc-500">Send one screen to many candidates in a single action.</p>
        </div>
        <button type="button" onClick={() => { setOpen(false); setResult(null); }} className="text-sm text-zinc-500 hover:text-zinc-800">
          Close
        </button>
      </div>

      {result ? (
        <div className="rounded-lg border border-brand-200 bg-brand-50 p-3 text-sm">
          <p className="font-semibold text-brand-900">Batch complete</p>
          <div className="mt-2 grid grid-cols-4 gap-2 text-center">
            <Stat label="Selected" value={result.total} />
            <Stat label="Sent" value={result.sent} tone="green" />
            <Stat label="Skipped" value={result.skipped} tone="amber" />
            <Stat label="Failed" value={result.failed} tone="red" />
          </div>
          {!result.emailConfigured ? (
            <p className="mt-2 text-xs text-brand-700">Email isn&apos;t configured — invites were created with secure links you can copy from each candidate.</p>
          ) : null}
          <button type="button" onClick={() => setResult(null)} className="btn-secondary mt-3 text-xs">Send another batch</button>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-zinc-700">Job</span>
              <select className="field-input" value={jobId} onChange={(e) => setJobId(e.target.value)}>
                <option value="">Choose a job…</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>{j.title}</option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-zinc-700">Screen</span>
              <select
                className="field-input"
                value={effectiveScreenKey}
                onChange={(e) => { setScreenKey(e.target.value); setScreenTouched(true); }}
              >
                <option value="">Choose a screen…</option>
                {screenOptions.map((o) => (
                  <option key={o.key} value={o.key}>{o.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter candidates by name or email"
                className="field-input flex-1 py-1.5 text-sm"
              />
              <button type="button" onClick={selectAllFiltered} className="btn-secondary px-2.5 py-1.5 text-xs">
                {allFilteredSelected ? "Clear shown" : "Select shown"}
              </button>
            </div>
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-zinc-200 p-2">
              {filtered.length === 0 ? (
                <p className="py-4 text-center text-xs text-zinc-400">No candidates with an email match your filter.</p>
              ) : (
                filtered.map((c) => (
                  <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-zinc-50">
                    <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} className="h-4 w-4 accent-brand-600" />
                    <span className="font-medium text-zinc-800">{c.name || c.email}</span>
                    <span className="truncate text-xs text-zinc-400">{c.email}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-xs text-zinc-700">
              <input type="checkbox" checked={resend} onChange={(e) => setResend(e.target.checked)} className="h-4 w-4 accent-brand-600" />
              Resend to candidates who already have an active invite
            </label>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-zinc-600">{selected.size} selected</span>
              <button type="button" onClick={send} disabled={busy || selected.size === 0} className="btn-primary text-sm">
                {busy ? "Sending…" : `Send to ${selected.size}`}
              </button>
            </div>
          </div>

          {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p> : null}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "green" | "amber" | "red" }) {
  const cls = tone === "green" ? "text-green-700" : tone === "amber" ? "text-amber-700" : tone === "red" ? "text-red-600" : "text-zinc-900";
  return (
    <div className="rounded-md bg-white p-2">
      <p className={`text-lg font-bold ${cls}`}>{value}</p>
      <p className="text-[11px] text-zinc-500">{label}</p>
    </div>
  );
}

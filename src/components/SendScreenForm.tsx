"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type JobOption = { id: string; title: string; screenKey: string };
type ScreenOption = { key: string; label: string };

/**
 * Recruiter action: send a role-specific skills screen to this candidate.
 * Picking a job pre-selects that job's screen template (overridable). On
 * success it either confirms the email or surfaces a secure copy-link — which
 * always works, even with no SMTP configured.
 */
export function SendScreenForm({
  orgSlug,
  candidateId,
  jobs,
  screenOptions,
  triggerClassName = "btn-primary text-sm",
  triggerLabel = "Send skills screen",
}: {
  orgSlug: string;
  candidateId: string;
  jobs: JobOption[];
  screenOptions: ScreenOption[];
  triggerClassName?: string;
  triggerLabel?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [jobId, setJobId] = useState("");
  const [screenKey, setScreenKey] = useState("");
  const [screenTouched, setScreenTouched] = useState(false);
  const [message, setMessage] = useState("");
  const [expiresDays, setExpiresDays] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ emailed: boolean; link: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Default the screen to the selected job's configured template until the
  // recruiter explicitly overrides it.
  const selectedJob = jobs.find((j) => j.id === jobId);
  const effectiveScreenKey = useMemo(() => {
    if (screenTouched && screenKey) return screenKey;
    return selectedJob?.screenKey || screenKey;
  }, [screenTouched, screenKey, selectedJob]);

  function reset() {
    setJobId("");
    setScreenKey("");
    setScreenTouched(false);
    setMessage("");
    setExpiresDays("");
    setError("");
    setResult(null);
    setCopied(false);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!jobId) {
      setError("Choose a job to screen this candidate for.");
      return;
    }
    if (!effectiveScreenKey) {
      setError("Choose a screen template — this job has none configured.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/o/${orgSlug}/candidates/${candidateId}/screen-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: jobId,
          screen_key: effectiveScreenKey,
          message,
          expires_days: expiresDays ? Number(expiresDays) : undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; emailed?: boolean; link?: string };
      if (!res.ok) {
        setError(data.error ?? "Couldn't send the screen.");
        return;
      }
      setResult({ emailed: Boolean(data.emailed), link: data.link ?? "" });
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!result?.link) return;
    try {
      await navigator.clipboard.writeText(result.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  if (jobs.length === 0) {
    return null;
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={triggerClassName}>
        {triggerLabel}
      </button>
    );
  }

  return (
    <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      {result ? (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-zinc-900">
            {result.emailed ? "Skills screen sent" : "Secure screen link ready"}
          </p>
          {result.emailed ? (
            <p className="text-sm text-zinc-600">
              We emailed the candidate a link to complete their screen. You&apos;ll see the score here once they finish.
            </p>
          ) : (
            <p className="text-sm text-zinc-600">Send this secure link to the candidate:</p>
          )}
          {result.link ? (
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={result.link}
                onFocus={(e) => e.currentTarget.select()}
                className="field-input flex-1 text-xs"
              />
              <button type="button" onClick={copyLink} className="btn-secondary whitespace-nowrap text-sm">
                {copied ? "Copied!" : "Copy link"}
              </button>
            </div>
          ) : null}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={reset}
              className="text-sm text-brand-700 hover:underline"
            >
              Send another
            </button>
            <button
              type="button"
              onClick={() => {
                reset();
                setOpen(false);
              }}
              className="text-sm text-zinc-500 hover:underline"
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-zinc-900">Send skills screen</p>
            <button
              type="button"
              onClick={() => {
                reset();
                setOpen(false);
              }}
              className="text-xs text-zinc-400 hover:text-zinc-600"
            >
              Cancel
            </button>
          </div>
          <p className="text-xs text-zinc-500">
            Know who can actually do the job before you interview. The candidate completes a short, role-specific screen —
            no login required.
          </p>

          <label className="block space-y-1">
            <span className="section-label">Job / req</span>
            <select
              value={jobId}
              disabled={busy}
              onChange={(e) => {
                setJobId(e.target.value);
                if (!screenTouched) setScreenKey("");
              }}
              className="field-input w-full"
            >
              <option value="">Choose a job…</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1">
            <span className="section-label">Screen template</span>
            <select
              value={effectiveScreenKey}
              disabled={busy}
              onChange={(e) => {
                setScreenKey(e.target.value);
                setScreenTouched(true);
              }}
              className="field-input w-full"
            >
              <option value="">Choose a screen…</option>
              {screenOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
            {selectedJob && selectedJob.screenKey && !screenTouched ? (
              <span className="text-[11px] text-zinc-400">Defaulted from this job&apos;s screen.</span>
            ) : null}
          </label>

          <label className="block space-y-1">
            <span className="section-label">Message to candidate (optional)</span>
            <textarea
              value={message}
              disabled={busy}
              onChange={(e) => setMessage(e.target.value)}
              className="field-input min-h-16 w-full"
              placeholder="A short personal note (optional)."
              maxLength={1000}
            />
          </label>

          <label className="block space-y-1">
            <span className="section-label">Link expires (optional)</span>
            <select
              value={expiresDays}
              disabled={busy}
              onChange={(e) => setExpiresDays(e.target.value)}
              className="field-input w-full"
            >
              <option value="">Never</option>
              <option value="3">In 3 days</option>
              <option value="7">In 7 days</option>
              <option value="14">In 14 days</option>
              <option value="30">In 30 days</option>
            </select>
          </label>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button type="submit" disabled={busy || !jobId} className="btn-primary w-full text-sm">
            {busy ? "Sending…" : "Send skills screen"}
          </button>
        </form>
      )}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type JobRow = {
  id: string;
  title: string;
  status: string;
  url: string;
  error: string;
  syncedAt: string | null;
};

const STATUS_STYLE: Record<string, string> = {
  posted: "bg-green-100 text-green-800",
  error: "bg-red-100 text-red-700",
  "": "bg-zinc-100 text-zinc-600",
};

export function HundredHiresToggle({ orgSlug, enabled }: { orgSlug: string; enabled: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !on;
    setBusy(true);
    setOn(next); // optimistic
    try {
      const res = await fetch(`/api/o/${orgSlug}/integrations/hundredhires/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const data = (await res.json()) as { ok?: boolean; enabled?: boolean };
      if (!data.ok) setOn(!next);
      else setOn(Boolean(data.enabled));
      router.refresh();
    } catch {
      setOn(!next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      role="switch"
      aria-checked={on}
      className={`relative inline-flex h-6 w-11 flex-none items-center rounded-full transition ${
        on ? "bg-green-600" : "bg-zinc-300"
      } disabled:opacity-60`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
          on ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export function HundredHiresControls({ orgSlug, jobs }: { orgSlug: string; jobs: JobRow[] }) {
  const router = useRouter();
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function testConnection() {
    setTesting(true);
    setTestMsg(null);
    try {
      const res = await fetch(`/api/o/${orgSlug}/integrations/hundredhires/test`, { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      setTestMsg(
        data.ok
          ? { ok: true, text: "Connected — your 100Hires API key works." }
          : { ok: false, text: data.error ?? "Connection failed." },
      );
    } catch {
      setTestMsg({ ok: false, text: "Connection failed." });
    } finally {
      setTesting(false);
    }
  }

  async function resync(jobId: string) {
    setBusyId(jobId);
    try {
      await fetch(`/api/o/${orgSlug}/jobs/${jobId}/syndicate`, { method: "POST" });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={testConnection} disabled={testing} className="btn-secondary text-sm">
          {testing ? "Testing…" : "Test connection"}
        </button>
        {testMsg ? (
          <span className={`text-sm ${testMsg.ok ? "text-green-700" : "text-red-600"}`}>{testMsg.text}</span>
        ) : null}
      </div>

      {jobs.length === 0 ? (
        <p className="text-sm text-zinc-500">Publish a job and it will post to 100Hires automatically.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-4 py-3 font-medium">Job</th>
                <th className="px-4 py-3 font-medium">100Hires status</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-b border-zinc-100 align-top last:border-0">
                  <td className="px-4 py-3 font-medium text-zinc-900">{job.title}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        STATUS_STYLE[job.status] ?? STATUS_STYLE[""]
                      }`}
                    >
                      {job.status === "posted" ? "Posted" : job.status === "error" ? "Error" : "Not synced"}
                    </span>
                    {job.status === "posted" && job.url ? (
                      <a href={job.url} target="_blank" rel="noreferrer" className="ml-2 text-xs text-blue-600 hover:underline">
                        View on 100Hires ↗
                      </a>
                    ) : null}
                    {job.status === "error" && job.error ? (
                      <p className="mt-1 text-xs text-red-600">{job.error}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => resync(job.id)}
                      disabled={busyId === job.id}
                      className="text-sm font-medium text-blue-600 hover:underline disabled:opacity-50"
                    >
                      {busyId === job.id ? "Posting…" : job.status === "posted" ? "Re-sync" : "Post now"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

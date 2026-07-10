"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * First-run choice: explore a clearly-labelled demo workspace, or start clean
 * with a real job. Also handles dismissing the checklist. Server decides
 * whether to render these based on org state.
 */
export function OnboardingChoices({ orgSlug, createHref }: { orgSlug: string; createHref: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function loadDemo() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/o/${orgSlug}/demo-seed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seed" }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? "Couldn't load demo data.");
        setBusy(false);
        return;
      }
      router.push(`/o/${orgSlug}/admin`);
      router.refresh();
    } catch {
      setError("Network error.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-4 lg:grid-cols-3">
        <button
          type="button"
          onClick={loadDemo}
          disabled={busy}
          className="card card-hover flex flex-col items-start gap-2 text-left disabled:opacity-60"
        >
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
            Demo Workspace
          </span>
          <span className="text-lg font-semibold text-zinc-900">Explore demo data</span>
          <span className="text-sm text-zinc-600">
            See how the Resume Trap, skills scores, and Call Queue work with sample candidates. Clearly labelled — you
            can exit it in one click.
          </span>
          <span className="mt-1 text-sm font-medium text-brand-700">{busy ? "Loading…" : "Load sample workspace →"}</span>
        </button>

        <Link href={createHref} className="card card-hover flex flex-col items-start gap-2 text-left">
          <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">Recommended</span>
          <span className="text-lg font-semibold text-zinc-900">Start with my real hiring team</span>
          <span className="text-sm text-zinc-600">
            Create your first job and start collecting real applicants — no sample data. We&apos;ll guide you with the
            checklist below.
          </span>
          <span className="mt-1 text-sm font-medium text-brand-700">Create your first job →</span>
        </Link>

        <Link
          href={`/o/${orgSlug}/admin/candidates/import`}
          className="card card-hover flex flex-col items-start gap-2 text-left"
        >
          <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-600">Import</span>
          <span className="text-lg font-semibold text-zinc-900">Import candidates / resumes</span>
          <span className="text-sm text-zinc-600">
            Already have candidates or a stack of resumes? Bring them into your pool and screen them.
          </span>
          <span className="mt-1 text-sm font-medium text-brand-700">Import candidates →</span>
        </Link>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

/** Small client button to dismiss the checklist and go to the dashboard. */
export function DismissOnboarding({ orgSlug }: { orgSlug: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function dismiss() {
    setBusy(true);
    await fetch(`/api/o/${orgSlug}/onboarding/dismiss`, { method: "POST" }).catch(() => {});
    router.push(`/o/${orgSlug}/admin`);
    router.refresh();
  }
  return (
    <button type="button" onClick={dismiss} disabled={busy} className="btn-secondary text-sm">
      {busy ? "…" : "Dismiss & go to dashboard →"}
    </button>
  );
}

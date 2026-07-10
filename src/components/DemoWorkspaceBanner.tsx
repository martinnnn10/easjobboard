"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * Persistent banner shown across the admin app while an org is in demo mode, so
 * a sample workspace can never be mistaken for real customer data. Offers the
 * two paths the audit requires: create a real job, or exit the demo.
 */
export function DemoWorkspaceBanner({ orgSlug }: { orgSlug: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function exitDemo() {
    if (!confirm("Exit the demo and remove all sample candidates and jobs? This can't be undone.")) return;
    setBusy(true);
    try {
      await fetch(`/api/o/${orgSlug}/demo-seed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear" }),
      });
      router.push(`/o/${orgSlug}/admin/onboarding`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-b border-amber-200 bg-amber-50">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Demo Workspace
        </span>
        <p className="min-w-0 flex-1 text-sm text-amber-900">
          These are sample candidates showing how Resume Trap, skills scores, and the Call Queue work.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href={`/o/${orgSlug}/admin/jobs/new`} className="btn-primary px-3 py-1.5 text-sm">
            Create my real job
          </Link>
          <button
            type="button"
            onClick={exitDemo}
            disabled={busy}
            className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:opacity-60"
          >
            {busy ? "Exiting…" : "Exit demo"}
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * One-click loader for the sales-demo dataset. Shown on the dashboard so a
 * recruiter (or a sales demo) can populate a screened pipeline instantly.
 */
export function DemoSeedButton({ orgSlug, className }: { orgSlug: string; className?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function loadDemo() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/o/${orgSlug}/demo-seed`, { method: "POST" });
      const data = (await response.json()) as { seeded?: boolean; error?: string };
      if (!response.ok) {
        setMessage(data.error ?? "Failed to load demo data");
        return;
      }
      setMessage(data.seeded ? "Demo data loaded." : "Demo data already present.");
      router.refresh();
    } catch {
      setMessage("Failed to load demo data.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button type="button" onClick={loadDemo} disabled={loading} className={className ?? "btn-secondary"}>
        {loading ? "Loading…" : "Load sample data"}
      </button>
      {message ? <span className="text-xs text-zinc-500">{message}</span> : null}
    </div>
  );
}

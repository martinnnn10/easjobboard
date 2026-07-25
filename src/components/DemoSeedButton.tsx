"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Loads or clears the labelled sample dataset. In demo mode it becomes a
 * "Clear demo data" control so an org can convert to a clean real workspace.
 */
export function DemoSeedButton({
  orgSlug,
  isDemo = false,
  className,
}: {
  orgSlug: string;
  isDemo?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function run(action: "seed" | "clear") {
    if (action === "clear" && !confirm("Remove all demo jobs and sample candidates? This can't be undone.")) return;
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/o/${orgSlug}/demo-seed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await response.json()) as { seeded?: boolean; cleared?: boolean; error?: string };
      if (!response.ok) {
        setMessage(data.error ?? "Something went wrong.");
        return;
      }
      router.refresh();
    } catch {
      setMessage("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => run(isDemo ? "clear" : "seed")}
        disabled={loading}
        className={className ?? "btn-secondary"}
      >
        {loading ? (isDemo ? "Clearing…" : "Loading…") : isDemo ? "Clear demo data & start fresh" : "Load sample data"}
      </button>
      {message ? <span className="text-xs text-zinc-500">{message}</span> : null}
    </div>
  );
}

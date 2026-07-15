"use client";

import { useState } from "react";

/**
 * A job-feed card whose primary action is "Copy feed URL" — the feed is meant
 * to be registered with a job board, not browsed. Opening the raw XML/JSON is a
 * clearly-labelled secondary action, so non-technical users never feel dumped
 * into code.
 */
export function FeedCard({
  label,
  description,
  url,
  ready,
}: {
  label: string;
  description: string;
  url: string;
  ready: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (e.g. insecure context) — the field is selectable as a fallback.
    }
  }

  return (
    <div className="card space-y-3">
      <div>
        <p className="font-medium text-zinc-900">{label}</p>
        <p className="mt-0.5 text-xs text-zinc-500">{description}</p>
      </div>

      {ready ? (
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor={`feed-${label}`}>
            {label} URL
          </label>
          <input
            id={`feed-${label}`}
            readOnly
            value={url}
            onFocus={(event) => event.currentTarget.select()}
            className="min-w-0 flex-1 basis-64 rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 font-mono text-xs text-zinc-700"
          />
          <button type="button" onClick={copy} className="btn-primary shrink-0 text-sm">
            {copied ? "Copied ✓" : "Copy feed URL"}
          </button>
          <a href={url} target="_blank" rel="noreferrer" className="btn-secondary shrink-0 text-sm">
            Open raw feed
          </a>
        </div>
      ) : (
        <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500">
          Set your public domain in Settings to generate this feed URL.
        </p>
      )}
    </div>
  );
}

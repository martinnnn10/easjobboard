"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ChannelView, StatusTone } from "@/lib/distribution";

const TONE_CLASS: Record<StatusTone, string> = {
  live: "bg-green-100 text-green-800",
  eligible: "bg-blue-100 text-blue-800",
  ready: "bg-amber-100 text-amber-800",
  off: "bg-zinc-100 text-zinc-500",
};

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  }
  return (
    <button type="button" onClick={copy} className="btn-secondary text-xs">
      {copied ? "Copied ✓" : label}
    </button>
  );
}

export function DistributionPanel({
  orgSlug,
  jobId,
  writable,
  published,
  channels,
  links,
  feedUrl,
  linkedInText,
  manualPostingText,
}: {
  orgSlug: string;
  jobId: string;
  writable: boolean;
  published: boolean;
  channels: ChannelView[];
  links: { public: string; apply: string; flyer: string };
  feedUrl: string;
  linkedInText: string;
  manualPostingText: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function setStatus(channel: string, status: string) {
    setBusy(channel);
    try {
      const res = await fetch(`/api/o/${orgSlug}/jobs/${jobId}/distribution`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, status }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Job distribution</h2>
        <p className="text-sm text-zinc-600">
          Where this job is live, eligible, or needs a manual share. We don&apos;t claim a board auto-posts your job
          unless a real integration confirms it.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {channels.map((ch) => (
          <div key={ch.channel} className="card space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-zinc-900">{ch.name}</p>
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE_CLASS[ch.tone]}`}>
                {ch.label}
              </span>
            </div>
            <p className="text-xs text-zinc-500">{ch.detail}</p>
            {writable && published && ch.manualOptions.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] uppercase tracking-wide text-zinc-400">Mark:</span>
                {ch.manualOptions.map((opt) => {
                  const active = ch.manual === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={busy === ch.channel}
                      onClick={() => setStatus(ch.channel, active ? "" : opt.value)}
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                        active
                          ? "border-brand-600 bg-brand-600 text-white"
                          : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
                {ch.manual ? (
                  <button
                    type="button"
                    disabled={busy === ch.channel}
                    onClick={() => setStatus(ch.channel, "")}
                    className="text-xs text-zinc-500 hover:text-zinc-800"
                  >
                    Reset to auto
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {/* Share + copy actions */}
      <div className="card space-y-3">
        <p className="text-sm font-medium text-zinc-900">Links &amp; share text</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <LinkRow label="Public job link" url={links.public} />
          <LinkRow label="Apply link" url={links.apply} />
          <LinkRow label="Flyer" url={links.flyer} />
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3">
          <CopyButton text={feedUrl} label="Copy feed URL" />
          <CopyButton text={linkedInText} label="Copy LinkedIn share text" />
          <CopyButton text={manualPostingText} label="Copy manual posting text" />
        </div>
      </div>
    </section>
  );
}

function LinkRow({ label, url }: { label: string; url: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-zinc-600">{label}</p>
      <div className="flex items-center gap-1.5">
        <a href={url} target="_blank" rel="noreferrer" className="truncate text-xs text-brand-700 hover:underline">
          Open
        </a>
        <CopyButton text={url} />
      </div>
    </div>
  );
}

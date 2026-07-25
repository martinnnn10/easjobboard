"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Careers-page logo manager (owner only). Uploads a PNG/JPG/WebP to
 * /api/o/<slug>/logo, previews it, and can remove it (reverting to initials).
 */
export function LogoUpload({
  orgSlug,
  hasLogo,
  brandColor,
  initials,
}: {
  orgSlug: string;
  hasLogo: boolean;
  brandColor: string;
  initials: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Bumped after each change to bust the /logo cache in the preview.
  const [version, setVersion] = useState(0);
  const [present, setPresent] = useState(hasLogo);

  async function upload(file: File) {
    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("logo", file);
      const res = await fetch(`/api/o/${orgSlug}/logo`, { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Upload failed.");
        return;
      }
      setPresent(true);
      setVersion((v) => v + 1);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/o/${orgSlug}/logo`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Failed to remove logo.");
        return;
      }
      setPresent(false);
      setVersion((v) => v + 1);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-2xl font-bold text-white ring-1 ring-black/5"
          style={present ? { backgroundColor: "#fff" } : { backgroundColor: brandColor }}
        >
          {present ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/o/${orgSlug}/logo?v=${version}`}
              alt="Careers logo"
              className="h-full w-full object-contain p-1"
            />
          ) : (
            initials || "•"
          )}
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <label className="btn-secondary cursor-pointer text-sm">
              {present ? "Replace logo" : "Upload logo"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) upload(f);
                  e.target.value = "";
                }}
              />
            </label>
            {present ? (
              <button type="button" onClick={remove} disabled={busy} className="text-sm text-zinc-500 hover:text-zinc-800">
                Remove
              </button>
            ) : null}
          </div>
          <p className="text-xs text-zinc-500">
            Shown on your public careers page. PNG, JPG, or WebP · square works best · under 1 MB.
            {present ? "" : " Until you upload one, your company initials are used."}
          </p>
        </div>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

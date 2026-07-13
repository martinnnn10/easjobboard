"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function OrgSettingsForm({
  orgSlug,
  initial,
}: {
  orgSlug: string;
  initial: { name: string; application_email: string; website: string; organization_type: string };
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    const form = new FormData(event.currentTarget);
    try {
      const res = await fetch(`/api/o/${orgSlug}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          application_email: form.get("application_email"),
          website: form.get("website"),
          organization_type: form.get("organization_type"),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Couldn't save.");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <h2 className="text-base font-semibold text-zinc-900">Organization</h2>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Name</span>
        <input name="name" defaultValue={initial.name} required className="field-input" />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Careers inbox email</span>
        <input name="application_email" type="email" defaultValue={initial.application_email} className="field-input" />
        <span className="text-xs text-zinc-500">Applicant resumes and confirmations are delivered here.</span>
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Website</span>
        <input name="website" type="url" defaultValue={initial.website} placeholder="https://…" className="field-input" />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Workspace type</span>
        <select name="organization_type" defaultValue={initial.organization_type} className="field-input">
          <option value="in_house">In-house hiring team</option>
          <option value="agency">Staffing / recruiting agency</option>
        </select>
        <span className="text-xs text-zinc-500">
          Tailors labels across the app — “Jobs / Applicants” for in-house teams, “Job Orders / Candidates” for agencies.
        </span>
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {saved ? <p className="text-sm text-brand-700">Saved.</p> : null}
      <button type="submit" disabled={saving} className="btn-primary">
        {saving ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}

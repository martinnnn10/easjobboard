"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CANDIDATE_CRM_STATUSES,
  CANDIDATE_CRM_STATUS_LABELS,
  CANDIDATE_SOURCES,
  CANDIDATE_SOURCE_LABELS,
} from "@/lib/candidate-meta";

type CandidateResponse = {
  candidate?: { id: string; name?: string; email?: string };
  matched?: boolean;
  matchedBy?: string;
  error?: string;
};

const MATCH_LABEL: Record<string, string> = {
  email: "email",
  phone: "phone number",
  "name+company": "name & company",
  "name+location": "name & location",
};

export function AddCandidateForm({ orgSlug }: { orgSlug: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    const form = new FormData(event.currentTarget);
    const splitList = (v: FormDataEntryValue | null) =>
      String(v ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

    const payload = {
      name: String(form.get("name") ?? "").trim(),
      email: String(form.get("email") ?? "").trim(),
      phone: String(form.get("phone") ?? "").trim(),
      location: String(form.get("location") ?? "").trim(),
      title: String(form.get("title") ?? "").trim(),
      company: String(form.get("company") ?? "").trim(),
      source: String(form.get("source") ?? "sourced"),
      source_provider: String(form.get("source_provider") ?? "").trim(),
      source_url: String(form.get("source_url") ?? "").trim(),
      crm_status: String(form.get("crm_status") ?? ""),
      skills: splitList(form.get("skills")),
      tags: splitList(form.get("tags")),
      notes: String(form.get("notes") ?? "").trim(),
    };

    try {
      const res = await fetch(`/api/o/${orgSlug}/candidates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as CandidateResponse;
      if (!res.ok || !data.candidate) {
        setError(data.error ?? "Couldn't add candidate.");
        return;
      }
      if (data.matched) {
        const how = data.matchedBy ? MATCH_LABEL[data.matchedBy] ?? data.matchedBy : "an existing record";
        setNotice(`Already in your pool (matched by ${how}). Opening their profile…`);
      }
      router.push(`/o/${orgSlug}/admin/candidates/${data.candidate.id}`);
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Full name</span>
          <input name="name" placeholder="Jordan Rivera" className="field-input" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">
            Email <span className="text-red-600">*</span>
          </span>
          <input name="email" type="email" required placeholder="jordan@example.com" className="field-input" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Phone</span>
          <input name="phone" placeholder="(555) 123-4567" className="field-input" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Location</span>
          <input name="location" placeholder="Batavia, IL" className="field-input" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Current title</span>
          <input name="title" placeholder="Journeyman Electrician" className="field-input" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Current company</span>
          <input name="company" placeholder="Acme Controls" className="field-input" />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Source</span>
          <select name="source" defaultValue="sourced" className="field-input">
            {CANDIDATE_SOURCES.filter((s) => s !== "applied").map((s) => (
              <option key={s} value={s}>
                {CANDIDATE_SOURCE_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Provider</span>
          <input name="source_provider" placeholder="Apollo, LinkedIn, referral…" className="field-input" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Status</span>
          <select name="crm_status" defaultValue="needs_outreach" className="field-input">
            {CANDIDATE_CRM_STATUSES.map((s) => (
              <option key={s} value={s}>
                {CANDIDATE_CRM_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Source profile URL</span>
        <input name="source_url" type="url" placeholder="https://…" className="field-input" />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Skills</span>
          <input name="skills" placeholder="PLC, SCADA, VFD (comma separated)" className="field-input" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Tags</span>
          <input name="tags" placeholder="Top prospect, Passive (comma separated)" className="field-input" />
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-sm font-medium">First note (optional)</span>
        <textarea
          name="notes"
          placeholder="Where you found them, why they're a fit, next step…"
          className="field-input min-h-20"
        />
      </label>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {notice ? <p className="text-sm text-amber-700">{notice}</p> : null}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? "Saving…" : "Add to pool"}
        </button>
        <a href={`/o/${orgSlug}/admin/candidates`} className="text-sm text-zinc-500 hover:underline">
          Cancel
        </a>
      </div>
    </form>
  );
}

"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CANDIDATE_SOURCE_LABELS, IMPORT_SOURCES } from "@/lib/candidate-meta";

type JobOption = { id: string; title: string };
type Member = { id: string; name: string };
type Duplicate = { id: string; name: string; matchedBy: string };

const MATCH_LABEL: Record<string, string> = {
  email: "email",
  phone: "phone number",
  "name+company": "name & company",
  "name+location": "name & location",
};

export function AddCandidateForm({
  orgSlug,
  jobs,
  recruiters,
}: {
  orgSlug: string;
  jobs: JobOption[];
  recruiters: Member[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [duplicate, setDuplicate] = useState<Duplicate | null>(null);

  async function submit(force: boolean) {
    const el = formRef.current;
    if (!el) return;
    setSaving(true);
    setError("");
    const data = new FormData(el);
    if (force) data.set("force", "true");
    try {
      const res = await fetch(`/api/o/${orgSlug}/candidates/import`, { method: "POST", body: data });
      if (res.status === 409) {
        const d = (await res.json().catch(() => ({}))) as { duplicate?: Duplicate };
        if (d.duplicate) {
          setDuplicate(d.duplicate);
          return;
        }
      }
      const body = (await res.json().catch(() => ({}))) as { candidate?: { id: string }; error?: string };
      if (!res.ok || !body.candidate) {
        setError(body.error ?? "Couldn't import candidate.");
        return;
      }
      router.push(`/o/${orgSlug}/admin/candidates/${body.candidate.id}`);
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setDuplicate(null);
    submit(false);
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="card space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-sm font-medium">First name</span>
          <input name="first_name" placeholder="Jordan" className="field-input" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Last name</span>
          <input name="last_name" placeholder="Rivera" className="field-input" />
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
        <label className="block space-y-1">
          <span className="text-sm font-medium">Source</span>
          <select name="source" defaultValue="manual" className="field-input">
            {IMPORT_SOURCES.map((s) => (
              <option key={s} value={s}>
                {CANDIDATE_SOURCE_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Attach to job (optional)</span>
          <select name="job_id" defaultValue="" className="field-input">
            <option value="">Don&apos;t attach yet</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Assign recruiter (optional)</span>
          <select name="owner_user_id" defaultValue="" className="field-input">
            <option value="">Unassigned</option>
            {recruiters.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Resume (PDF, DOC, DOCX) — optional</span>
        <input
          name="resume"
          type="file"
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="block w-full text-sm text-zinc-700"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium">First note (optional)</span>
        <textarea
          name="notes"
          placeholder="Where you found them, why they're a fit, next step…"
          className="field-input min-h-20"
        />
      </label>

      {duplicate ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
          <p className="font-semibold text-amber-900">Possible duplicate</p>
          <p className="mt-1 text-amber-800">
            A candidate matching this {MATCH_LABEL[duplicate.matchedBy] ?? "record"} is already in your pool
            {duplicate.name ? ` (${duplicate.name})` : ""}.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={`/o/${orgSlug}/admin/candidates/${duplicate.id}`} className="btn-secondary text-sm">
              Open existing profile
            </a>
            <button type="button" onClick={() => submit(true)} disabled={saving} className="btn-primary text-sm">
              {saving ? "Adding…" : "Add anyway"}
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? "Importing…" : "Add candidate"}
        </button>
        <a href={`/o/${orgSlug}/admin/candidates`} className="text-sm text-zinc-500 hover:underline">
          Cancel
        </a>
      </div>
    </form>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  IMPORT_PLATFORMS,
  EAS_IMPORT_FIELDS,
  TEMPLATE_COLUMNS,
  autoDetectMapping,
  parseCsv,
  getImportPlatform,
} from "@/lib/import-format";

type JobOption = { id: string; title: string; status: string };

type ClassifiedRow = {
  index: number;
  status: "valid" | "duplicate" | "needs_review" | "missing_contact" | "invalid";
  name: string;
  email: string;
  phone: string;
  matchedBy?: string;
  reason?: string;
};
type Preview = {
  total: number; valid: number; duplicates: number; needsReview: number;
  missingContact: number; invalid: number; withResumeFilename: number; rows: ClassifiedRow[];
};
type ImportResult = {
  batchId: string; total: number; created: number; updated: number; skipped: number;
  failed: number; createdIds: string[]; errors: { row: number; name: string; reason: string }[];
};

type Step = "source" | "upload" | "map" | "preview" | "done";

const STATUS_STYLE: Record<ClassifiedRow["status"], { label: string; cls: string }> = {
  valid: { label: "New", cls: "bg-brand-50 text-brand-700 ring-1 ring-brand-100" },
  duplicate: { label: "Duplicate", cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-200" },
  needs_review: { label: "Needs review", cls: "bg-zinc-100 text-zinc-600" },
  missing_contact: { label: "No contact", cls: "bg-red-50 text-red-600 ring-1 ring-red-100" },
  invalid: { label: "Skip", cls: "bg-red-50 text-red-600 ring-1 ring-red-100" },
};

const STEPS: { key: Step; label: string }[] = [
  { key: "source", label: "Source" },
  { key: "upload", label: "Upload" },
  { key: "map", label: "Map columns" },
  { key: "preview", label: "Preview" },
  { key: "done", label: "Done" },
];

function csvEscape(v: string): string {
  let s = String(v ?? "");
  // Neutralise spreadsheet formula injection (=, +, -, @, tabs) in exported CSVs.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function downloadCsv(filename: string, rows: string[][]) {
  const text = rows.map((r) => r.map((c) => csvEscape(String(c ?? ""))).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function ImportCenter({ orgSlug, jobs }: { orgSlug: string; jobs: JobOption[] }) {
  const [step, setStep] = useState<Step>("source");
  const [platform, setPlatform] = useState<string>("");
  const [filename, setFilename] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [dataRows, setDataRows] = useState<string[][]>([]);
  const [columnMap, setColumnMap] = useState<Record<number, string>>({});
  const [preview, setPreview] = useState<Preview | null>(null);
  const [strategy, setStrategy] = useState<"skip" | "update" | "new">("skip");
  const [attachJobId, setAttachJobId] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const activePlatform = getImportPlatform(platform);

  // EAS field key -> column index, for the request (first column wins per field).
  const fieldMapping = useMemo(() => {
    const m: Record<string, number> = {};
    for (const [colStr, field] of Object.entries(columnMap)) {
      if (field && m[field] == null) m[field] = Number(colStr);
    }
    return m;
  }, [columnMap]);

  const hasMinMapping = fieldMapping.first_name != null && (fieldMapping.email != null || fieldMapping.phone != null);

  function reset() {
    setStep("source"); setPlatform(""); setFilename(""); setHeaders([]); setDataRows([]);
    setColumnMap({}); setPreview(null); setStrategy("skip"); setAttachJobId(""); setResult(null); setError("");
  }

  function pickPlatform(key: string) {
    setPlatform(key); setError(""); setStep("upload");
  }

  async function onFile(file: File) {
    setError("");
    if (file.size > 8 * 1024 * 1024) { setError("File is over 8 MB. Split it and import in batches."); return; }
    const text = await file.text();
    const parsed = parseCsv(text);
    if (parsed.length < 2) { setError("That file has no data rows under the header. Check the export and try again."); return; }
    const hdr = parsed[0];
    const rows = parsed.slice(1);
    if (rows.length > 5000) { setError(`That file has ${rows.length} rows (max 5000). Split it and import in batches.`); return; }
    setFilename(file.name);
    setHeaders(hdr);
    setDataRows(rows);
    setColumnMap(autoDetectMapping(hdr));
    setStep("map");
  }

  async function runPreview() {
    setBusy(true); setError("");
    try {
      const res = await fetch(`/api/o/${orgSlug}/candidates/import/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, filename, mapping: fieldMapping, rows: dataRows, dryRun: true }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Preview failed."); return; }
      setPreview(data.preview);
      setStep("preview");
    } finally {
      setBusy(false);
    }
  }

  async function runImport() {
    setBusy(true); setError("");
    try {
      const res = await fetch(`/api/o/${orgSlug}/candidates/import/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, filename, mapping: fieldMapping, rows: dataRows, strategy, attachJobId: attachJobId || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Import failed."); return; }
      setResult(data.result);
      setStep("done");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Step rail */}
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium">
        {STEPS.map((s, i) => {
          const activeIdx = STEPS.findIndex((x) => x.key === step);
          const state = i < activeIdx ? "done" : i === activeIdx ? "current" : "todo";
          return (
            <li key={s.key} className="flex items-center gap-2">
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${
                  state === "current" ? "bg-brand-600 text-white"
                    : state === "done" ? "bg-brand-100 text-brand-700"
                    : "bg-zinc-100 text-zinc-400"
                }`}
              >
                {state === "done" ? "✓" : i + 1}
              </span>
              <span className={state === "todo" ? "text-zinc-400" : "text-zinc-700"}>{s.label}</span>
              {i < STEPS.length - 1 ? <span className="text-zinc-300">→</span> : null}
            </li>
          );
        })}
      </ol>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      {/* STEP 1 — Source */}
      {step === "source" ? (
        <section className="space-y-4">
          <div>
            <p className="eyebrow">Choose a source</p>
            <p className="mt-1 text-sm text-zinc-600">
              Import candidates from a CSV you export from a job board or ATS. EAS Recruit maps the file, dedupes against
              your pool, and lets you attach candidates to jobs or send skills screens. We never log in to or scrape
              third-party platforms — this only reads the file you upload.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {IMPORT_PLATFORMS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => pickPlatform(p.key)}
                className="feature-card text-left"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-900">{p.label}</span>
                  <span className="pill text-[10px] uppercase tracking-wide">
                    {p.kind === "jobboard" ? "Job board" : p.kind === "ats" ? "ATS export" : "Custom"}
                  </span>
                </div>
                <p className="mt-2 text-xs text-zinc-500">CSV export · map &amp; dedupe on import</p>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {/* STEP 2 — Upload */}
      {step === "upload" && activePlatform ? (
        <section className="card space-y-4">
          <div className="flex items-center justify-between">
            <p className="eyebrow">Upload · {activePlatform.label}</p>
            <button type="button" onClick={() => setStep("source")} className="back-link">← Change source</button>
          </div>
          <p className="rounded-lg bg-brand-50/60 px-4 py-3 text-sm text-zinc-700 ring-1 ring-brand-100">
            {activePlatform.guidance}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="btn-primary cursor-pointer text-sm">
              Choose CSV file
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
              />
            </label>
            <button
              type="button"
              onClick={() => downloadCsv("eas-recruit-import-template.csv", [TEMPLATE_COLUMNS, [
                "Jane", "Doe", "jane@example.com", "559-555-0100", "Fresno, CA", "Maintenance Tech", "Acme Foods",
                activePlatform.key, "Maintenance Technician", "REQ-123", "jane-doe.pdf", "Strong PLC background",
                "$32/hr", "2nd shift", "Yes", "PLC;VFD",
              ]])}
              className="btn-secondary text-sm"
            >
              Download CSV template
            </button>
          </div>
          <p className="text-xs text-zinc-500">
            CSV only for now (XLSX support is next). Resume files aren&apos;t uploaded in bulk yet — include a
            <code className="mx-1 rounded bg-zinc-100 px-1">resume_filename</code> column and upload resumes per candidate
            after import. Max 8 MB / 5,000 rows.
          </p>
        </section>
      ) : null}

      {/* STEP 3 — Map columns */}
      {step === "map" ? (
        <section className="card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="eyebrow">Map columns</p>
              <p className="mt-1 text-sm text-zinc-600">
                We auto-matched what we could from <span className="font-medium text-zinc-800">{filename}</span> ({dataRows.length} rows).
                Confirm each column, then preview.
              </p>
            </div>
            <button type="button" onClick={() => setStep("upload")} className="back-link">← Re-upload</button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-zinc-200">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Your column</th>
                  <th className="px-4 py-2.5 font-medium">Sample</th>
                  <th className="px-4 py-2.5 font-medium">Maps to EAS field</th>
                </tr>
              </thead>
              <tbody>
                {headers.map((h, i) => (
                  <tr key={i} className="border-b border-zinc-100 last:border-0">
                    <td className="px-4 py-2 font-medium text-zinc-800">{h || <span className="text-zinc-400">Column {i + 1}</span>}</td>
                    <td className="max-w-[16rem] truncate px-4 py-2 text-zinc-500">{dataRows[0]?.[i] ?? ""}</td>
                    <td className="px-4 py-2">
                      <select
                        value={columnMap[i] ?? ""}
                        onChange={(e) => setColumnMap((m) => ({ ...m, [i]: e.target.value }))}
                        className="field-input py-1.5 text-sm"
                      >
                        <option value="">— Ignore —</option>
                        {EAS_IMPORT_FIELDS.map((f) => (
                          <option key={f.key} value={f.key}>{f.label}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-zinc-500">
              Required: a name column, plus an email or phone column.
              {hasMinMapping ? <span className="ml-1 font-medium text-brand-700">Looks good ✓</span> : <span className="ml-1 font-medium text-amber-600">Map name + email/phone to continue.</span>}
            </p>
            <button type="button" disabled={!hasMinMapping || busy} onClick={runPreview} className="btn-primary text-sm">
              {busy ? "Checking…" : "Preview import →"}
            </button>
          </div>
        </section>
      ) : null}

      {/* STEP 4 — Preview */}
      {step === "preview" && preview ? (
        <section className="space-y-4">
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <p className="eyebrow">Preview — nothing imported yet</p>
              <button type="button" onClick={() => setStep("map")} className="back-link">← Adjust mapping</button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Stat label="Total rows" value={preview.total} />
              <Stat label="New" value={preview.valid} tone="text-brand-700" />
              <Stat label="Duplicates" value={preview.duplicates} tone="text-amber-600" />
              <Stat label="Needs review" value={preview.needsReview} />
              <Stat label="No contact" value={preview.missingContact + preview.invalid} tone={preview.missingContact + preview.invalid > 0 ? "text-red-600" : undefined} />
              <Stat label="Resume on file" value={preview.withResumeFilename} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="section-label">When a candidate already exists</span>
                <select value={strategy} onChange={(e) => setStrategy(e.target.value as typeof strategy)} className="field-input text-sm">
                  <option value="skip">Skip duplicates (recommended)</option>
                  <option value="update">Update only missing fields</option>
                  <option value="new">Import as new anyway</option>
                </select>
              </label>
              <label className="block space-y-1">
                <span className="section-label">Attach imported candidates to</span>
                <select value={attachJobId} onChange={(e) => setAttachJobId(e.target.value)} className="field-input text-sm">
                  <option value="">Talent pool only (no job)</option>
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>{j.title}{j.status !== "published" ? ` (${j.status})` : ""}</option>
                  ))}
                </select>
              </label>
            </div>
            <p className="text-xs text-zinc-500">
              {preview.needsReview + preview.missingContact + preview.invalid > 0
                ? `${preview.needsReview + preview.missingContact + preview.invalid} row(s) can't import (missing name/email) and will be skipped — you can download the error report after.`
                : "Every row has the contact info needed to import."}
              {" "}No emails or skills screens are sent automatically.
            </p>
            <div className="flex items-center justify-end">
              <button type="button" disabled={busy || preview.valid + preview.duplicates === 0} onClick={runImport} className="btn-primary">
                {busy ? "Importing…" : `Import ${strategy === "skip" ? preview.valid : preview.valid + preview.duplicates} candidate(s)`}
              </button>
            </div>
          </div>

          {/* Sample */}
          <div className="card">
            <p className="section-label mb-2">First {Math.min(preview.rows.length, 15)} rows</p>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-zinc-200 text-zinc-500">
                  <tr><th className="py-2 pr-4 font-medium">#</th><th className="py-2 pr-4 font-medium">Name</th><th className="py-2 pr-4 font-medium">Email</th><th className="py-2 pr-4 font-medium">Phone</th><th className="py-2 font-medium">Status</th></tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 15).map((r) => (
                    <tr key={r.index} className="border-b border-zinc-100 last:border-0">
                      <td className="py-2 pr-4 tabular-nums text-zinc-400">{r.index}</td>
                      <td className="py-2 pr-4 text-zinc-800">{r.name || <span className="text-red-500">—</span>}</td>
                      <td className="py-2 pr-4 text-zinc-600">{r.email || "—"}</td>
                      <td className="py-2 pr-4 text-zinc-600">{r.phone || "—"}</td>
                      <td className="py-2">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[r.status].cls}`}>
                          {STATUS_STYLE[r.status].label}{r.matchedBy ? ` · ${r.matchedBy}` : ""}
                        </span>
                        {r.reason ? <span className="ml-2 text-xs text-zinc-400">{r.reason}</span> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}

      {/* STEP 5 — Done */}
      {step === "done" && result ? (
        <section className="space-y-4">
          <div className="card space-y-4">
            <p className="eyebrow text-brand-700">Import complete</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Created" value={result.created} tone="text-brand-700" />
              <Stat label="Updated" value={result.updated} />
              <Stat label="Skipped" value={result.skipped} tone="text-amber-600" />
              <Stat label="Could not import" value={result.failed} tone={result.failed > 0 ? "text-red-600" : undefined} />
            </div>
            <p className="text-sm text-zinc-600">
              {result.created + result.updated > 0
                ? `${result.created} new and ${result.updated} updated candidate(s) are in your pool${activePlatform ? `, marked “Imported from ${activePlatform.label}”` : ""}. Imported candidates have no skills score yet — send a screen to rank them by demonstrated ability.`
                : "No new candidates were added."}
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href={`/o/${orgSlug}/admin/candidates?view=sourced`} className="btn-primary text-sm">View imported candidates</Link>
              <Link href={`/o/${orgSlug}/admin/candidates?view=sourced`} className="btn-secondary text-sm">Send skills screens</Link>
              {result.errors.length > 0 ? (
                <button
                  type="button"
                  onClick={() => downloadCsv("import-errors.csv", [["row", "name", "reason"], ...result.errors.map((e) => [String(e.row), e.name, e.reason])])}
                  className="btn-secondary text-sm"
                >
                  Download error report ({result.errors.length})
                </button>
              ) : null}
              <button type="button" onClick={reset} className="btn-secondary text-sm">Import another file</button>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`mt-0.5 text-2xl font-bold tabular-nums ${tone ?? "text-zinc-900"}`}>{value}</p>
    </div>
  );
}

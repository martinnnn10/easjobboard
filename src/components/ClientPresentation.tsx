"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PrintButton } from "@/components/PrintButton";
import type { PresentationData } from "@/lib/presentation";

type Redactions = {
  hideContact: boolean;
  hideEmployer: boolean;
  hideLastName: boolean;
  hideResume: boolean;
};

function displayName(d: PresentationData, hideLastName: boolean): string {
  if (!hideLastName || !d.lastName) return d.fullName;
  return `${d.firstName} ${d.lastName.charAt(0)}.`;
}

function buildText(d: PresentationData, r: Redactions): string {
  const lines: string[] = [];
  lines.push(`CANDIDATE SUBMISSION — ${d.orgName}`);
  lines.push("");
  lines.push(displayName(d, r.hideLastName));
  if (d.targetRole) lines.push(`Target role: ${d.targetRole}`);
  const titleLine = [d.title, r.hideEmployer ? "" : d.company].filter(Boolean).join(" · ");
  if (titleLine) lines.push(`Current: ${titleLine}`);
  if (d.location) lines.push(`Location: ${d.location}`);
  if (d.compExpectation) lines.push(`Compensation expectation: ${d.compExpectation}`);
  if (d.skillsScore !== null) lines.push(`Skills screen score: ${d.skillsScore}/100`);
  if (!r.hideContact) {
    const contact = [d.email, d.phone].filter(Boolean).join(" · ");
    if (contact) lines.push(`Contact: ${contact}`);
  }
  const section = (title: string, items: string[]) => {
    if (items.length === 0) return;
    lines.push("", title.toUpperCase());
    for (const it of items) lines.push(`- ${it}`);
  };
  if (d.summary) {
    lines.push("", "SUMMARY", d.summary);
  }
  section("Why they fit", d.whyFit);
  section("Troubleshooting evidence", d.troubleshootingEvidence);
  section("Risks / items to verify", d.risks);
  section("Suggested interview questions", d.interviewQuestions);
  section("Recruiter notes", d.recruiterNotes);
  lines.push("", `Prepared by ${d.orgName} via EAS Recruit.`);
  return lines.join("\n");
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-zinc-300" />
      {label}
    </label>
  );
}

function Block({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section>
      <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-700">{title}</h2>
      <ul className="mt-1.5 space-y-1 text-sm text-zinc-700">
        {items.map((it) => (
          <li key={it} className="flex gap-1.5">
            <span aria-hidden className="mt-1 text-brand-600">•</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ClientPresentation({ orgSlug, data }: { orgSlug: string; data: PresentationData }) {
  const [r, setR] = useState<Redactions>({
    hideContact: false,
    hideEmployer: false,
    hideLastName: false,
    hideResume: false,
  });
  const [copied, setCopied] = useState(false);

  const text = useMemo(() => buildText(data, r), [data, r]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  const name = displayName(data, r.hideLastName);
  const currentLine = [data.title, r.hideEmployer ? "" : data.company].filter(Boolean).join(" · ");

  return (
    <div className="page-shell max-w-3xl space-y-4">
      {/* Controls (never printed) */}
      <div className="print:hidden">
        <Link href={`/o/${orgSlug}/admin/candidates/${data.candidateId}`} className="text-sm text-brand-700 hover:underline">
          ← Back to candidate
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-4 rounded-xl border border-zinc-200 bg-white p-3">
          <span className="text-sm font-medium text-zinc-600">Redact:</span>
          <Toggle label="Contact info" checked={r.hideContact} onChange={(v) => setR((s) => ({ ...s, hideContact: v }))} />
          <Toggle label="Current employer" checked={r.hideEmployer} onChange={(v) => setR((s) => ({ ...s, hideEmployer: v }))} />
          <Toggle label="Last name" checked={r.hideLastName} onChange={(v) => setR((s) => ({ ...s, hideLastName: v }))} />
          <Toggle label="Resume link" checked={r.hideResume} onChange={(v) => setR((s) => ({ ...s, hideResume: v }))} />
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={copy} className="btn-secondary text-sm">
              {copied ? "Copied!" : "Copy write-up"}
            </button>
            <PrintButton label="Print / Save PDF" />
          </div>
        </div>
      </div>

      {/* The branded write-up */}
      <article className="space-y-6 rounded-2xl border border-zinc-200 bg-white p-8 print:border-0 print:p-0 print:shadow-none">
        <header className="border-b border-zinc-200 pb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">
            Candidate submission · {data.orgName}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-zinc-900">{name}</h1>
          <p className="mt-1 text-sm text-zinc-600">
            {data.targetRole ? <>For: {data.targetRole}</> : null}
            {currentLine ? <>{data.targetRole ? " · " : ""}{currentLine}</> : null}
            {data.location ? ` · ${data.location}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            {data.skillsScore !== null ? (
              <span className="rounded-full bg-brand-50 px-2.5 py-0.5 font-semibold text-brand-800">
                Skills screen {data.skillsScore}/100
              </span>
            ) : null}
            {data.compExpectation ? <span className="text-zinc-600">Comp: {data.compExpectation}</span> : null}
            {!r.hideContact ? (
              <span className="text-zinc-500">{[data.email, data.phone].filter(Boolean).join(" · ")}</span>
            ) : null}
          </div>
        </header>

        {data.summary ? (
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-700">Summary</h2>
            <p className="mt-1.5 text-sm text-zinc-800">{data.summary}</p>
          </section>
        ) : null}

        <Block title="Why they fit" items={data.whyFit} />
        <Block title="Troubleshooting evidence" items={data.troubleshootingEvidence} />
        <Block title="Risks / items to verify" items={data.risks} />

        {data.interviewQuestions.length > 0 ? (
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-700">Suggested interview questions</h2>
            <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-sm text-zinc-700">
              {data.interviewQuestions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ol>
          </section>
        ) : null}

        <Block title="Recruiter notes" items={data.recruiterNotes} />

        {!r.hideResume && data.resumePath ? (
          <section className="print:hidden">
            <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-700">Resume</h2>
            <a href={data.resumePath} target="_blank" rel="noreferrer" className="text-sm text-brand-700 hover:underline">
              {data.resumeFilename || "Download resume"} →
            </a>
          </section>
        ) : null}

        <p className="border-t border-zinc-200 pt-3 text-[11px] text-zinc-400">
          Prepared by {data.orgName} via EAS Recruit.
        </p>
      </article>
    </div>
  );
}

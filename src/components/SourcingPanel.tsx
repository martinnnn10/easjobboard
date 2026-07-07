"use client";

import { useState } from "react";

type SourcedCandidate = {
  apolloId: string | null;
  name: string;
  firstName: string | null;
  lastName: string | null;
  title: string;
  company: string;
  location: string;
  linkedinUrl: string | null;
  emailStatus: string | null;
  matchScore: number | null;
  matchedSkills: string[];
};

type SourcingResult =
  | { status: "not_configured" }
  | { status: "error"; message: string }
  | { status: "ok"; candidates: SourcedCandidate[]; jobSkills: string[] };

type EnrichResponse = {
  enrichment:
    | { status: "not_configured" }
    | { status: "error"; message: string }
    | { status: "ok"; email: string | null; phone: string | null };
  outreach: { subject: string; body: string };
};

type EnrichState = {
  loading: boolean;
  email?: string | null;
  phone?: string | null;
  outreach?: { subject: string; body: string };
  message?: string;
};

function scoreClass(score: number): string {
  if (score >= 70) return "bg-green-100 text-green-800";
  if (score >= 40) return "bg-amber-100 text-amber-800";
  return "bg-zinc-100 text-zinc-600";
}

function mailtoHref(email: string | null | undefined, subject: string, body: string): string {
  const target = email ?? "";
  return `mailto:${target}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function SourcingPanel({ orgSlug, jobId }: { orgSlug: string; jobId: string }) {
  const [state, setState] = useState<"idle" | "loading">("idle");
  const [result, setResult] = useState<SourcingResult | null>(null);
  const [enrich, setEnrich] = useState<Record<number, EnrichState>>({});

  async function handleSearch() {
    setState("loading");
    setResult(null);
    setEnrich({});
    try {
      const response = await fetch(`/api/o/${orgSlug}/jobs/${jobId}/source`, { method: "POST" });
      const data = (await response.json()) as SourcingResult;
      setResult(data);
    } catch {
      setResult({ status: "error", message: "Something went wrong. Please try again." });
    } finally {
      setState("idle");
    }
  }

  async function handleEnrich(index: number, candidate: SourcedCandidate) {
    setEnrich((prev) => ({ ...prev, [index]: { loading: true } }));
    try {
      const response = await fetch(`/api/o/${orgSlug}/jobs/${jobId}/enrich`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apolloId: candidate.apolloId,
          firstName: candidate.firstName,
          lastName: candidate.lastName,
          name: candidate.name,
          company: candidate.company,
          linkedinUrl: candidate.linkedinUrl,
          candidateName: candidate.name,
          candidateTitle: candidate.title,
          matchedSkills: candidate.matchedSkills,
        }),
      });
      const data = (await response.json()) as EnrichResponse;
      const e = data.enrichment;
      setEnrich((prev) => ({
        ...prev,
        [index]: {
          loading: false,
          email: e.status === "ok" ? e.email : null,
          phone: e.status === "ok" ? e.phone : null,
          outreach: data.outreach,
          message:
            e.status === "not_configured"
              ? "Set APOLLO_API_KEY to reveal contact details. Draft is ready below."
              : e.status === "error"
                ? e.message
                : e.email
                  ? undefined
                  : "No email found for this person. Draft is ready below.",
        },
      }));
    } catch {
      setEnrich((prev) => ({ ...prev, [index]: { loading: false, message: "Enrichment failed. Please try again." } }));
    }
  }

  return (
    <div className="space-y-4">
      <button onClick={handleSearch} disabled={state === "loading"} className="btn-primary">
        {state === "loading" ? "Searching…" : "Find candidates"}
      </button>

      {result?.status === "not_configured" ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Outbound sourcing isn&apos;t configured yet. Set an <code className="rounded bg-amber-100 px-1">APOLLO_API_KEY</code>{" "}
          environment variable to search the passive candidate market from this job.
        </div>
      ) : null}

      {result?.status === "error" ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{result.message}</div>
      ) : null}

      {result?.status === "ok" ? (
        result.candidates.length === 0 ? (
          <div className="card text-sm text-zinc-600">No candidates found for this search.</div>
        ) : (
          <div className="space-y-3">
            {result.candidates.map((candidate, index) => {
              const e = enrich[index];
              return (
                <div key={`${candidate.name}-${index}`} className="card space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-zinc-900">{candidate.name}</p>
                      <p className="text-sm text-zinc-500">
                        {candidate.title}
                        {candidate.company ? ` · ${candidate.company}` : ""}
                        {candidate.location ? ` · ${candidate.location}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {candidate.matchScore !== null ? (
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${scoreClass(candidate.matchScore)}`}>
                          {candidate.matchScore}%
                        </span>
                      ) : null}
                      {candidate.linkedinUrl ? (
                        <a href={candidate.linkedinUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">
                          LinkedIn
                        </a>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleEnrich(index, candidate)}
                      disabled={e?.loading}
                      className="btn-secondary text-sm"
                    >
                      {e?.loading ? "Enriching…" : "Reveal contact & draft outreach"}
                    </button>
                    {e && !e.loading && e.email ? (
                      <span className="text-sm text-zinc-700">
                        {e.email}
                        {e.phone ? ` · ${e.phone}` : ""}
                      </span>
                    ) : null}
                  </div>

                  {e?.message ? <p className="text-xs text-amber-700">{e.message}</p> : null}

                  {e?.outreach ? (
                    <div className="space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Draft outreach</p>
                      <p className="text-sm font-medium text-zinc-900">{e.outreach.subject}</p>
                      <pre className="whitespace-pre-wrap font-sans text-sm text-zinc-700">{e.outreach.body}</pre>
                      <a
                        href={mailtoHref(e.email, e.outreach.subject, e.outreach.body)}
                        className="inline-block text-sm text-blue-600 hover:underline"
                      >
                        Open in email client →
                      </a>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )
      ) : null}

      {result?.status === "ok" && result.candidates.length > 0 ? (
        <p className="text-xs text-zinc-500">
          Emails are masked until enrichment. &ldquo;Reveal contact&rdquo; uses an Apollo enrichment credit; the outreach
          draft is generated even if no email is found.
        </p>
      ) : null}
    </div>
  );
}

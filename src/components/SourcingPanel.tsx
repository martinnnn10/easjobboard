"use client";

import { useState } from "react";

type SourcedCandidate = {
  name: string;
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

function scoreClass(score: number): string {
  if (score >= 70) return "bg-green-100 text-green-800";
  if (score >= 40) return "bg-amber-100 text-amber-800";
  return "bg-zinc-100 text-zinc-600";
}

export function SourcingPanel({ orgSlug, jobId }: { orgSlug: string; jobId: string }) {
  const [state, setState] = useState<"idle" | "loading">("idle");
  const [result, setResult] = useState<SourcingResult | null>(null);

  async function handleSearch() {
    setState("loading");
    setResult(null);
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
          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Candidate</th>
                  <th className="px-4 py-3 font-medium">Match</th>
                  <th className="px-4 py-3 font-medium">Location</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Profile</th>
                </tr>
              </thead>
              <tbody>
                {result.candidates.map((candidate, index) => (
                  <tr key={`${candidate.name}-${index}`} className="border-b border-zinc-100 last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-900">{candidate.name}</div>
                      <div className="text-zinc-500">
                        {candidate.title}
                        {candidate.company ? ` · ${candidate.company}` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {candidate.matchScore === null ? (
                        <span className="text-zinc-400">—</span>
                      ) : (
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${scoreClass(candidate.matchScore)}`}>
                          {candidate.matchScore}%
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">{candidate.location || "—"}</td>
                    <td className="px-4 py-3 text-zinc-600">{candidate.emailStatus ?? "—"}</td>
                    <td className="px-4 py-3">
                      {candidate.linkedinUrl ? (
                        <a href={candidate.linkedinUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                          LinkedIn
                        </a>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {result?.status === "ok" && result.candidates.length > 0 ? (
        <p className="text-xs text-zinc-500">
          Emails are masked until enrichment. Contact details require an Apollo enrichment step.
        </p>
      ) : null}
    </div>
  );
}

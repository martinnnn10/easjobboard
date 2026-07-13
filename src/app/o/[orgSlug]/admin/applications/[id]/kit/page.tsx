import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";
import { getApplicationDetail } from "@/lib/applications";
import { requireOrgSession } from "@/lib/auth";
import { normalizeRiskLevel } from "@/lib/candidate-intel";
import { getJobAccess } from "@/lib/job-visibility";
import { getOrganizationBySlug } from "@/lib/organizations";
import { evaluateIdealPoints } from "@/lib/screen-scoring";
import { getScreenSubmission } from "@/lib/screen-submissions";
import { DIMENSION_LABELS, type ScreenDimension } from "@/lib/screens";

type PageProps = { params: Promise<{ orgSlug: string; id: string }> };

const WEAK = 45;
const STRONG = 70;

// Reference-check prompts mapped to this candidate's specific risk flags.
const REFERENCE_BY_RISK: Record<string, string> = {
  pay_mismatch:
    "They asked for more than the posting pays. Confirm with references (and the candidate) that the range works long-term — pay gaps are the #1 reason good trades hires walk.",
  commute_risk:
    "They live outside the area. Ask references whether they reliably showed up for shift work and how they handled a long commute or a move.",
  job_hop:
    "Several short stints. Ask each prior supervisor why the person left and whether they would rehire them.",
  overqualified:
    "Supervisor/lead background applying to a hands-on role. Confirm with references they were genuinely hands-on recently and won't leave the bench the first time a lead role opens.",
};

export default async function InterviewKitPage({ params }: PageProps) {
  const { orgSlug, id } = await params;
  const organization = getOrganizationBySlug(orgSlug);
  if (!organization) notFound();

  const { user } = await requireOrgSession(orgSlug);

  const application = getApplicationDetail(id, organization.id, getJobAccess(organization.id, user));
  if (!application) notFound();

  const submission = getScreenSubmission(id, organization.id);
  const summary = application.screen_summary;
  const risk = normalizeRiskLevel(application.risk_level);

  // The answers worth pressure-testing: anything the candidate scored weak on.
  const weakAnswers = (submission?.perAnswer ?? []).filter((a) => a.score < STRONG);

  const dims = submission
    ? (Object.entries(submission.dimensionScores) as [ScreenDimension, number][]).sort(
        (a, b) => a[1] - b[1],
      )
    : [];

  const referenceScript = [
    ...application.risk_flags.map((f) => REFERENCE_BY_RISK[f.key]).filter(Boolean),
    ...(summary?.weakDims ?? []).map(
      (d) => `Probe ${DIMENSION_LABELS[d as ScreenDimension]?.toLowerCase() ?? d}: ask for a concrete example where they had to demonstrate it under pressure.`,
    ),
    "Would you hire this person again for a role that depends on troubleshooting and staying on shift?",
  ];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 print:py-2">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href={`/o/${orgSlug}/admin/applications/${id}`} className="text-sm text-blue-600 hover:underline">
          ← Back to application
        </Link>
        <PrintButton label="Print / Save PDF" />
      </div>

      <article className="space-y-6 rounded-2xl border border-zinc-200 bg-white p-8 print:border-0 print:p-0 print:shadow-none">
        {/* Header */}
        <header className="border-b border-zinc-200 pb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Interview kit · {organization.name}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-zinc-900">{application.applicant_name}</h1>
          <p className="mt-1 text-sm text-zinc-600">
            {application.job_title} · Skills screen {application.screen_score ?? "—"}/100
            {summary?.confidence ? ` · ${summary.confidence} confidence` : ""}
          </p>
          {summary?.recommendedAction ? (
            <p className="mt-2 rounded-md bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-800">
              Recommended: {summary.recommendedAction}
            </p>
          ) : null}
        </header>

        {/* Focus the interview */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-700">Focus the interview here</h2>
          <div className="mt-2 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold text-green-700">Confirm these strengths</p>
              <ul className="mt-1 space-y-0.5 text-sm text-zinc-700">
                {(summary?.strengths ?? []).length > 0 ? (
                  summary!.strengths.map((s) => <li key={s}>✓ {s}</li>)
                ) : (
                  <li className="text-zinc-400">—</li>
                )}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-red-700">Pressure-test these gaps</p>
              <ul className="mt-1 space-y-0.5 text-sm text-zinc-700">
                {(summary?.redFlags ?? []).length > 0 || dims.filter(([, v]) => v < WEAK).length > 0 ? (
                  <>
                    {(summary?.redFlags ?? []).map((f) => (
                      <li key={f}>⚠ {f}</li>
                    ))}
                  </>
                ) : (
                  <li className="text-zinc-400">No major gaps</li>
                )}
              </ul>
            </div>
          </div>
        </section>

        {/* Targeted questions from weak answers */}
        {weakAnswers.length > 0 ? (
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-700">
              Ask about what they got wrong
            </h2>
            <div className="mt-3 space-y-4">
              {weakAnswers.map((answer, i) => {
                const points = evaluateIdealPoints(
                  submission!.screenKey,
                  answer.questionId,
                  answer.answerText,
                );
                const missed = points.filter((p) => !p.hit).map((p) => p.label);
                return (
                  <div key={answer.questionId} className="rounded-lg border border-zinc-200 p-3">
                    <p className="text-sm font-semibold text-zinc-900">
                      {i + 1}. {answer.prompt}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      They answered: “{answer.answerText || "(blank)"}” — scored {answer.score}/100
                    </p>
                    {answer.followUp ? (
                      <p className="mt-2 text-sm text-zinc-800">
                        <span className="font-semibold text-blue-700">Ask:</span> {answer.followUp}
                      </p>
                    ) : null}
                    {missed.length > 0 ? (
                      <p className="mt-1 text-xs text-zinc-600">
                        <span className="font-semibold">A strong answer covers:</span> {missed.join("; ")}.
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* General follow-ups */}
        {submission && submission.followUpQuestions.length > 0 ? (
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-700">More interview questions</h2>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-zinc-700">
              {submission.followUpQuestions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ol>
          </section>
        ) : null}

        {/* Reference-check script */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-700">Reference-check script</h2>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-zinc-700">
            {referenceScript.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        </section>

        {/* Scorecard */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-700">Interview scorecard</h2>
          <p className="text-xs text-zinc-500">Rate 1–5 during the interview; compare against the screen.</p>
          <table className="mt-2 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-300 text-left text-zinc-600">
                <th className="py-1.5 font-medium">Competency</th>
                <th className="py-1.5 font-medium">Screen</th>
                <th className="py-1.5 font-medium">Your rating (1–5)</th>
                <th className="py-1.5 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(DIMENSION_LABELS) as ScreenDimension[]).map((dim) => {
                const s = submission?.dimensionScores?.[dim];
                return (
                  <tr key={dim} className="border-b border-zinc-200">
                    <td className="py-2 text-zinc-800">{DIMENSION_LABELS[dim]}</td>
                    <td className="py-2 text-zinc-600">{s ?? "—"}</td>
                    <td className="py-2 text-zinc-300">◻ ◻ ◻ ◻ ◻</td>
                    <td className="py-2"></td>
                  </tr>
                );
              })}
              <tr>
                <td className="py-2 font-semibold text-zinc-900">Decision</td>
                <td colSpan={3} className="py-2 text-zinc-400">◻ Advance &nbsp; ◻ Hold &nbsp; ◻ Pass</td>
              </tr>
            </tbody>
          </table>
        </section>

        <p className="pt-2 text-[11px] text-zinc-400">
          Generated by {organization.name} on EAS Recruit from this candidate&apos;s skills screen. Risk level: {risk}.
        </p>
      </article>
    </div>
  );
}

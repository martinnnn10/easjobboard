import Link from "next/link";
import { notFound } from "next/navigation";
import { ApplicationStatusSelect } from "@/components/ApplicationStatusSelect";
import { EmailPanel } from "@/components/EmailPanel";
import { NoteForm } from "@/components/NoteForm";
import {
  BadgeRow,
  ClaimVsProof,
  ConfidencePill,
  DimensionBars,
  PercentileChip,
  RiskPill,
  ScreenScoreBadge,
} from "@/components/ScreenSignals";
import { getApplicationDetail } from "@/lib/applications";
import { requireOrgSession } from "@/lib/auth";
import { canViewResumes, canWrite } from "@/lib/roles";
import { benchmarkLabel, getScoreBenchmark } from "@/lib/benchmarks";
import { badgesForApplication, normalizeRiskLevel } from "@/lib/candidate-intel";
import { listCandidateEvents, type CandidateEvent } from "@/lib/candidate-events";
import { candidateGap, GAP_VERDICT_COPY } from "@/lib/gap-analysis";
import { getJobByOrgAndSlug } from "@/lib/jobs";
import { getOrganizationBySlug } from "@/lib/organizations";
import { evaluateIdealPoints } from "@/lib/screen-scoring";
import { getScreenSubmission } from "@/lib/screen-submissions";
import { DIMENSION_LABELS, type ScreenDimension } from "@/lib/screens";

type PageProps = { params: Promise<{ orgSlug: string; id: string }> };

const EVENT_ICONS: Record<CandidateEvent["type"], string> = {
  applied: "📥",
  stage_change: "➡️",
  note: "📝",
  email_sent: "✉️",
};

const ANSWER_BAND: Record<string, string> = {
  good: "border-green-200 bg-green-50",
  mid: "border-amber-200 bg-amber-50",
  bad: "border-red-200 bg-red-50",
};

function answerBand(score: number): string {
  if (score >= 70) return ANSWER_BAND.good;
  if (score >= 45) return ANSWER_BAND.mid;
  return ANSWER_BAND.bad;
}

export default async function ApplicationDetailPage({ params }: PageProps) {
  const { orgSlug, id } = await params;
  const organization = getOrganizationBySlug(orgSlug);
  if (!organization) notFound();

  const sessionContext = await requireOrgSession(orgSlug);
  const writable = canWrite(sessionContext.user.role);
  const resumesOk = canViewResumes(sessionContext.user.role);

  const application = getApplicationDetail(id, organization.id);
  if (!application) notFound();

  const events = listCandidateEvents(id, organization.id);
  const submission = getScreenSubmission(id, organization.id);
  const job = getJobByOrgAndSlug(organization.id, application.job_slug);
  const screenKey = job?.screen_key ?? submission?.screenKey ?? "";
  const badges = badgesForApplication(application);
  const riskLevel = normalizeRiskLevel(application.risk_level);
  const summary = application.screen_summary;
  const recommendedAction = summary?.recommendedAction ?? "";

  const dimensions = submission
    ? (Object.entries(submission.dimensionScores) as [ScreenDimension, number][])
        .map(([dim, score]) => ({ label: DIMENSION_LABELS[dim], score }))
        .sort((a, b) => b.score - a.score)
    : [];
  const strongestDim = dimensions.length ? dimensions[0] : null;
  const weakestDim = dimensions.length ? dimensions[dimensions.length - 1] : null;

  // Trust signals: percentile vs the role's pool, and the resume-vs-reality gap.
  const benchmark =
    application.screen_status === "completed"
      ? getScoreBenchmark(organization.id, screenKey, application.screen_score)
      : null;
  const gap = candidateGap(application, screenKey, submission);
  const confidence = summary?.confidence ?? null;

  const smsHref = application.applicant_phone
    ? `sms:${application.applicant_phone.replace(/[^0-9+]/g, "")}`
    : null;

  return (
    <div className="page-shell space-y-6">
      <div>
        <Link href={`/o/${orgSlug}/admin/pipeline`} className="text-sm text-blue-600 hover:underline">
          ← Back to pipeline
        </Link>

        {/* Verdict banner — the conclusion before any evidence. */}
        {application.screen_status === "completed" && recommendedAction ? (
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-zinc-200 bg-zinc-900 px-5 py-3 text-white">
            <div className="flex items-center gap-3">
              <ScreenScoreBadge score={application.screen_score} status={application.screen_status} size="lg" />
              <span className="text-base font-bold tracking-tight">{recommendedAction}</span>
            </div>
            <span className="hidden text-zinc-600 sm:inline">|</span>
            <span className="text-sm text-zinc-300">
              {strongestDim ? `Strong: ${strongestDim.label.toLowerCase()}` : ""}
              {weakestDim && weakestDim.score < 60 ? ` · Weak: ${weakestDim.label.toLowerCase()}` : ""}
              {application.risk_flags[0] ? ` · ${application.risk_flags[0].label}` : " · No risk flags"}
            </span>
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900">{application.applicant_name}</h1>
            <p className="mt-1 text-sm text-zinc-600">
              {application.applicant_email}
              {application.applicant_phone ? ` · ${application.applicant_phone}` : ""}
              {application.applicant_location ? ` · ${application.applicant_location}` : ""}
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              Applied to <span className="font-medium text-zinc-700">{application.job_title}</span> on{" "}
              {new Date(application.created_at).toLocaleDateString()}
              {application.desired_pay ? ` · wants ${application.desired_pay}` : ""}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {writable ? (
              <ApplicationStatusSelect
                orgSlug={orgSlug}
                applicationId={application.id}
                initialStatus={application.status}
              />
            ) : (
              <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700">
                {application.status}
              </span>
            )}
            {submission ? (
              <Link href={`/o/${orgSlug}/admin/applications/${application.id}/kit`} className="btn-primary text-sm">
                📋 Interview kit
              </Link>
            ) : null}
            {resumesOk ? (
              <a
                href={`/api/o/${orgSlug}/applications/${application.id}/resume`}
                className="text-sm text-blue-600 hover:underline"
              >
                ⬇ {application.resume_filename}
              </a>
            ) : (
              <span className="text-xs text-zinc-400">Resume access restricted</span>
            )}
          </div>
        </div>
      </div>

      {/* Intelligence header — the "should I interview this person?" answer. */}
      <section className="card space-y-4">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
          <div>
            <p className="section-label">Skills screen</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <ScreenScoreBadge score={application.screen_score} status={application.screen_status} size="lg" />
              {application.screen_outcome === "knockout" ? (
                <span className="inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                  Auto-screened out
                </span>
              ) : application.screen_outcome === "qualified" ? (
                <span className="inline-flex rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
                  Qualified
                </span>
              ) : null}
              {benchmark && (benchmark.topPercent !== null || benchmark.pool > 0) ? (
                <PercentileChip label={benchmarkLabel(benchmark)} strong={(benchmark.topPercent ?? 100) <= 25} />
              ) : null}
              {confidence ? <ConfidencePill level={confidence} /> : null}
            </div>
            {application.screen_outcome === "knockout" ? (
              <p className="mt-1.5 max-w-md text-xs text-red-700">
                Did not clear the screen&apos;s passing bar or missed a safety-critical (must-pass) question. Advisory —
                not auto-rejected.
              </p>
            ) : null}
          </div>
          <div>
            <p className="section-label">Resume match</p>
            <p className="mt-1.5 text-sm font-semibold text-zinc-500">
              {application.match_score === null
                ? "Not scored"
                : `${application.match_score}% · ${
                    application.match_method === "llm" ? "AI semantic" : "keyword-only"
                  } — secondary signal`}
            </p>
          </div>
          <div>
            <p className="section-label">Risk</p>
            <div className="mt-1.5">
              <RiskPill level={riskLevel} />
            </div>
          </div>
          {recommendedAction ? (
            <div className="min-w-[12rem] flex-1">
              <p className="section-label">Recommended next step</p>
              <p className="mt-1.5 text-sm font-semibold text-zinc-900">{recommendedAction}</p>
            </div>
          ) : null}
        </div>

        {badges.length > 0 ? <BadgeRow badges={badges} /> : null}

        {/* Resume vs. reality — claim beside proof. */}
        {application.screen_status === "completed" && application.match_score !== null ? (
          <div
            className={`rounded-lg border p-3 ${
              gap.verdict === "trap"
                ? "border-red-200 bg-red-50"
                : gap.verdict === "sleeper"
                  ? "border-green-200 bg-green-50"
                  : "border-zinc-200 bg-zinc-50/60"
            }`}
          >
            <p className="mb-2 text-sm font-semibold text-zinc-900">
              Resume vs. reality — <span className="font-normal">{GAP_VERDICT_COPY[gap.verdict]}</span>
            </p>
            <ClaimVsProof
              resumeMatch={gap.resumeMatch}
              screenScore={gap.backingScore}
              proofLabel={`Demonstrated ${gap.backingLabel.toLowerCase()}`}
            />
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          {summary && summary.strengths.length > 0 ? (
            <div>
              <p className="text-sm font-semibold text-green-800">Top strengths</p>
              <ul className="mt-1 space-y-0.5 text-sm text-zinc-700">
                {summary.strengths.map((s) => (
                  <li key={s}>✓ {s}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {summary && summary.redFlags.length > 0 ? (
            <div>
              <p className="text-sm font-semibold text-red-800">Red flags</p>
              <ul className="mt-1 space-y-0.5 text-sm text-zinc-700">
                {summary.redFlags.map((f) => (
                  <li key={f}>⚠ {f}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        {application.risk_flags.length > 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm font-semibold text-amber-900">Risk detail</p>
            <ul className="mt-1 space-y-1 text-sm text-amber-900">
              {application.risk_flags.map((flag) => (
                <li key={flag.key}>
                  <span className="font-medium">{flag.label}:</span> {flag.detail}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          {/* Screen answers + AI scoring rationale */}
          {submission ? (
            <section className="card space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-zinc-900">Skills screen answers</h2>
                <span className="text-xs text-zinc-500">
                  Graded {submission.method === "llm" ? "by AI rubric" : "offline"} ·{" "}
                  {submission.perAnswer.filter((a) => a.answered).length}/{submission.perAnswer.length} answered
                </span>
              </div>
              <div className="space-y-4">
                {submission.perAnswer.map((answer, i) => (
                  <div key={answer.questionId} className={`rounded-lg border p-3 ${answerBand(answer.score)}`}>
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-zinc-900">
                        <span className="text-zinc-400">{i + 1}.</span> {answer.prompt}
                      </p>
                      <span className="flex-none rounded-full bg-white/70 px-2 py-0.5 text-xs font-bold text-zinc-800">
                        {answer.score}
                      </span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-800">
                      {answer.answerText || <span className="italic text-zinc-400">No answer</span>}
                    </p>
                    {answer.rationale ? (
                      <p className="mt-2 text-xs text-zinc-600">
                        <span className="font-semibold">Why:</span> {answer.rationale}
                      </p>
                    ) : null}
                    {(() => {
                      const points = evaluateIdealPoints(screenKey, answer.questionId, answer.answerText);
                      if (points.length === 0) return null;
                      return (
                        <div className="mt-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                            A strong answer covers
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {points.map((p) => (
                              <span
                                key={p.label}
                                className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] ${
                                  p.hit ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"
                                }`}
                              >
                                {p.hit ? "✓" : "✗"} {p.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                    {answer.followUp ? (
                      <p className="mt-2 text-xs text-blue-700">
                        <span className="font-semibold">Ask in interview:</span> {answer.followUp}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <section className="card text-sm text-zinc-600">
              {application.screen_status === "pending"
                ? "This candidate has not completed the skills screen yet."
                : "No skills screen was attached to this job. Attach one when posting to qualify future applicants."}
            </section>
          )}

          {application.cover_letter ? (
            <section className="card space-y-2">
              <h2 className="text-lg font-semibold text-zinc-900">Cover letter</h2>
              <p className="whitespace-pre-wrap text-sm text-zinc-700">{application.cover_letter}</p>
            </section>
          ) : null}
        </div>

        <div className="space-y-6">
          {dimensions.length > 0 ? (
            <section className="card space-y-3">
              <h2 className="text-lg font-semibold text-zinc-900">Competency breakdown</h2>
              <DimensionBars dimensions={dimensions} />
            </section>
          ) : null}

          {submission && submission.followUpQuestions.length > 0 ? (
            <section className="card space-y-2">
              <h2 className="text-lg font-semibold text-zinc-900">Suggested interview questions</h2>
              <ol className="list-decimal space-y-1.5 pl-5 text-sm text-zinc-700">
                {submission.followUpQuestions.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ol>
            </section>
          ) : null}

          <section className="card space-y-3">
            <h2 className="text-lg font-semibold text-zinc-900">Reach out</h2>
            <div className="flex flex-wrap gap-2">
              <a href={`mailto:${application.applicant_email}`} className="btn-secondary text-sm">
                ✉ Email
              </a>
              {smsHref ? (
                <a href={smsHref} className="btn-secondary text-sm">
                  💬 Text
                </a>
              ) : null}
            </div>
            {writable ? (
              <EmailPanel
                orgSlug={orgSlug}
                applicationId={application.id}
                currentStatus={application.status}
                tokens={{
                  candidateName: application.applicant_name,
                  jobTitle: application.job_title,
                  orgName: organization.name,
                  recruiterName: sessionContext.user.name,
                }}
              />
            ) : null}
          </section>

          <section className="card space-y-3">
            <h2 className="text-lg font-semibold text-zinc-900">Notes</h2>
            {writable ? (
              <NoteForm orgSlug={orgSlug} applicationId={application.id} />
            ) : (
              <p className="text-sm text-zinc-500">Read-only: your role can&apos;t add notes.</p>
            )}
          </section>

          <section className="card space-y-4">
            <h2 className="text-lg font-semibold text-zinc-900">Activity</h2>
            {events.length === 0 ? (
              <p className="text-sm text-zinc-500">No activity yet.</p>
            ) : (
              <ol className="space-y-4">
                {events.map((event) => (
                  <li key={event.id} className="flex gap-3">
                    <span className="text-lg leading-6">{EVENT_ICONS[event.type] ?? "•"}</span>
                    <div className="min-w-0">
                      <p className="whitespace-pre-wrap text-sm text-zinc-800">{event.detail}</p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {new Date(event.created_at).toLocaleString()}
                        {event.actor ? ` · ${event.actor}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

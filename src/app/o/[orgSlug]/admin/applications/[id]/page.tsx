import Link from "next/link";
import { notFound } from "next/navigation";
import { ApplicationStatusSelect } from "@/components/ApplicationStatusSelect";
import { EmailPanel } from "@/components/EmailPanel";
import { NoteForm } from "@/components/NoteForm";
import { BadgeRow, DimensionBars, RiskPill, ScreenScoreBadge } from "@/components/ScreenSignals";
import { getApplicationDetail } from "@/lib/applications";
import { requireOrgSession } from "@/lib/auth";
import { badgesForApplication, normalizeRiskLevel } from "@/lib/candidate-intel";
import { listCandidateEvents, type CandidateEvent } from "@/lib/candidate-events";
import { getOrganizationBySlug } from "@/lib/organizations";
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

  const application = getApplicationDetail(id, organization.id);
  if (!application) notFound();

  const events = listCandidateEvents(id, organization.id);
  const submission = getScreenSubmission(id, organization.id);
  const badges = badgesForApplication(application);
  const riskLevel = normalizeRiskLevel(application.risk_level);
  const summary = application.screen_summary;
  const recommendedAction = summary?.recommendedAction ?? "";

  const dimensions = submission
    ? (Object.entries(submission.dimensionScores) as [ScreenDimension, number][])
        .map(([dim, score]) => ({ label: DIMENSION_LABELS[dim], score }))
        .sort((a, b) => b.score - a.score)
    : [];

  const smsHref = application.applicant_phone
    ? `sms:${application.applicant_phone.replace(/[^0-9+]/g, "")}`
    : null;

  return (
    <div className="page-shell space-y-6">
      <div>
        <Link href={`/o/${orgSlug}/admin/pipeline`} className="text-sm text-blue-600 hover:underline">
          ← Back to pipeline
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
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
            <ApplicationStatusSelect
              orgSlug={orgSlug}
              applicationId={application.id}
              initialStatus={application.status}
            />
            <a
              href={`/api/o/${orgSlug}/applications/${application.id}/resume`}
              className="text-sm text-blue-600 hover:underline"
            >
              ⬇ {application.resume_filename}
            </a>
          </div>
        </div>
      </div>

      {/* Intelligence header — the "should I interview this person?" answer. */}
      <section className="card space-y-4">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
          <div>
            <p className="section-label">Skills screen</p>
            <div className="mt-1.5">
              <ScreenScoreBadge score={application.screen_score} status={application.screen_status} size="lg" />
            </div>
          </div>
          <div>
            <p className="section-label">Resume keyword match</p>
            <p className="mt-1.5 text-sm font-semibold text-zinc-500">
              {application.match_score === null ? "Not scored" : `${application.match_score}% — secondary signal`}
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
                    {answer.followUp ? (
                      <p className="mt-1 text-xs text-blue-700">
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
          </section>

          <section className="card space-y-3">
            <h2 className="text-lg font-semibold text-zinc-900">Notes</h2>
            <NoteForm orgSlug={orgSlug} applicationId={application.id} />
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

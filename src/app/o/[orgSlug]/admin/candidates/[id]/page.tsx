import Link from "next/link";
import { notFound } from "next/navigation";
import { AssignRecruiterSelect } from "@/components/AssignRecruiterSelect";
import { AttachToJobForm } from "@/components/AttachToJobForm";
import { CandidateCrmPanel } from "@/components/CandidateCrmPanel";
import { CandidateNoteForm } from "@/components/CandidateNoteForm";
import { ConfirmCareTaskPanel } from "@/components/ConfirmCareTaskPanel";
import { ScheduleInterviewForm } from "@/components/ScheduleInterviewForm";
import { ConfidencePill, RiskPill, ScreenScoreBadge } from "@/components/ScreenSignals";
import { APPLICATION_STATUS_LABELS } from "@/lib/application-status";
import { getApplicationDetail } from "@/lib/applications";
import { requireOrgSession } from "@/lib/auth";
import { careForCandidate } from "@/lib/candidate-care";
import { CANDIDATE_SOURCE_LABELS, isCandidateSource } from "@/lib/candidate-meta";
import { buildWhyThisCandidate, normalizeRiskLevel } from "@/lib/candidate-intel";
import { CARE_STATUS_LABELS, careTaskTypeLabel, interviewTypeLabel, type CareTaskStatus } from "@/lib/care-meta";
import { getCandidateWithApplications } from "@/lib/candidates";
import { listEventsByCandidate, type CandidateEventType } from "@/lib/candidate-events";
import { listJobsByOrganization } from "@/lib/jobs";
import { getOrganizationBySlug } from "@/lib/organizations";
import { canManageTeam, canWrite } from "@/lib/roles";
import { getScreenSubmission } from "@/lib/screen-submissions";
import { listUsersByOrganization } from "@/lib/users";

type PageProps = { params: Promise<{ orgSlug: string; id: string }> };

const EVENT_ICON: Record<CandidateEventType, string> = {
  applied: "📥",
  stage_change: "↕",
  note: "📝",
  email_sent: "✉",
  sourced: "🔎",
  call: "📞",
  interview: "📅",
  care: "🛎",
};

function careWhen(iso: string): string {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toLocaleString() : iso;
}

const CARE_STATUS_STYLE: Partial<Record<CareTaskStatus, string>> = {
  open: "bg-zinc-100 text-zinc-600",
  snoozed: "bg-zinc-100 text-zinc-600",
  confirmed: "bg-brand-50 text-brand-700",
  escalated: "bg-red-100 text-red-700",
  missed: "bg-red-100 text-red-700",
  cancelled: "bg-zinc-100 text-zinc-400",
};

function WhyColumn({ title, tone, items, empty }: {
  title: string;
  tone: "good" | "bad" | "amber" | "blue";
  items: string[];
  empty: string;
}) {
  const dot = { good: "text-brand-600", bad: "text-red-500", amber: "text-amber-500", blue: "text-blue-600" }[tone];
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</p>
      {items.length === 0 ? (
        <p className="mt-1 text-sm text-zinc-400">{empty}</p>
      ) : (
        <ul className="mt-1 space-y-1 text-sm text-zinc-700">
          {items.map((it) => (
            <li key={it} className="flex gap-1.5">
              <span aria-hidden className={`mt-1 ${dot}`}>•</span>
              <span>{it}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default async function CandidateProfilePage({ params }: PageProps) {
  const { orgSlug, id } = await params;
  const organization = getOrganizationBySlug(orgSlug);
  if (!organization) notFound();

  const { user } = await requireOrgSession(orgSlug);
  const writable = canWrite(user.role);
  const isOwner = canManageTeam(user.role);

  const candidate = getCandidateWithApplications(id, organization.id);
  if (!candidate) notFound();

  const events = listEventsByCandidate(candidate.id, organization.id);
  const orgUsers = listUsersByOrganization(organization.id);
  const members = orgUsers.map((u) => ({ id: u.id, name: u.name }));
  const recruiters = orgUsers.filter((u) => u.role !== "viewer").map((u) => ({ id: u.id, name: u.name }));
  const jobs = writable
    ? listJobsByOrganization(organization.id).map((j) => ({ id: j.id, title: j.title }))
    : [];

  // Candidate Care: assignments, interviews, and the follow-up tasks that keep
  // this candidate warm around each interview.
  const care = careForCandidate(organization.id, candidate.id);
  const nowIso = new Date().toISOString();
  const upcomingInterviews = care.interviews.filter((iv) => iv.interview_datetime >= nowIso);
  const pastInterviews = care.interviews.filter((iv) => iv.interview_datetime < nowIso);
  const outstandingTasks = care.tasks.filter((t) => ["open", "snoozed", "escalated"].includes(t.status));
  const completedTasks = care.tasks.filter((t) => t.status === "confirmed");
  const closedTasks = care.tasks.filter((t) => ["missed", "cancelled"].includes(t.status));
  const hasCare = care.assignments.length > 0 || care.interviews.length > 0 || care.tasks.length > 0;
  const sourceLabel = isCandidateSource(candidate.source) ? CANDIDATE_SOURCE_LABELS[candidate.source] : candidate.source;
  const isSourced = candidate.source !== "applied";

  // Primary application = best-scored (fallback most recent) — the basis for the
  // intelligence layer. Full detail + submission drive "Why this candidate".
  const primary =
    candidate.applications.reduce<(typeof candidate.applications)[number] | null>((best, a) => {
      if (a.screenScore === null) return best;
      if (!best || best.screenScore === null || a.screenScore > best.screenScore) return a;
      return best;
    }, candidate.applications[0] ?? null) ?? candidate.applications[0] ?? null;

  const detail = primary ? getApplicationDetail(primary.applicationId, organization.id) : null;
  const submission = primary ? getScreenSubmission(primary.applicationId, organization.id) : null;
  const why = detail
    ? buildWhyThisCandidate({
        screenScore: detail.screen_score,
        screenStatus: detail.screen_status,
        matchScore: detail.match_score,
        riskLevel: normalizeRiskLevel(detail.risk_level),
        riskFlags: detail.risk_flags,
        summary: detail.screen_summary,
      })
    : null;

  const suggestedQuestions = (() => {
    if (!submission) return [] as string[];
    const out: string[] = [];
    for (const a of submission.perAnswer) if (a.score < 70 && a.followUp) out.push(a.followUp);
    for (const q of submission.followUpQuestions) out.push(q);
    return [...new Set(out)].slice(0, 5);
  })();

  const risk = detail ? normalizeRiskLevel(detail.risk_level) : "low";

  return (
    <div className="page-shell space-y-6">
      <div>
        <Link href={`/o/${orgSlug}/admin/candidates`} className="text-sm text-brand-700 hover:underline">
          ← Back to candidate pool
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900">{candidate.name || candidate.email}</h1>
            <p className="mt-1 text-sm text-zinc-600">
              <a href={`mailto:${candidate.email}`} className="text-brand-700 hover:underline">
                {candidate.email}
              </a>
              {candidate.phone ? (
                <>
                  {" · "}
                  <a href={`tel:${candidate.phone}`} className="text-brand-700 hover:underline">
                    {candidate.phone}
                  </a>
                </>
              ) : null}
              {candidate.location ? ` · ${candidate.location}` : ""}
            </p>
            {candidate.title || candidate.company ? (
              <p className="mt-0.5 text-sm text-zinc-500">
                {[candidate.title, candidate.company].filter(Boolean).join(" · ")}
              </p>
            ) : null}
            <p className="mt-1 text-xs text-zinc-400">
              {candidate.applications.length} application{candidate.applications.length === 1 ? "" : "s"} · in pool since{" "}
              {new Date(candidate.first_applied_at).toLocaleDateString()}
            </p>
            {isSourced ? (
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-700">
                  {sourceLabel}
                  {candidate.source_provider ? ` · ${candidate.source_provider}` : ""}
                </span>
                {candidate.source_url ? (
                  <a
                    href={candidate.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-700 hover:underline"
                  >
                    View source profile ↗
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {candidate.bestScreenScore !== null ? (
              <ScreenScoreBadge score={candidate.bestScreenScore} status="completed" size="lg" />
            ) : null}
            {writable ? (
              <Link href={`/o/${orgSlug}/admin/candidates/${candidate.id}/present`} className="btn-primary text-sm">
                Generate client presentation
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      {/* Intelligence first — the decision, above the resume/applications. */}
      <section className="card space-y-4 border-l-4 border-l-brand-500">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-zinc-900">Why this candidate?</h2>
          <div className="flex flex-wrap items-center gap-2">
            {detail ? <ScreenScoreBadge score={detail.screen_score} status={detail.screen_status} /> : null}
            {risk !== "low" ? <RiskPill level={risk} /> : null}
            {detail?.screen_summary?.confidence ? <ConfidencePill level={detail.screen_summary.confidence} /> : null}
          </div>
        </div>

        {why ? (
          <>
            <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-800">
              Recommended: {why.recommendedAction}
            </p>
            <div className="grid gap-5 sm:grid-cols-2">
              <WhyColumn title="Why they're strong" tone="good" items={why.whyStrong} empty="No screen strengths captured yet." />
              <WhyColumn title="Why they're risky" tone="bad" items={why.whyRisky} empty="No red flags surfaced." />
              <WhyColumn title="Verify on the phone screen" tone="amber" items={why.verifyOnPhone} empty="Nothing specific to verify." />
              <WhyColumn title="Ask the hiring manager" tone="blue" items={why.askHiringManager} empty="—" />
            </div>

            {suggestedQuestions.length > 0 ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Suggested phone-screen questions</p>
                <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-zinc-700">
                  {suggestedQuestions.map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ol>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-4 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
              {detail && detail.match_score !== null ? (
                <span>
                  Resume keyword match: {detail.match_score}%
                  {detail.match_method ? ` (${detail.match_method === "llm" ? "AI" : "keyword"})` : ""} — a secondary
                  signal
                </span>
              ) : null}
              {primary ? (
                <>
                  <Link href={`/o/${orgSlug}/admin/applications/${primary.applicationId}`} className="text-brand-700 hover:underline">
                    Full application →
                  </Link>
                  <Link href={`/o/${orgSlug}/admin/applications/${primary.applicationId}/kit`} className="text-brand-700 hover:underline">
                    Interview kit →
                  </Link>
                </>
              ) : null}
            </div>
          </>
        ) : (
          <p className="text-sm text-zinc-600">
            No completed skills screen yet.{" "}
            {candidate.applications.length === 0
              ? "Attach this candidate to a job below to screen their practical ability."
              : "Once their screen is completed, the intelligence — strengths, risks, and what to verify — appears here."}
          </p>
        )}
      </section>

      {/* Candidate Care — recruiter accountability around interviews. */}
      <section className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Candidate Care</h2>
            <p className="text-xs text-zinc-500">Interviews and the follow-ups that keep this candidate engaged.</p>
          </div>
          {writable ? (
            <ScheduleInterviewForm orgSlug={orgSlug} candidateId={candidate.id} jobs={jobs} compact />
          ) : null}
        </div>

        {!hasCare ? (
          <p className="text-sm text-zinc-500">
            No interviews scheduled yet.{" "}
            {writable ? "Schedule one to auto-create the pre-interview, day-of, and post-interview follow-ups." : ""}
          </p>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Assigned</p>
                {care.assignments.length === 0 ? (
                  <p className="mt-1 text-sm text-zinc-400">No recruiter assigned on a req yet.</p>
                ) : (
                  <ul className="mt-1 space-y-2">
                    {care.assignments.map((a) => (
                      <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="text-zinc-700">
                          {a.jobTitle}
                          {a.status !== "active" ? (
                            <span className="ml-1 text-xs text-zinc-400">({a.status})</span>
                          ) : null}
                        </span>
                        {writable && a.status === "active" ? (
                          <AssignRecruiterSelect
                            orgSlug={orgSlug}
                            jobId={a.job_id}
                            candidateId={candidate.id}
                            recruiters={recruiters}
                            currentRecruiterId={a.assigned_recruiter_id}
                          />
                        ) : (
                          <span className="text-xs font-medium text-zinc-600">{a.recruiterName}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Upcoming interviews</p>
                {upcomingInterviews.length === 0 ? (
                  <p className="mt-1 text-sm text-zinc-400">None scheduled.</p>
                ) : (
                  <ul className="mt-1 space-y-1.5 text-sm text-zinc-700">
                    {upcomingInterviews.map((iv) => (
                      <li key={iv.id}>
                        <span className="font-medium">{careWhen(iv.interview_datetime)}</span>
                        {" · "}
                        {iv.interview_title || interviewTypeLabel(iv.interview_type)}
                        {iv.stage ? ` · ${iv.stage}` : ""}
                        {iv.location ? <span className="block text-xs text-zinc-500">{iv.location}</span> : null}
                      </li>
                    ))}
                  </ul>
                )}
                {pastInterviews.length > 0 ? (
                  <p className="mt-1 text-xs text-zinc-400">
                    {pastInterviews.length} past interview{pastInterviews.length === 1 ? "" : "s"}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Required follow-ups ({outstandingTasks.length})
                </p>
                {outstandingTasks.length === 0 ? (
                  <p className="mt-1 text-sm text-zinc-400">All follow-ups handled.</p>
                ) : (
                  <ul className="mt-1 space-y-2">
                    {outstandingTasks.map((t) => {
                      const overdue = t.due_at <= nowIso;
                      return (
                        <li key={t.id} className="rounded-lg border border-zinc-200 p-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-medium text-zinc-800">{careTaskTypeLabel(t.task_type)}</span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                CARE_STATUS_STYLE[t.status as CareTaskStatus] ?? "bg-zinc-100 text-zinc-600"
                              }`}
                            >
                              {t.status === "escalated"
                                ? "Escalated"
                                : overdue
                                  ? "Overdue"
                                  : CARE_STATUS_LABELS[t.status as CareTaskStatus] ?? t.status}
                            </span>
                          </div>
                          <p className={`text-xs ${overdue ? "font-medium text-red-600" : "text-zinc-500"}`}>
                            Due {careWhen(t.due_at)}
                          </p>
                          <div className="mt-2">
                            <ConfirmCareTaskPanel
                              orgSlug={orgSlug}
                              taskId={t.id}
                              canConfirm={writable && (isOwner || t.assigned_recruiter_id === user.id)}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {completedTasks.length > 0 ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Completed ({completedTasks.length})
                  </p>
                  <ul className="mt-1 space-y-1 text-sm text-zinc-600">
                    {completedTasks.map((t) => (
                      <li key={t.id} className="flex items-center gap-1.5">
                        <span aria-hidden className="text-brand-600">✓</span>
                        {careTaskTypeLabel(t.task_type)}
                        <span className="text-xs text-zinc-400">· {careWhen(t.confirmed_at || t.updated_at)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {closedTasks.length > 0 ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Missed / cancelled</p>
                  <ul className="mt-1 space-y-1 text-sm text-zinc-500">
                    {closedTasks.map((t) => (
                      <li key={t.id}>
                        {careTaskTypeLabel(t.task_type)} —{" "}
                        {CARE_STATUS_LABELS[t.status as CareTaskStatus] ?? t.status}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <section className="card space-y-3">
            <h2 className="text-lg font-semibold text-zinc-900">Applications</h2>
            {candidate.applications.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No applications yet. This candidate is in your pool but hasn&apos;t applied to a job.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-zinc-200 text-zinc-500">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Job</th>
                      <th className="py-2 pr-4 font-medium">Stage</th>
                      <th className="py-2 pr-4 font-medium">Screen</th>
                      <th className="py-2 pr-4 font-medium">Applied</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidate.applications.map((a) => (
                      <tr key={a.applicationId} className="border-b border-zinc-100 last:border-0">
                        <td className="py-2 pr-4">
                          <Link
                            href={`/o/${orgSlug}/admin/applications/${a.applicationId}`}
                            className="font-medium text-zinc-900 hover:text-brand-700"
                          >
                            {a.jobTitle}
                          </Link>
                        </td>
                        <td className="py-2 pr-4 text-zinc-600">
                          {APPLICATION_STATUS_LABELS[a.status] ?? a.status}
                        </td>
                        <td className="py-2 pr-4">
                          <ScreenScoreBadge score={a.screenScore} status={a.screenStatus} />
                        </td>
                        <td className="py-2 pr-4 text-zinc-500">{new Date(a.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {writable ? (
              <div className="border-t border-zinc-100 pt-3">
                <AttachToJobForm orgSlug={orgSlug} candidateId={candidate.id} jobs={jobs} />
              </div>
            ) : null}
          </section>

          <section className="card space-y-3">
            <h2 className="text-lg font-semibold text-zinc-900">Timeline</h2>
            {writable ? <CandidateNoteForm orgSlug={orgSlug} candidateId={candidate.id} /> : null}
            {events.length === 0 ? (
              <p className="text-sm text-zinc-500">No activity yet.</p>
            ) : (
              <ul className="space-y-3">
                {events.map((event) => (
                  <li key={event.id} className="flex gap-3">
                    <span aria-hidden className="mt-0.5 text-base">
                      {EVENT_ICON[event.type] ?? "•"}
                    </span>
                    <div className="min-w-0">
                      <p className="whitespace-pre-wrap text-sm text-zinc-800">{event.detail}</p>
                      <p className="text-xs text-zinc-400">
                        {event.actor ? `${event.actor} · ` : ""}
                        {new Date(event.created_at).toLocaleString()}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card">
            <CandidateCrmPanel
              orgSlug={orgSlug}
              candidateId={candidate.id}
              initialTags={candidate.tags}
              initialOwnerId={candidate.owner_user_id}
              initialCrmStatus={candidate.crm_status}
              members={members}
              canEdit={writable}
            />
          </section>

          {candidate.skills.length > 0 ? (
            <section className="card space-y-2">
              <p className="section-label">Skills seen on resumes</p>
              <div className="flex flex-wrap gap-1.5">
                {candidate.skills.map((skill) => (
                  <span key={skill} className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700">
                    {skill}
                  </span>
                ))}
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

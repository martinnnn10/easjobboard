import Link from "next/link";
import { notFound } from "next/navigation";
import { AssignRecruiterSelect } from "@/components/AssignRecruiterSelect";
import { ConfirmCareTaskPanel } from "@/components/ConfirmCareTaskPanel";
import { DistributionPanel } from "@/components/DistributionPanel";
import { DrilldownCounts, jobApplicantsHref } from "@/components/JobDrilldownCounts";
import { JobScreeningPanel } from "@/components/JobScreeningPanel";
import { ScheduleInterviewForm } from "@/components/ScheduleInterviewForm";
import { StatusBadge } from "@/components/StatusBadge";
import { getJobScreeningSummaries } from "@/lib/applications";
import { APPLICATION_STATUS_LABELS, type ApplicationStatus } from "@/lib/application-status";
import { requireOrgSession } from "@/lib/auth";
import { assignedCandidatesForJob, jobApplicants } from "@/lib/candidate-care";
import { careTaskTypeLabel } from "@/lib/care-meta";
import {
  getJobDistribution,
  getManualStatuses,
  linkedInShareText,
  manualPostingText,
  sourcedJobUrl,
} from "@/lib/distribution";
import { getOrgUrl } from "@/lib/env";
import { canSeeJob, getJobAccess } from "@/lib/job-visibility";
import { getJobById } from "@/lib/jobs";
import { getOrganizationBySlug } from "@/lib/organizations";
import { canManageTeam, canWrite } from "@/lib/roles";
import { getJobScreeningMetrics } from "@/lib/screen-metrics";
import { estimateMinutes, listScreens, resolveScreen, resolveScreenLabel, templateIdForKey } from "@/lib/screen-store";
import { isScreenKey } from "@/lib/screens";
import { listUsersByOrganization } from "@/lib/users";

type PageProps = { params: Promise<{ orgSlug: string; id: string }> };

function whenLabel(iso: string): string {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toLocaleString() : iso;
}

export default async function JobDetailPage({ params }: PageProps) {
  const { orgSlug, id } = await params;
  const organization = getOrganizationBySlug(orgSlug);
  if (!organization) notFound();

  const { user } = await requireOrgSession(orgSlug);
  const writable = canWrite(user.role);
  const isOwner = canManageTeam(user.role);

  const job = getJobById(id);
  if (!job || job.organization_id !== organization.id) notFound();
  // Restricted job: hide from users who aren't on its visibility list.
  const access = getJobAccess(organization.id, user);
  if (!canSeeJob(access, job.id)) notFound();

  // Per-job applicant intelligence — the same counts the Jobs table shows, so
  // the drill-downs here open exactly those candidates.
  const summary = getJobScreeningSummaries(organization.id, access)[id] ?? {
    applicants: 0,
    completed: 0,
    strongFit: 0,
    needsReview: 0,
    highRisk: 0,
    callsDue: 0,
  };

  // Screening: the screen attached to this job, its funnel/outcomes, and the
  // org's published screens available to attach — all managed from here so a
  // recruiter never digs through settings to manage a job's screen.
  const screenKey = job.screen_key;
  const attachedTemplate = screenKey ? resolveScreen(screenKey) : null;
  const attachedScreenId = templateIdForKey(screenKey);
  const attachedRecord = attachedScreenId
    ? listScreens(organization.id).find((s) => s.id === attachedScreenId) ?? null
    : null;
  const attached = attachedTemplate
    ? {
        label: resolveScreenLabel(screenKey) || attachedTemplate.label,
        isBuiltin: isScreenKey(screenKey),
        screenId: attachedScreenId,
        questionCount: attachedTemplate.questions.length,
        minutes: estimateMinutes(attachedTemplate.questions),
        version: attachedRecord ? attachedRecord.publishedVersion : 0,
        newerAvailable: Boolean(
          attachedRecord &&
            attachedRecord.publishedVersionId &&
            attachedRecord.publishedVersionId !== screenKey,
        ),
      }
    : null;
  const screeningMetrics = getJobScreeningMetrics(job.id, organization.id);
  const publishedScreens = listScreens(organization.id)
    .filter((s) => s.status === "published" && s.publishedVersionId)
    .map((s) => ({ id: s.id, title: s.title, version: s.publishedVersion }));

  const assigned = assignedCandidatesForJob(organization.id, id);
  const assignedIds = new Set(assigned.map((a) => a.candidateId));
  const applicants = jobApplicants(organization.id, id);
  const unassigned = applicants.filter((a) => !assignedIds.has(a.candidateId));
  const recruiters = listUsersByOrganization(organization.id)
    .filter((u) => u.role !== "viewer")
    .map((u) => ({ id: u.id, name: u.name }));
  const jobOption = [{ id: job.id, title: job.title }];

  // Distribution status + source-tagged share links.
  const distribution = getJobDistribution(job, getManualStatuses(job.id));
  const distLinks = {
    public: sourcedJobUrl(orgSlug, job.slug, "careers"),
    apply: sourcedJobUrl(orgSlug, job.slug, "careers"),
    flyer: `${getOrgUrl(orgSlug)}/jobs/${job.slug}/flyer`,
  };
  const feedUrl = `${getOrgUrl(orgSlug)}/feed/indeed.xml`;

  return (
    <div className="page-shell space-y-6">
      <div>
        <Link href={`/o/${orgSlug}/admin/jobs`} className="text-sm text-brand-700 hover:underline">
          ← Back to jobs
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{job.title}</h1>
              <StatusBadge status={job.status} />
            </div>
            <p className="mt-1 text-sm text-zinc-600">{job.location}</p>
          </div>
          {writable ? (
            <div className="flex flex-wrap gap-2">
              <Link href={`/o/${orgSlug}/admin/jobs/${job.id}/edit`} className="btn-secondary text-sm">
                Edit
              </Link>
              <Link href={`/o/${orgSlug}/admin/jobs/${job.id}/source`} className="btn-secondary text-sm">
                Source
              </Link>
            </div>
          ) : null}
        </div>
      </div>

      {/* Command-center quick links */}
      <nav className="flex flex-wrap gap-2 text-sm">
        <span className="rounded-full bg-zinc-900 px-3 py-1.5 font-medium text-white">Overview</span>
        <Link
          href={jobApplicantsHref(orgSlug, job.id)}
          className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Applicants
        </Link>
        <Link
          href={jobApplicantsHref(orgSlug, job.id, "screened")}
          className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Screening
        </Link>
        <Link
          href={`/o/${orgSlug}/admin/queue`}
          className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Call Queue
        </Link>
        <a
          href="#distribution"
          className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Distribution
        </a>
      </nav>

      {/* Applicant intelligence — drill straight into this job's candidates */}
      <section className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-zinc-900">Applicant intelligence</h2>
          <Link
            href={jobApplicantsHref(orgSlug, job.id)}
            className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            {summary.applicants > 0
              ? `View ${summary.applicants} applicant${summary.applicants === 1 ? "" : "s"}`
              : "View applicants"}
          </Link>
        </div>
        {summary.applicants > 0 ? (
          <DrilldownCounts orgSlug={orgSlug} jobId={job.id} counts={summary} />
        ) : (
          <p className="text-sm text-zinc-500">
            No applicants yet. Share this job&apos;s apply link or attach candidates from your pool.
          </p>
        )}
      </section>

      <section id="screening" className="scroll-mt-6">
        <JobScreeningPanel
          orgSlug={orgSlug}
          jobId={job.id}
          writable={writable}
          attached={attached}
          metrics={screeningMetrics}
          options={publishedScreens}
        />
      </section>

      <section id="distribution" className="scroll-mt-6">
        <DistributionPanel
          orgSlug={orgSlug}
          jobId={job.id}
          writable={writable}
          published={job.status === "published"}
          channels={distribution}
          links={distLinks}
          feedUrl={feedUrl}
          linkedInText={linkedInShareText(job, organization, orgSlug)}
          manualPostingText={manualPostingText(job, organization, orgSlug)}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-zinc-900">Assigned candidates</h2>

        {assigned.length === 0 ? (
          <div className="card text-sm text-zinc-500">
            No candidates assigned yet. Assign a recruiter to a candidate below to start Candidate Care.
          </div>
        ) : (
          <div className="space-y-3">
            {assigned.map((row) => (
              <div key={row.candidateId} className="card space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/o/${orgSlug}/admin/candidates/${row.candidateId}`}
                      className="font-semibold text-zinc-900 hover:text-brand-700"
                    >
                      {row.name}
                    </Link>
                    <p className="text-xs text-zinc-500">
                      {row.stage ? APPLICATION_STATUS_LABELS[row.stage as ApplicationStatus] ?? row.stage : "—"}
                      {row.lastContactedAt ? ` · last contacted ${new Date(row.lastContactedAt).toLocaleDateString()}` : ""}
                    </p>
                  </div>
                  <div className="text-right text-xs">
                    <p className="text-zinc-500">Recruiter</p>
                    {writable ? (
                      <AssignRecruiterSelect
                        orgSlug={orgSlug}
                        jobId={job.id}
                        candidateId={row.candidateId}
                        recruiters={recruiters}
                        currentRecruiterId={row.recruiterId}
                      />
                    ) : (
                      <p className="font-medium text-zinc-800">{row.recruiterName}</p>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 rounded-lg bg-zinc-50 p-3 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Next interview</p>
                    {row.nextInterview ? (
                      <p className="text-zinc-800">
                        {whenLabel(row.nextInterview.interview_datetime)}
                        {row.nextInterview.interview_title ? ` · ${row.nextInterview.interview_title}` : ""}
                      </p>
                    ) : (
                      <p className="text-zinc-400">None scheduled</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Next care task</p>
                    {row.nextTask ? (
                      <p className={row.overdue ? "font-medium text-red-600" : "text-zinc-800"}>
                        {careTaskTypeLabel(row.nextTask.task_type)} · due {whenLabel(row.nextTask.due_at)}
                        {row.overdue ? " (overdue)" : ""}
                      </p>
                    ) : (
                      <p className="text-zinc-400">No open tasks</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {writable ? (
                    <ScheduleInterviewForm orgSlug={orgSlug} candidateId={row.candidateId} jobs={jobOption} defaultJobId={job.id} compact />
                  ) : null}
                  {row.nextTask && writable ? (
                    <ConfirmCareTaskPanel
                      orgSlug={orgSlug}
                      taskId={row.nextTask.id}
                      canConfirm={isOwner || row.recruiterId === user.id}
                    />
                  ) : null}
                  <Link href={`/o/${orgSlug}/admin/candidates/${row.candidateId}`} className="text-sm text-brand-700 hover:underline">
                    View profile →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {writable && unassigned.length > 0 ? (
          <div className="card space-y-2">
            <p className="text-sm font-semibold text-zinc-800">Assign a candidate</p>
            <p className="text-xs text-zinc-500">Applicants on this req who don&apos;t have a recruiter yet.</p>
            <div className="space-y-2">
              {unassigned.map((c) => (
                <div key={c.candidateId} className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 py-2 last:border-0">
                  <span className="text-sm text-zinc-800">{c.name}</span>
                  <AssignRecruiterSelect
                    orgSlug={orgSlug}
                    jobId={job.id}
                    candidateId={c.candidateId}
                    recruiters={recruiters}
                    currentRecruiterId=""
                  />
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

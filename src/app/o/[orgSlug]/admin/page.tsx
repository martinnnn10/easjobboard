import Link from "next/link";
import { notFound } from "next/navigation";
import { DemoBadge } from "@/components/DemoBadge";
import { ClaimVsProof } from "@/components/ScreenSignals";
import {
  countApplicationsByOrganization,
  getCallQueueCount,
  getJobScreeningSummaries,
  getScreeningStats,
  listApplicationsByOrganization,
} from "@/lib/applications";
import { requireOrgSession } from "@/lib/auth";
import { getBillingState } from "@/lib/billing";
import { careAlertsForOwner, sweepEscalations } from "@/lib/candidate-care";
import { resumeTrapCandidates } from "@/lib/gap-analysis";
import { canSeeJob, getJobAccess } from "@/lib/job-visibility";
import { listJobsByOrganization } from "@/lib/jobs";
import { getOrganizationBySlug } from "@/lib/organizations";
import { getRoiStats } from "@/lib/roi";
import { canManageTeam, canWrite } from "@/lib/roles";

type PageProps = {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ published?: string }>;
};

export default async function OrgAdminPage({ params, searchParams }: PageProps) {
  const { orgSlug } = await params;
  const organization = getOrganizationBySlug(orgSlug);
  if (!organization) notFound();

  const sessionContext = await requireOrgSession(orgSlug);
  const writable = canWrite(sessionContext.user.role);
  const isOwner = canManageTeam(sessionContext.user.role);

  // Owners drive the Candidate Care SLA — sweep lapsed follow-ups on load, then
  // surface what needs attention.
  if (isOwner) await sweepEscalations(organization.id);
  const careAlerts = isOwner ? careAlertsForOwner(organization.id) : null;

  // Scope every rollup to the jobs this user may see (owners → unrestricted).
  const access = getJobAccess(organization.id, sessionContext.user);
  const jobs = listJobsByOrganization(organization.id).filter((job) => canSeeJob(access, job.id));
  const allApplicants = listApplicationsByOrganization(organization.id, { orderBy: "score", access });
  const applicantCount = countApplicationsByOrganization(organization.id, undefined, access);

  const stats = getScreeningStats(organization.id, access);
  const jobSummaries = getJobScreeningSummaries(organization.id, access);
  const publishedJobs = jobs.filter((job) => job.status === "published");
  const openRolesNoStrong = publishedJobs.filter((job) => (jobSummaries[job.id]?.strongFit ?? 0) === 0).length;

  const trapCandidates = resumeTrapCandidates(allApplicants).slice(0, 4);
  const roi = getRoiStats(organization.id, access);
  const callQueueCount = getCallQueueCount(organization.id, access);

  const publishedSlug = (await searchParams).published;
  const publishedJob = publishedSlug ? jobs.find((job) => job.slug === publishedSlug) : undefined;

  const billing = getBillingState(organization);
  const showTrialBanner =
    billing.status === "trialing" && billing.trialDaysLeft !== null && !billing.hasSubscription;
  const setupIncomplete = jobs.length === 0;

  return (
    <div className="page-shell space-y-6">
      {showTrialBanner ? (
        <section
          className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
            billing.trialDaysLeft !== null && billing.trialDaysLeft <= 3
              ? "border-amber-200 bg-amber-50"
              : "border-brand-200 bg-brand-50"
          }`}
        >
          <p className="text-sm text-zinc-700">
            {billing.trialDaysLeft !== null && billing.trialDaysLeft > 0 ? (
              <>
                <span className="font-semibold">Free trial — {billing.trialDaysLeft} day
                  {billing.trialDaysLeft === 1 ? "" : "s"} left.</span> Full access to EAS Recruit.
              </>
            ) : (
              <span className="font-semibold">Your free trial has ended.</span>
            )}
          </p>
          <div className="flex gap-2">
            {setupIncomplete ? (
              <Link href={`/o/${orgSlug}/admin/onboarding`} className="btn-secondary text-sm">
                Finish setup
              </Link>
            ) : null}
            {writable ? (
              <Link href={`/o/${orgSlug}/admin/settings`} className="btn-primary text-sm">
                {billing.trialDaysLeft !== null && billing.trialDaysLeft <= 0 ? "Add payment method" : "View plan"}
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}

      {publishedJob ? (
        <section className="rounded-xl border border-brand-200 bg-brand-50 p-5">
          <h2 className="text-base font-semibold text-brand-800">Your job is live</h2>
          <p className="mt-1 text-sm text-brand-800/80">
            <span className="font-medium">{publishedJob.title}</span> is on your careers page and discoverable via
            Google for Jobs.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <a href={`/o/${orgSlug}/jobs/${publishedJob.slug}`} target="_blank" rel="noreferrer" className="font-medium text-brand-700 underline">
              View posting
            </a>
            <a href={`/o/${orgSlug}/jobs/${publishedJob.slug}/flyer`} target="_blank" rel="noreferrer" className="font-medium text-brand-700 underline">
              Print a flyer
            </a>
          </div>
        </section>
      ) : null}

      {/* Command center header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Who&apos;s worth calling first</h1>
          <p className="mt-1 text-sm text-zinc-600">
            {applicantCount === 0
              ? "Your intelligence layer for maintenance, controls, and skilled-trades hiring."
              : `${applicantCount} applicant${applicantCount === 1 ? "" : "s"} · ranked by demonstrated ability, not resume keywords.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {writable ? (
            <Link href={`/o/${orgSlug}/admin/jobs/new`} className="btn-primary">
              + New job
            </Link>
          ) : null}
          <a href={`/o/${orgSlug}`} target="_blank" rel="noreferrer" className="btn-secondary">
            View careers page
          </a>
        </div>
      </div>

      {/* Priority row: what to work + the ROI proof */}
      <section className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
        <Link
          href={`/o/${orgSlug}/admin/queue`}
          className="card card-hover flex flex-col justify-center border-l-4 border-l-brand-500"
        >
          <p className="section-label">Call queue</p>
          <p className="stat-value mt-2 text-brand-700">
            {callQueueCount}
            <span className="ml-1 text-base font-medium text-zinc-400">to call</span>
          </p>
          <p className="mt-1 text-sm text-zinc-600">Ranked by ability — phone one tap away →</p>
        </Link>
        <div className="flex flex-col justify-center rounded-2xl border border-brand-200 bg-brand-50 px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">Interview-hours saved</p>
          {roi.interviewsAvoided > 0 ? (
            <>
              <p className="mt-2 text-3xl font-bold tracking-tight text-zinc-900">
                ${roi.dollarsSaved.toLocaleString()}
                <span className="ml-2 text-base font-semibold text-zinc-600">· {roi.hoursSaved} hours avoided</span>
              </p>
              <p className="mt-1 text-sm text-zinc-600">
                Screens filtered {roi.interviewsAvoided} weak or high-risk applicants ({roi.filterRatePercent}% of those
                screened) before anyone wasted an interview.
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-zinc-600">
              As applicants complete screens, this shows the interview-hours the screen saved you by filtering weak
              candidates before you meet them.
            </p>
          )}
        </div>
      </section>

      {/* Intelligence stat tiles */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link href={`/o/${orgSlug}/admin/pipeline`} className="card card-hover border-l-4 border-l-brand-500">
          <p className="section-label">Strong-fit candidates</p>
          <p className="stat-value mt-2 text-brand-700">{stats.strongFit}</p>
          <p className="mt-1 text-xs text-zinc-500">Passed the screen · low risk · call first →</p>
        </Link>
        <Link href={`/o/${orgSlug}/admin/pipeline`} className="card card-hover border-l-4 border-l-amber-400">
          <p className="section-label">Needs review</p>
          <p className="stat-value mt-2 text-amber-600">{stats.needsReview}</p>
          <p className="mt-1 text-xs text-zinc-500">Borderline screens — worth a phone screen →</p>
        </Link>
        <Link href={`/o/${orgSlug}/admin/candidates?view=high_risk`} className="card card-hover border-l-4 border-l-red-400">
          <p className="section-label">High-risk applicants</p>
          <p className="stat-value mt-2 text-red-600">{stats.highRisk}</p>
          <p className="mt-1 text-xs text-zinc-500">Pay, commute, or job-hop flags →</p>
        </Link>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <p className="section-label">Skills screens completed</p>
          <p className="stat-value mt-2">
            {stats.screened}
            <span className="ml-1 text-base font-medium text-zinc-400">/ {stats.totalApplicants}</span>
          </p>
          <p className="mt-1 text-xs text-zinc-500">{stats.resumesReceived} resumes received</p>
        </div>
        <Link href={`/o/${orgSlug}/admin/queue`} className="card card-hover">
          <p className="section-label">Resume-only applicants</p>
          <p className="stat-value mt-2 text-zinc-700">{stats.resumeOnly}</p>
          <p className="mt-1 text-xs text-zinc-500">Applied without a skills screen — send one →</p>
        </Link>
        <div className="card">
          <p className="section-label">Average skills score</p>
          <p className="stat-value mt-2">{stats.avgScore === null ? "—" : stats.avgScore}</p>
        </div>
        <Link
          href={`/o/${orgSlug}/admin/jobs`}
          className={`card card-hover ${openRolesNoStrong > 0 ? "border-l-4 border-l-amber-400" : ""}`}
        >
          <p className="section-label">Open roles, no strong candidate</p>
          <p className={`stat-value mt-2 ${openRolesNoStrong > 0 ? "text-amber-600" : "text-zinc-900"}`}>
            {openRolesNoStrong}
          </p>
          <p className="mt-1 text-xs text-zinc-500">Roles that need sourcing attention →</p>
        </Link>
      </section>

      {/* Candidate Care alerts — owner accountability view */}
      {careAlerts && careAlerts.totalOpen > 0 ? (
        <section
          className={`rounded-2xl border p-5 ${
            careAlerts.escalated.length > 0 ? "border-red-200 bg-red-50" : "border-zinc-200 bg-white"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Candidate Care alerts</p>
              <h2 className="mt-1 text-lg font-bold text-zinc-900">
                {careAlerts.escalated.length > 0
                  ? `${careAlerts.escalated.length} follow-up${careAlerts.escalated.length === 1 ? "" : "s"} escalated past SLA`
                  : careAlerts.overdue.length > 0
                    ? `${careAlerts.overdue.length} follow-up${careAlerts.overdue.length === 1 ? "" : "s"} overdue`
                    : "Candidate care on track"}
              </h2>
            </div>
            <Link href={`/o/${orgSlug}/admin/care`} className="btn-secondary text-sm">
              Open Candidate Care →
            </Link>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-200 bg-white p-3">
              <p className="text-2xl font-bold text-red-600">{careAlerts.escalated.length}</p>
              <p className="text-xs text-zinc-500">Escalated to you</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-3">
              <p className="text-2xl font-bold text-amber-600">{careAlerts.overdue.length}</p>
              <p className="text-xs text-zinc-500">Overdue, not yet escalated</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-3">
              <p className="text-2xl font-bold text-amber-600">{careAlerts.interviewsSoonNoCheckin.length}</p>
              <p className="text-xs text-zinc-500">Interviews ≤48h, no check-in</p>
            </div>
          </div>
          {careAlerts.escalated.length > 0 ? (
            <ul className="mt-3 space-y-1.5 text-sm">
              {careAlerts.escalated.slice(0, 4).map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-x-2">
                  <Link
                    href={`/o/${orgSlug}/admin/candidates/${t.candidate_id}`}
                    className="font-medium text-zinc-900 hover:text-brand-700"
                  >
                    {t.candidateName}
                  </Link>
                  <span className="text-xs text-zinc-500">
                    {t.jobTitle && t.jobTitle !== "—" ? `${t.jobTitle} · ` : ""}owner {t.recruiterName}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {/* The resume trap — the differentiated hook */}
      {trapCandidates.length > 0 ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-red-700">The resume trap</p>
          <h2 className="mt-1 text-lg font-bold text-red-900">
            {trapCandidates.length} {trapCandidates.length === 1 ? "applicant looks" : "applicants look"} great on paper
            but can&apos;t do the work
          </h2>
          <p className="mt-1 text-sm text-red-800">Exactly who a keyword job board would have shortlisted first.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {trapCandidates.map((c) => (
              <Link
                key={c.id}
                href={`/o/${orgSlug}/admin/applications/${c.id}`}
                className="block rounded-xl border border-red-200 bg-white p-4 transition hover:border-red-300"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 font-semibold text-zinc-900">
                    {c.applicant_name}
                    {c.is_demo ? <DemoBadge /> : null}
                  </span>
                  <span className="text-xs text-zinc-500">{c.job_title}</span>
                </div>
                <div className="mt-3">
                  <ClaimVsProof resumeMatch={c.match_score} screenScore={c.screen_score} />
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* Quick links */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link href={`/o/${orgSlug}/admin/jobs`} className="card card-hover">
          <p className="font-semibold text-zinc-900">Jobs</p>
          <p className="mt-1 text-xs text-zinc-500">{jobs.length} posted · screening funnel per role</p>
        </Link>
        <Link href={`/o/${orgSlug}/admin/queue`} className="card card-hover">
          <p className="font-semibold text-zinc-900">Call queue</p>
          <p className="mt-1 text-xs text-zinc-500">{callQueueCount} to call, ranked by ability</p>
        </Link>
        <Link href={`/o/${orgSlug}/admin/candidates?view=applicants`} className="card card-hover">
          <p className="font-semibold text-zinc-900">Applicants</p>
          <p className="mt-1 text-xs text-zinc-500">Every applicant with signals & risk</p>
        </Link>
        <Link href={`/o/${orgSlug}/admin/candidates`} className="card card-hover">
          <p className="font-semibold text-zinc-900">Candidates</p>
          <p className="mt-1 text-xs text-zinc-500">Applicants + sourced candidates in one pool</p>
        </Link>
      </section>

      {jobs.length === 0 ? (
        <section className="card space-y-3 py-8 text-center">
          <h3 className="text-lg font-semibold text-zinc-900">Post your first job in under a minute</h3>
          <p className="mx-auto max-w-md text-sm text-zinc-600">
            Pick a role template and a skills screen, publish, and start seeing who can actually do the work. It goes
            live on your careers page and Google for Jobs immediately.
          </p>
          {writable ? (
            <div>
              <Link href={`/o/${orgSlug}/admin/jobs/new`} className="btn-primary inline-block">
                Post your first job →
              </Link>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

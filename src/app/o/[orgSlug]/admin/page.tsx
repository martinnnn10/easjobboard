import Link from "next/link";
import { notFound } from "next/navigation";
import { DemoSeedButton } from "@/components/DemoSeedButton";
import { LogoutButton } from "@/components/LogoutButton";
import { BadgeRow, ScreenScoreBadge } from "@/components/ScreenSignals";
import { StatusBadge } from "@/components/StatusBadge";
import {
  countApplicationsByOrganization,
  getApplicationStatusCounts,
  getJobScreeningSummaries,
  getScreeningStats,
  listApplicationsByOrganization,
} from "@/lib/applications";
import { APPLICATION_STATUSES, APPLICATION_STATUS_LABELS } from "@/lib/application-status";
import { requireOrgSession } from "@/lib/auth";
import { badgesForApplication } from "@/lib/candidate-intel";
import { getOrgUrl } from "@/lib/env";
import { getJobPublicUrl, listJobsByOrganization } from "@/lib/jobs";
import { getOrganizationBySlug } from "@/lib/organizations";
import { getScreenLabel } from "@/lib/screens";

type PageProps = {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ published?: string }>;
};

export default async function OrgAdminPage({ params, searchParams }: PageProps) {
  const { orgSlug } = await params;
  const organization = getOrganizationBySlug(orgSlug);
  if (!organization) notFound();

  const sessionContext = await requireOrgSession(orgSlug);

  const jobs = listJobsByOrganization(organization.id);
  const applicants = listApplicationsByOrganization(organization.id, { orderBy: "score", limit: 5 });
  const applicantCount = countApplicationsByOrganization(organization.id);
  const statusCounts = getApplicationStatusCounts(organization.id);
  const activeInPipeline =
    statusCounts.new + statusCounts.screening + statusCounts.interview + statusCounts.offer;

  // Manufacturing hiring-intelligence rollups.
  const stats = getScreeningStats(organization.id);
  const jobSummaries = getJobScreeningSummaries(organization.id);
  const publishedJobs = jobs.filter((job) => job.status === "published");
  const openRolesNoStrong = publishedJobs.filter(
    (job) => (jobSummaries[job.id]?.strongFit ?? 0) === 0,
  ).length;

  const publishedSlug = (await searchParams).published;
  const publishedJob = publishedSlug ? jobs.find((job) => job.slug === publishedSlug) : undefined;

  return (
    <div className="page-shell space-y-8">
      {publishedJob ? (
        <section className="rounded-xl border border-green-200 bg-green-50 p-6">
          <h2 className="text-lg font-semibold text-green-900">🎉 Your job is live!</h2>
          <p className="mt-1 text-sm text-green-800">
            <span className="font-medium">{publishedJob.title}</span> is now on your careers page and syndicating to
            job boards. Share it:
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <code className="rounded bg-white px-2 py-1 text-green-900">{getJobPublicUrl(orgSlug, publishedJob.slug)}</code>
            <a href={getJobPublicUrl(orgSlug, publishedJob.slug)} target="_blank" rel="noreferrer" className="font-medium text-green-800 underline">
              View posting
            </a>
            <a href={`/o/${orgSlug}/jobs/${publishedJob.slug}/flyer`} target="_blank" rel="noreferrer" className="font-medium text-green-800 underline">
              Print a flyer
            </a>
          </div>
        </section>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="section-label">Signed in as {sessionContext.user.name}</p>
          <h1 className="mt-1 text-3xl font-bold text-zinc-900">{organization.name}</h1>
          <p className="mt-1 text-sm text-zinc-600">Resumes are delivered to {organization.application_email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/o/${orgSlug}/admin/jobs/new`} className="btn-primary">
            + New job
          </Link>
          <a href={getOrgUrl(orgSlug)} target="_blank" rel="noreferrer" className="btn-secondary">
            View careers page
          </a>
          <LogoutButton orgSlug={orgSlug} />
        </div>
      </div>

      {/* Hiring-intelligence stats — who can actually do the job */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href={`/o/${orgSlug}/admin/pipeline`} className="card card-hover block border-l-4 border-l-green-500">
          <p className="section-label">Strong-fit candidates</p>
          <p className="stat-value mt-2 text-green-700">{stats.strongFit}</p>
          <p className="mt-1 text-xs text-zinc-500">Passed the screen · low risk · call these first →</p>
        </Link>
        <Link href={`/o/${orgSlug}/admin/pipeline`} className="card card-hover block border-l-4 border-l-amber-400">
          <p className="section-label">Candidates needing review</p>
          <p className="stat-value mt-2 text-amber-600">{stats.needsReview}</p>
          <p className="mt-1 text-xs text-zinc-500">Borderline screens — worth a phone screen →</p>
        </Link>
        <div className="card border-l-4 border-l-red-400">
          <p className="section-label">High-risk applicants</p>
          <p className="stat-value mt-2 text-red-600">{stats.highRisk}</p>
          <p className="mt-1 text-xs text-zinc-500">Pay, commute, or job-hop flags</p>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <p className="section-label">Applicants screened</p>
          <p className="stat-value mt-2">
            {stats.screened}
            <span className="ml-1 text-base font-medium text-zinc-400">/ {stats.totalApplicants}</span>
          </p>
        </div>
        <div className="card">
          <p className="section-label">Average skills score</p>
          <p className="stat-value mt-2">{stats.avgScore === null ? "—" : `${stats.avgScore}`}</p>
        </div>
        <div className="card">
          <p className="section-label">Open roles, no strong candidate</p>
          <p className={`stat-value mt-2 ${openRolesNoStrong > 0 ? "text-amber-600" : "text-zinc-900"}`}>
            {openRolesNoStrong}
          </p>
        </div>
        <div className="card">
          <p className="section-label">Hired</p>
          <p className="stat-value mt-2 text-green-700">{statusCounts.hired}</p>
        </div>
      </section>

      {/* Quick actions */}
      <section className="grid gap-3 sm:grid-cols-3">
        <Link href={`/o/${orgSlug}/admin/jobs/new`} className="card card-hover flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-lg">📝</span>
          <div>
            <p className="font-semibold text-zinc-900">Post a job</p>
            <p className="text-xs text-zinc-500">Template + AI in under a minute</p>
          </div>
        </Link>
        <Link href={`/o/${orgSlug}/admin/pipeline`} className="card card-hover flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50 text-lg">🗂️</span>
          <div>
            <p className="font-semibold text-zinc-900">Review candidates</p>
            <p className="text-xs text-zinc-500">{activeInPipeline} in your pipeline</p>
          </div>
        </Link>
        <Link href={`/o/${orgSlug}/admin/candidates`} className="card card-hover flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-lg">🔍</span>
          <div>
            <p className="font-semibold text-zinc-900">Search the pool</p>
            <p className="text-xs text-zinc-500">Everyone who ever applied</p>
          </div>
        </Link>
      </section>

      {applicantCount > 0 ? (
        <section className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900">Pipeline</h2>
            <Link href={`/o/${orgSlug}/admin/pipeline`} className="text-sm font-medium text-blue-700 hover:underline">
              Open the board →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
            {APPLICATION_STATUSES.map((stage) => (
              <div key={stage} className="rounded-lg border border-zinc-200 bg-zinc-50/60 px-3 py-2.5">
                <p className="section-label">{APPLICATION_STATUS_LABELS[stage]}</p>
                <p className="mt-1 text-2xl font-bold tracking-tight text-zinc-900">{statusCounts[stage]}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="card flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-lg">📡</span>
          <div>
            <h2 className="font-semibold text-zinc-900">Job distribution</h2>
            <p className="text-sm text-zinc-600">
              Published jobs syndicate to Indeed and Google for Jobs automatically.
            </p>
          </div>
        </div>
        <Link href={`/o/${orgSlug}/admin/syndication`} className="btn-secondary">
          Feeds &amp; board directory →
        </Link>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">Jobs ({jobs.length})</h2>
          <Link href={`/o/${orgSlug}/admin/applicants`} className="text-sm text-blue-600 hover:underline">
            View all applicants →
          </Link>
        </div>

        {jobs.length === 0 ? (
          <div className="card space-y-4 py-10 text-center">
            <p className="text-4xl">🚀</p>
            <div>
              <h3 className="text-lg font-semibold text-zinc-900">Post your first job in under a minute</h3>
              <p className="mx-auto mt-1 max-w-md text-sm text-zinc-600">
                Pick a role template, confirm the location, and publish. Your job goes live on your careers page and
                starts syndicating to job boards immediately.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link href={`/o/${orgSlug}/admin/jobs/new`} className="btn-primary inline-block">
                Post your first job →
              </Link>
              <DemoSeedButton orgSlug={orgSlug} />
            </div>
            <p className="text-xs text-zinc-500">
              1. Pick a role &amp; screen &nbsp;·&nbsp; 2. Publish &nbsp;·&nbsp; 3. Review who can actually do the job — or
              load sample data to see it now.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Screen</th>
                  <th className="px-4 py-3 font-medium">Applicants → strong-fit</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => {
                  const summary = jobSummaries[job.id];
                  const screenLabel = getScreenLabel(job.screen_key);
                  return (
                  <tr key={job.id} className="border-b border-zinc-100 last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-900">{job.title}</div>
                      <div className="text-xs text-zinc-500">{job.location}</div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {screenLabel ? (
                        <span className="inline-flex rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                          {screenLabel}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-400">No screen</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-700">
                      {summary ? (
                        <span className="text-sm">
                          {summary.applicants} applied
                          {summary.completed > 0 ? ` · ${summary.completed} screened` : ""}
                          {" · "}
                          <span className={summary.strongFit > 0 ? "font-semibold text-green-700" : "text-zinc-400"}>
                            {summary.strongFit} strong-fit
                          </span>
                          {summary.needsReview > 0 ? ` · ${summary.needsReview} to review` : ""}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-400">No applicants yet</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/o/${orgSlug}/admin/jobs/${job.id}/edit`} className="text-blue-600 hover:underline">
                          Edit
                        </Link>
                        <Link href={`/o/${orgSlug}/admin/jobs/${job.id}/source`} className="text-blue-600 hover:underline">
                          Source
                        </Link>
                        {job.status === "published" ? (
                          <>
                            <a href={getJobPublicUrl(orgSlug, job.slug)} className="text-blue-600 hover:underline" target="_blank" rel="noreferrer">
                              View
                            </a>
                            <a href={`/o/${orgSlug}/jobs/${job.slug}/flyer`} className="text-blue-600 hover:underline" target="_blank" rel="noreferrer">
                              Flyer
                            </a>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {applicants.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-zinc-900">Top applicants by skills score</h2>
          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Job</th>
                  <th className="px-4 py-3 font-medium">Skills screen</th>
                  <th className="px-4 py-3 font-medium">Signals</th>
                  <th className="px-4 py-3 font-medium">Applied</th>
                </tr>
              </thead>
              <tbody>
                {applicants.map((application) => (
                  <tr key={application.id} className="border-b border-zinc-100 last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        href={`/o/${orgSlug}/admin/applications/${application.id}`}
                        className="font-medium text-zinc-900 hover:text-blue-700"
                      >
                        {application.applicant_name}
                      </Link>
                      <div className="text-zinc-500">{application.applicant_email}</div>
                    </td>
                    <td className="px-4 py-3 text-zinc-600">{application.job_title}</td>
                    <td className="px-4 py-3">
                      <ScreenScoreBadge score={application.screen_score} status={application.screen_status} />
                    </td>
                    <td className="px-4 py-3">
                      <BadgeRow badges={badgesForApplication(application)} max={2} />
                    </td>
                    <td className="px-4 py-3 text-zinc-600">{new Date(application.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}

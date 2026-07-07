import Link from "next/link";
import { notFound } from "next/navigation";
import { DemoSeedButton } from "@/components/DemoSeedButton";
import { DuplicateJobButton } from "@/components/DuplicateJobButton";
import { LogoutButton } from "@/components/LogoutButton";
import { BadgeRow, ClaimVsProof, ScreenScoreBadge } from "@/components/ScreenSignals";
import { StatusBadge } from "@/components/StatusBadge";
import {
  countApplicationsByOrganization,
  getApplicationStatusCounts,
  getCallQueueCount,
  getJobScreeningSummaries,
  getScreeningStats,
  listApplicationsByOrganization,
} from "@/lib/applications";
import { isLlmConfigured } from "@/lib/anthropic";
import { APPLICATION_STATUSES, APPLICATION_STATUS_LABELS } from "@/lib/application-status";
import { requireOrgSession } from "@/lib/auth";
import { badgesForApplication } from "@/lib/candidate-intel";
import { getOrgUrl } from "@/lib/env";
import { resumeTrapCandidates } from "@/lib/gap-analysis";
import { getJobPublicUrl, listJobsByOrganization } from "@/lib/jobs";
import { getOrganizationBySlug } from "@/lib/organizations";
import { getRoiStats } from "@/lib/roi";
import { canManageTeam, canWrite, isRole, ROLE_LABELS } from "@/lib/roles";
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
  const allApplicants = listApplicationsByOrganization(organization.id, { orderBy: "score" });
  const applicants = allApplicants.slice(0, 5);
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

  // The hook + the renewal number.
  const trapCandidates = resumeTrapCandidates(allApplicants).slice(0, 4);
  const roi = getRoiStats(organization.id);
  const callQueueCount = getCallQueueCount(organization.id);

  const publishedSlug = (await searchParams).published;
  const publishedJob = publishedSlug ? jobs.find((job) => job.slug === publishedSlug) : undefined;

  const llmOn = isLlmConfigured();
  const writable = canWrite(sessionContext.user.role);

  return (
    <div className="page-shell space-y-8">
      {!llmOn ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="font-semibold">AI matching is off.</span> Resume match scores are computed with the
          keyword-only fallback (labeled &ldquo;keyword-only&rdquo; on each candidate). Set{" "}
          <code className="rounded bg-white/70 px-1">ANTHROPIC_API_KEY</code> to enable semantic scoring. Skills-screen
          scores are unaffected.
        </section>
      ) : null}
      {publishedJob ? (
        <section className="rounded-xl border border-green-200 bg-green-50 p-6">
          <h2 className="text-lg font-semibold text-green-900">🎉 Your job is live!</h2>
          <p className="mt-1 text-sm text-green-800">
            <span className="font-medium">{publishedJob.title}</span> is now on your careers page and discoverable via
            Google for Jobs. Register your feeds under Distribution to reach more boards. Share it:
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
          <p className="section-label">
            Signed in as {sessionContext.user.name} ·{" "}
            {isRole(sessionContext.user.role) ? ROLE_LABELS[sessionContext.user.role] : sessionContext.user.role}
          </p>
          <h1 className="mt-1 text-3xl font-bold text-zinc-900">{organization.name}</h1>
          <p className="mt-1 text-sm text-zinc-600">Resumes are delivered to {organization.application_email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {writable ? (
            <Link href={`/o/${orgSlug}/admin/jobs/new`} className="btn-primary">
              + New job
            </Link>
          ) : null}
          <a href={getOrgUrl(orgSlug)} target="_blank" rel="noreferrer" className="btn-secondary">
            View careers page
          </a>
          {canManageTeam(sessionContext.user.role) ? (
            <Link href={`/o/${orgSlug}/admin/team`} className="btn-secondary">
              Team
            </Link>
          ) : null}
          <LogoutButton orgSlug={orgSlug} />
        </div>
      </div>

      {/* THE HOOK — the resume trap: people a keyword ATS would have shortlisted. */}
      {trapCandidates.length > 0 ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-red-700">The resume trap</p>
              <h2 className="mt-1 text-xl font-bold text-red-900">
                You were about to interview {trapCandidates.length}{" "}
                {trapCandidates.length === 1 ? "person who can't" : "people who can't"} do the job.
              </h2>
              <p className="mt-1 text-sm text-red-800">
                Strong on paper, weak on the floor — exactly who a keyword job board would have put at the top of your
                list.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {trapCandidates.map((c) => (
              <Link
                key={c.id}
                href={`/o/${orgSlug}/admin/applications/${c.id}`}
                className="block rounded-xl border border-red-200 bg-white p-4 transition hover:border-red-300"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-900">{c.applicant_name}</span>
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

      {/* THE RENEWAL NUMBER + the daily habit. */}
      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="hero-dark flex flex-col justify-center rounded-2xl px-6 py-6 ring-1 ring-white/10">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9FB6D4]">Interview-hours saved</p>
          {roi.interviewsAvoided > 0 ? (
            <>
              <p className="mt-2 text-4xl font-bold tracking-tight text-white">
                ${roi.dollarsSaved.toLocaleString()}
                <span className="ml-2 text-lg font-semibold text-slate-300">
                  · {roi.hoursSaved} interview-hours avoided
                </span>
              </p>
              <p className="mt-2 text-sm text-slate-300">
                Your screens filtered out {roi.interviewsAvoided} weak or high-risk applicants ({roi.filterRatePercent}%
                of everyone screened) before anyone wasted an interview on them.
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-300">
              Once applicants complete screens, this shows the interview-hours and dollars the screen saved you by
              filtering weak candidates before you meet them.
            </p>
          )}
        </div>
        <Link
          href={`/o/${orgSlug}/admin/queue`}
          className="card card-hover flex flex-col justify-center border-l-4 border-l-green-500"
        >
          <p className="section-label">Call queue</p>
          <p className="stat-value mt-2 text-green-700">
            {callQueueCount}
            <span className="ml-1 text-base font-medium text-zinc-400">to work</span>
          </p>
          <p className="mt-1 text-sm text-zinc-600">Who to call first, ranked by ability — phone one tap away →</p>
        </Link>
      </section>

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
        {writable ? (
          <Link href={`/o/${orgSlug}/admin/jobs/new`} className="card card-hover flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-lg">📝</span>
            <div>
              <p className="font-semibold text-zinc-900">Post a job</p>
              <p className="text-xs text-zinc-500">Template + AI in under a minute</p>
            </div>
          </Link>
        ) : null}
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
            <p className="text-xs text-zinc-500">Applicants + sourced candidates</p>
          </div>
        </Link>
        <Link href={`/o/${orgSlug}/admin/outreach`} className="card card-hover flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-lg">📣</span>
          <div>
            <p className="font-semibold text-zinc-900">Outreach</p>
            <p className="text-xs text-zinc-500">Nurture passive candidates</p>
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
              Published jobs appear on Google for Jobs automatically; register your feeds once to reach Indeed and more.
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
                becomes discoverable on Google for Jobs immediately.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {writable ? (
                <>
                  <Link href={`/o/${orgSlug}/admin/jobs/new`} className="btn-primary inline-block">
                    Post your first job →
                  </Link>
                  <DemoSeedButton orgSlug={orgSlug} />
                </>
              ) : (
                <p className="text-sm text-zinc-500">No jobs yet.</p>
              )}
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
                        {writable ? (
                          <>
                            <Link href={`/o/${orgSlug}/admin/jobs/${job.id}/edit`} className="text-blue-600 hover:underline">
                              Edit
                            </Link>
                            <Link href={`/o/${orgSlug}/admin/jobs/${job.id}/source`} className="text-blue-600 hover:underline">
                              Source
                            </Link>
                            <DuplicateJobButton orgSlug={orgSlug} jobId={job.id} />
                          </>
                        ) : null}
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

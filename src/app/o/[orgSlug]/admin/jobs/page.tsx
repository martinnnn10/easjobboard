import Link from "next/link";
import { notFound } from "next/navigation";
import { DemoSeedButton } from "@/components/DemoSeedButton";
import { DuplicateJobButton } from "@/components/DuplicateJobButton";
import { StatusBadge } from "@/components/StatusBadge";
import { getJobScreeningSummaries } from "@/lib/applications";
import { requireOrgSession } from "@/lib/auth";
import { listJobsByOrganization } from "@/lib/jobs";
import { getOrganizationBySlug } from "@/lib/organizations";
import { canWrite } from "@/lib/roles";
import { getScreenLabel } from "@/lib/screens";

type PageProps = { params: Promise<{ orgSlug: string }> };

export default async function JobsPage({ params }: PageProps) {
  const { orgSlug } = await params;
  const organization = getOrganizationBySlug(orgSlug);
  if (!organization) notFound();

  const { user } = await requireOrgSession(orgSlug);
  const writable = canWrite(user.role);

  const jobs = listJobsByOrganization(organization.id);
  const jobSummaries = getJobScreeningSummaries(organization.id);

  return (
    <div className="page-shell space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Jobs</h1>
          <p className="mt-1 text-sm text-zinc-600">
            {jobs.length} role{jobs.length === 1 ? "" : "s"} · applicants, screened, and strong-fit per posting.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/o/${orgSlug}/admin/syndication`} className="btn-secondary">
            Job distribution
          </Link>
          {writable ? (
            <Link href={`/o/${orgSlug}/admin/jobs/new`} className="btn-primary">
              + New job
            </Link>
          ) : null}
        </div>
      </div>

      {jobs.length === 0 ? (
        <div className="card space-y-3 py-10 text-center">
          <h3 className="text-lg font-semibold text-zinc-900">No jobs yet</h3>
          <p className="mx-auto max-w-md text-sm text-zinc-600">
            Post a role with a skills screen and start seeing who can actually do the work — live on your careers page
            and Google for Jobs in minutes.
          </p>
          {writable ? (
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link href={`/o/${orgSlug}/admin/jobs/new`} className="btn-primary inline-block">
                Post your first job →
              </Link>
              <DemoSeedButton orgSlug={orgSlug} />
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Ask an owner or recruiter to post the first job.</p>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Screen</th>
                <th className="px-4 py-3 text-right font-medium">Applicants</th>
                <th className="px-4 py-3 text-right font-medium">Screened</th>
                <th className="px-4 py-3 text-right font-medium">Strong-fit</th>
                <th className="px-4 py-3 text-right font-medium">Review</th>
                <th className="px-4 py-3 text-right font-medium">High-risk</th>
                <th className="px-4 py-3 text-right font-medium">Calls due</th>
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
                      <Link
                        href={`/o/${orgSlug}/admin/jobs/${job.id}`}
                        className="font-medium text-zinc-900 hover:text-brand-700"
                      >
                        {job.title}
                      </Link>
                      <div className="text-xs text-zinc-500">{job.location}</div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="px-4 py-3">
                      {screenLabel ? (
                        <span className="inline-flex rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                          {screenLabel}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-400">No screen</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-700">{summary?.applicants ?? 0}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-700">{summary?.completed ?? 0}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className={summary?.strongFit ? "font-semibold text-brand-700" : "text-zinc-400"}>
                        {summary?.strongFit ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className={summary?.needsReview ? "font-semibold text-amber-600" : "text-zinc-400"}>
                        {summary?.needsReview ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className={summary?.highRisk ? "font-semibold text-red-600" : "text-zinc-400"}>
                        {summary?.highRisk ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {summary?.callsDue ? (
                        <Link href={`/o/${orgSlug}/admin/queue`} className="font-semibold text-brand-700 hover:underline">
                          {summary.callsDue}
                        </Link>
                      ) : (
                        <span className="text-zinc-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2 text-sm">
                        {writable ? (
                          <>
                            <Link href={`/o/${orgSlug}/admin/jobs/${job.id}/edit`} className="text-brand-700 hover:underline">
                              Edit
                            </Link>
                            <Link href={`/o/${orgSlug}/admin/jobs/${job.id}/source`} className="text-brand-700 hover:underline">
                              Source
                            </Link>
                            <DuplicateJobButton orgSlug={orgSlug} jobId={job.id} />
                          </>
                        ) : null}
                        {job.status === "published" ? (
                          <>
                            <a href={`/o/${orgSlug}/jobs/${job.slug}`} className="text-brand-700 hover:underline" target="_blank" rel="noreferrer">
                              View
                            </a>
                            <a href={`/o/${orgSlug}/jobs/${job.slug}/flyer`} className="text-brand-700 hover:underline" target="_blank" rel="noreferrer">
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
    </div>
  );
}

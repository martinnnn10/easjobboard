import Link from "next/link";
import { notFound } from "next/navigation";
import { LogoutButton } from "@/components/LogoutButton";
import { StatusBadge } from "@/components/StatusBadge";
import {
  countApplicationsByOrganization,
  getApplicationStatusCounts,
  listApplicationsByOrganization,
} from "@/lib/applications";
import { APPLICATION_STATUSES, APPLICATION_STATUS_LABELS } from "@/lib/application-status";
import { requireOrgSession } from "@/lib/auth";
import { getOrgIndeedFeedUrl, getOrgJobUrl, getOrgUrl } from "@/lib/env";
import { getJobPublicUrl, listJobsByOrganization } from "@/lib/jobs";
import { getOrganizationBySlug } from "@/lib/organizations";

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
  const applicants = listApplicationsByOrganization(organization.id, { limit: 5 });
  const applicantCount = countApplicationsByOrganization(organization.id);
  const statusCounts = getApplicationStatusCounts(organization.id);

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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500">Signed in as {sessionContext.user.name}</p>
          <h1 className="text-3xl font-bold text-zinc-900">{organization.name}</h1>
          <p className="mt-1 text-sm text-zinc-600">Admin portal · resumes go to {organization.application_email}</p>
        </div>
        <div className="flex gap-3">
          <Link href={`/o/${orgSlug}/admin/jobs/new`} className="btn-primary">
            New job
          </Link>
          <Link href={`/o/${orgSlug}/admin/pipeline`} className="btn-secondary">
            Pipeline
          </Link>
          <Link href={`/o/${orgSlug}/admin/candidates`} className="btn-secondary">
            Candidate pool
          </Link>
          <LogoutButton orgSlug={orgSlug} />
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="card">
          <p className="text-sm text-zinc-500">Published jobs</p>
          <p className="mt-1 text-2xl font-semibold">{jobs.filter((job) => job.status === "published").length}</p>
        </div>
        <div className="card">
          <p className="text-sm text-zinc-500">Total applicants</p>
          <p className="mt-1 text-2xl font-semibold">{applicantCount}</p>
        </div>
        <div className="card">
          <p className="text-sm text-zinc-500">Public portal</p>
          <a href={getOrgUrl(orgSlug)} className="mt-1 block text-sm text-blue-600 hover:underline" target="_blank" rel="noreferrer">
            View careers page
          </a>
        </div>
      </section>

      {applicantCount > 0 ? (
        <section className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900">Pipeline</h2>
            <Link href={`/o/${orgSlug}/admin/pipeline`} className="text-sm text-blue-600 hover:underline">
              Open the board →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
            {APPLICATION_STATUSES.map((stage) => (
              <div key={stage} className="rounded-lg border border-zinc-200 px-3 py-2">
                <p className="text-xs uppercase tracking-wide text-zinc-500">{APPLICATION_STATUS_LABELS[stage]}</p>
                <p className="mt-1 text-xl font-semibold text-zinc-900">{statusCounts[stage]}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">Job distribution</h2>
          <Link href={`/o/${orgSlug}/admin/syndication`} className="text-sm text-blue-600 hover:underline">
            Feeds &amp; board directory →
          </Link>
        </div>
        <p className="text-sm text-zinc-600">
          Published jobs syndicate to Indeed and Google for Jobs automatically. The distribution page lists every feed
          URL and which additional boards accept them.
        </p>
        <ul className="space-y-2 text-sm">
          <li>
            <span className="font-medium">Indeed XML:</span>{" "}
            <code className="rounded bg-zinc-100 px-2 py-1">{getOrgIndeedFeedUrl(orgSlug)}</code>
          </li>
          <li>
            <span className="font-medium">Job pages:</span>{" "}
            <code className="rounded bg-zinc-100 px-2 py-1">{getOrgJobUrl(orgSlug, "[job-slug]")}</code>
          </li>
        </ul>
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
            <div>
              <Link href={`/o/${orgSlug}/admin/jobs/new`} className="btn-primary inline-block">
                Post your first job →
              </Link>
            </div>
            <p className="text-xs text-zinc-500">1. Pick a template &nbsp;·&nbsp; 2. Set the location &nbsp;·&nbsp; 3. Publish</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Location</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id} className="border-b border-zinc-100 last:border-0">
                    <td className="px-4 py-3 font-medium text-zinc-900">{job.title}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="px-4 py-3 text-zinc-600">{job.location}</td>
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {applicants.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-zinc-900">Recent applicants</h2>
          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Job</th>
                  <th className="px-4 py-3 font-medium">Applied</th>
                  <th className="px-4 py-3 font-medium">Resume</th>
                </tr>
              </thead>
              <tbody>
                {applicants.map((application) => (
                  <tr key={application.id} className="border-b border-zinc-100 last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-900">{application.applicant_name}</div>
                      <div className="text-zinc-500">{application.applicant_email}</div>
                    </td>
                    <td className="px-4 py-3 text-zinc-600">{application.job_title}</td>
                    <td className="px-4 py-3 text-zinc-600">{new Date(application.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <a href={`/api/o/${orgSlug}/applications/${application.id}/resume`} className="text-blue-600 hover:underline">
                        Download
                      </a>
                    </td>
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

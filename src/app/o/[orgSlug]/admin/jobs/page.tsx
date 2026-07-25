import Link from "next/link";
import { notFound } from "next/navigation";
import { DemoSeedButton } from "@/components/DemoSeedButton";
import { JobsTable, type JobRow } from "@/components/JobsTable";
import { getJobScreeningSummaries } from "@/lib/applications";
import { requireOrgSession } from "@/lib/auth";
import type { JobStatus } from "@/lib/db";
import { canSeeJob, getJobAccess } from "@/lib/job-visibility";
import { listJobsByOrganization } from "@/lib/jobs";
import { getOrganizationBySlug, getOrgLabels } from "@/lib/organizations";
import { canWrite } from "@/lib/roles";
import { getScreenLabel } from "@/lib/screens";
import { isSourcingConfigured } from "@/lib/sourcing";

type PageProps = {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ status?: string }>;
};

const FILTERS: { key: "all" | JobStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "published", label: "Published" },
  { key: "draft", label: "Draft" },
  { key: "closed", label: "Closed" },
];

export default async function JobsPage({ params, searchParams }: PageProps) {
  const { orgSlug } = await params;
  const organization = getOrganizationBySlug(orgSlug);
  if (!organization) notFound();

  const { user } = await requireOrgSession(orgSlug);
  const writable = canWrite(user.role);
  const sourcingOn = isSourcingConfigured();
  const labels = getOrgLabels(organization);

  const sp = await searchParams;
  const activeFilter: "all" | JobStatus =
    sp.status === "published" || sp.status === "draft" || sp.status === "closed" ? sp.status : "all";

  // Hide restricted jobs (and their applicant counts) from users not on the list.
  const access = getJobAccess(organization.id, user);
  const allJobs = listJobsByOrganization(organization.id).filter((j) => canSeeJob(access, j.id));
  const jobSummaries = getJobScreeningSummaries(organization.id, access);

  const counts = {
    all: allJobs.length,
    published: allJobs.filter((j) => j.status === "published").length,
    draft: allJobs.filter((j) => j.status === "draft").length,
    closed: allJobs.filter((j) => j.status === "closed").length,
  };

  const visibleJobs = activeFilter === "all" ? allJobs : allJobs.filter((j) => j.status === activeFilter);
  const rows: JobRow[] = visibleJobs.map((job) => {
    const s = jobSummaries[job.id];
    return {
      id: job.id,
      title: job.title,
      slug: job.slug,
      location: job.location,
      status: job.status,
      screenLabel: getScreenLabel(job.screen_key),
      applicants: s?.applicants ?? 0,
      completed: s?.completed ?? 0,
      strongFit: s?.strongFit ?? 0,
      needsReview: s?.needsReview ?? 0,
      highRisk: s?.highRisk ?? 0,
      callsDue: s?.callsDue ?? 0,
      hasApplications: (s?.applicants ?? 0) > 0,
    };
  });

  const filterHref = (key: "all" | JobStatus) =>
    key === "all" ? `/o/${orgSlug}/admin/jobs` : `/o/${orgSlug}/admin/jobs?status=${key}`;

  return (
    <div className="page-shell space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{labels.jobs}</h1>
          <p className="mt-1 text-sm text-zinc-600">
            {counts.published} published · {counts.draft} draft · {counts.closed} closed. Published{" "}
            {labels.jobsLower} appear on your careers page, sitemap, and job feeds. Draft and closed {labels.jobsLower}{" "}
            stay private.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/o/${orgSlug}/admin/syndication`} className="btn-secondary">
            Job distribution
          </Link>
          {writable ? (
            <Link href={`/o/${orgSlug}/admin/jobs/new`} className="btn-primary">
              + New {labels.jobSingular}
            </Link>
          ) : null}
        </div>
      </div>

      {organization.is_demo && writable ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-900">
            <span className="font-semibold">Demo data.</span> These jobs and candidates are samples to show how EAS
            Recruit works. Clear them when you&apos;re ready to post real roles.
          </p>
          <DemoSeedButton orgSlug={orgSlug} isDemo className="btn-secondary text-sm" />
        </div>
      ) : null}

      {counts.all === 0 ? (
        <div className="card space-y-3 py-10 text-center">
          <h3 className="text-lg font-semibold text-zinc-900">No {labels.jobsLower} yet</h3>
          <p className="mx-auto max-w-md text-sm text-zinc-600">
            Post a {labels.jobSingular} with a skills screen and start seeing who can actually do the work — live on your
            careers page in minutes, and eligible for Google for Jobs as soon as Google crawls it.
          </p>
          {writable ? (
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link href={`/o/${orgSlug}/admin/jobs/new`} className="btn-primary inline-block">
                Post your first {labels.jobSingular} →
              </Link>
              <DemoSeedButton orgSlug={orgSlug} />
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Ask an owner or recruiter to post the first {labels.jobSingular}.</p>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => {
              const active = activeFilter === f.key;
              return (
                <Link
                  key={f.key}
                  href={filterHref(f.key)}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "border-brand-600 bg-brand-600 text-white"
                      : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400"
                  }`}
                >
                  {f.label} <span className={active ? "text-white/80" : "text-zinc-400"}>{counts[f.key]}</span>
                </Link>
              );
            })}
          </div>

          {rows.length === 0 ? (
            <div className="card py-8 text-center text-sm text-zinc-500">
              No {activeFilter} {labels.jobsLower}.
            </div>
          ) : (
            <JobsTable orgSlug={orgSlug} writable={writable} sourcingOn={sourcingOn} rows={rows} />
          )}
        </>
      )}
    </div>
  );
}

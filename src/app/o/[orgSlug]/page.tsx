import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedJobsByOrganization } from "@/lib/jobs";
import { getBrandColor, getOrganizationBySlug } from "@/lib/organizations";
import { getOrgUrl, getPlatformName } from "@/lib/env";
import type { Job } from "@/lib/db";

type PageProps = { params: Promise<{ orgSlug: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { orgSlug } = await params;
  const organization = getOrganizationBySlug(orgSlug);
  if (!organization) return { title: "Not found" };

  const title = `${organization.name} Careers`;
  const description = `Open positions at ${organization.name} on ${getPlatformName()}.`;
  const url = getOrgUrl(orgSlug);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: organization.name, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

function formatSalary(job: Job): string | null {
  if (!job.salary_min && !job.salary_max) return null;
  const fmt = (n: number) => `$${n.toLocaleString()}`;
  const range =
    job.salary_min && job.salary_max
      ? `${fmt(job.salary_min)}–${fmt(job.salary_max)}`
      : fmt(job.salary_min ?? job.salary_max ?? 0);
  return `${range}/${job.salary_period.toLowerCase()}`;
}

function postedAgo(job: Job): string {
  const posted = new Date(job.published_at ?? job.created_at).getTime();
  const days = Math.max(0, Math.floor((Date.now() - posted) / 86_400_000));
  if (days === 0) return "Posted today";
  if (days === 1) return "Posted yesterday";
  return `Posted ${days} days ago`;
}

export default async function OrgCareersPage({ params }: PageProps) {
  const { orgSlug } = await params;
  const organization = getOrganizationBySlug(orgSlug);
  if (!organization) notFound();

  const jobs = getPublishedJobsByOrganization(organization.id);
  const brandColor = getBrandColor(organization);
  const initials = organization.name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div>
      {/* Branded hero */}
      <section className="border-b border-zinc-200" style={{ backgroundColor: `${brandColor}14` }}>
        <div className="mx-auto w-full max-w-5xl px-4 py-12">
          <div className="flex items-center gap-4">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-xl text-xl font-bold text-white"
              style={{ backgroundColor: brandColor }}
            >
              {initials || "•"}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-zinc-900">{organization.name}</h1>
              <p className="mt-1 text-zinc-600">
                {jobs.length > 0
                  ? `${jobs.length} open position${jobs.length === 1 ? "" : "s"} — apply in under a minute.`
                  : "Careers"}
              </p>
            </div>
          </div>
          {organization.website ? (
            <a
              href={organization.website}
              className="mt-3 inline-block text-sm font-medium hover:underline"
              style={{ color: brandColor }}
              target="_blank"
              rel="noreferrer"
            >
              Visit company website →
            </a>
          ) : null}
        </div>
      </section>

      <div className="page-shell space-y-4">
        {jobs.length === 0 ? (
          <div className="card text-zinc-600">
            No open positions right now — check back soon.
          </div>
        ) : (
          <ul className="space-y-4">
            {jobs.map((job) => {
              const salary = formatSalary(job);
              return (
                <li key={job.id}>
                  <Link
                    href={`/o/${orgSlug}/jobs/${job.slug}`}
                    className="card block transition hover:shadow-md"
                    style={{ borderColor: undefined }}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="text-xl font-semibold text-zinc-900">{job.title}</h2>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
                            📍 {job.location}
                          </span>
                          <span
                            className="rounded-full px-3 py-1 text-xs font-medium text-white"
                            style={{ backgroundColor: brandColor }}
                          >
                            {job.employment_type.replace(/_/g, " ")}
                          </span>
                          {salary ? (
                            <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-800">
                              {salary}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <span className="text-xs text-zinc-500">{postedAgo(job)}</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

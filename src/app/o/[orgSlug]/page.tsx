import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedJobsByOrganization } from "@/lib/jobs";
import { getBrandColor, getOrganizationBySlug, organizationHasLogo } from "@/lib/organizations";
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
  const hasLogo = organizationHasLogo(organization.id);
  const initials = organization.name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div>
      {/* Branded hero — a soft glow of the ORG's own brand colour (white-label),
          elevated with premium type + spacing. */}
      <section
        className="border-b border-zinc-200 bg-white"
        style={{ backgroundImage: `radial-gradient(70% 120% at 0% 0%, ${brandColor}1f, transparent 62%)` }}
      >
        <div className="mx-auto w-full max-w-6xl px-4 py-16 md:py-20">
          <div className="flex items-center gap-5">
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-2xl font-bold text-white shadow-sm ring-1 ring-black/5"
              style={hasLogo ? { backgroundColor: "#fff" } : { backgroundColor: brandColor }}
            >
              {hasLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/o/${orgSlug}/logo`}
                  alt={organization.name}
                  className="h-full w-full object-contain p-1"
                />
              ) : (
                initials || "•"
              )}
            </div>
            <div className="min-w-0">
              <p className="eyebrow" style={{ color: brandColor }}>
                Careers
              </p>
              <h1 className="mt-1.5 text-4xl font-bold tracking-tight text-zinc-900 md:text-5xl">
                {organization.name}
              </h1>
            </div>
          </div>
          <p className="mt-5 max-w-2xl text-lg text-zinc-600">
            {jobs.length > 0
              ? `${jobs.length} open position${jobs.length === 1 ? "" : "s"} — apply in under a minute, no account needed.`
              : "Careers"}
          </p>
          {organization.website ? (
            <a
              href={organization.website}
              className="btn-secondary mt-6 text-sm"
              target="_blank"
              rel="noreferrer"
            >
              Visit company website
              <span aria-hidden>→</span>
            </a>
          ) : null}
        </div>
      </section>

      <div className="mx-auto w-full max-w-6xl px-4 py-14">
        {jobs.length === 0 ? (
          <div className="card mx-auto max-w-lg space-y-2 py-12 text-center">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-100 text-zinc-400">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
                <rect x="3" y="7" width="18" height="13" rx="2" />
                <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </span>
            <h2 className="text-lg font-semibold text-zinc-900">No open positions right now</h2>
            <p className="text-sm text-zinc-600">Check back soon — new roles are posted here as they open.</p>
          </div>
        ) : (
          <>
            <p className="eyebrow mb-4" style={{ color: brandColor }}>Open roles</p>
            <ul className="space-y-4">
              {jobs.map((job) => {
                const salary = formatSalary(job);
                return (
                  <li key={job.id}>
                    <Link href={`/o/${orgSlug}/jobs/${job.slug}`} className="card card-hover block">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="text-xl font-semibold tracking-tight text-zinc-900">{job.title}</h2>
                          <div className="mt-2.5 flex flex-wrap items-center gap-2">
                            <span className="pill">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden>
                                <path d="M12 21s-6-5.686-6-10a6 6 0 1 1 12 0c0 4.314-6 10-6 10z" />
                                <circle cx="12" cy="11" r="2" />
                              </svg>
                              {job.location}
                            </span>
                            <span
                              className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-white"
                              style={{ backgroundColor: brandColor }}
                            >
                              {job.employment_type.replace(/_/g, " ")}
                            </span>
                            {salary ? <span className="pill">{salary}</span> : null}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 text-right">
                          <span className="text-xs text-zinc-500">{postedAgo(job)}</span>
                          <span className="inline-flex items-center gap-1 text-sm font-medium text-zinc-800">
                            Apply <span aria-hidden>→</span>
                          </span>
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

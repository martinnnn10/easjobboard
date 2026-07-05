import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedJobsByOrganization } from "@/lib/jobs";
import { getOrganizationBySlug } from "@/lib/organizations";
import { getPlatformName } from "@/lib/env";

type PageProps = { params: Promise<{ orgSlug: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { orgSlug } = await params;
  const organization = getOrganizationBySlug(orgSlug);
  if (!organization) return { title: "Not found" };

  return {
    title: `${organization.name} Careers`,
    description: `Open positions at ${organization.name} on ${getPlatformName()}.`,
  };
}

export default async function OrgCareersPage({ params }: PageProps) {
  const { orgSlug } = await params;
  const organization = getOrganizationBySlug(orgSlug);
  if (!organization) notFound();

  const jobs = getPublishedJobsByOrganization(organization.id);

  return (
    <div className="page-shell space-y-8">
      <section className="space-y-2">
        <p className="text-sm text-zinc-500">Powered by {getPlatformName()}</p>
        <h1 className="text-3xl font-bold text-zinc-900">{organization.name}</h1>
        <p className="text-zinc-600">Browse open roles and apply directly.</p>
        {organization.website ? (
          <a href={organization.website} className="text-sm text-blue-600 hover:underline" target="_blank" rel="noreferrer">
            Visit company website
          </a>
        ) : null}
      </section>

      {jobs.length === 0 ? (
        <div className="card text-zinc-600">No open positions right now.</div>
      ) : (
        <ul className="space-y-4">
          {jobs.map((job) => (
            <li key={job.id}>
              <Link
                href={`/o/${orgSlug}/jobs/${job.slug}`}
                className="card block transition hover:border-blue-300 hover:shadow-md"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-zinc-900">{job.title}</h2>
                    <p className="mt-1 text-sm text-zinc-600">{job.location}</p>
                  </div>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                    {job.employment_type.replace("_", " ")}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

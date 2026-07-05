import { notFound } from "next/navigation";
import Script from "next/script";
import Link from "next/link";
import { ApplicationForm } from "@/components/ApplicationForm";
import { buildGoogleJobPostingJsonLd } from "@/lib/feeds/google-jobs";
import { getJobByOrgAndSlug } from "@/lib/jobs";
import { getOrganizationBySlug } from "@/lib/organizations";

type PageProps = { params: Promise<{ orgSlug: string; jobSlug: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { orgSlug, jobSlug } = await params;
  const organization = getOrganizationBySlug(orgSlug);
  if (!organization) return { title: "Not found" };

  const job = getJobByOrgAndSlug(organization.id, jobSlug);
  if (!job || job.status !== "published") return { title: "Not found" };

  return {
    title: `${job.title} — ${organization.name}`,
    description: job.description.slice(0, 160),
  };
}

export default async function OrgJobPage({ params }: PageProps) {
  const { orgSlug, jobSlug } = await params;
  const organization = getOrganizationBySlug(orgSlug);
  if (!organization) notFound();

  const job = getJobByOrgAndSlug(organization.id, jobSlug);
  if (!job || job.status !== "published") notFound();

  const jsonLd = buildGoogleJobPostingJsonLd(organization, job);

  return (
    <div className="page-shell space-y-4">
      <Link href={`/o/${orgSlug}`} className="text-sm text-blue-600 hover:underline">
        ← Back to {organization.name} careers
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <Script
          id="google-job-posting"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        <article className="card space-y-4">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900">{job.title}</h1>
            <p className="mt-2 text-zinc-600">{job.location}</p>
            <p className="mt-1 text-sm text-zinc-500">
              {job.employment_type.replace("_", " ")}
              {job.salary_min || job.salary_max
                ? ` · ${job.salary_min ?? ""}${job.salary_max ? `–${job.salary_max}` : ""} ${job.salary_currency}/${job.salary_period.toLowerCase()}`
                : ""}
            </p>
          </div>

          <div className="prose prose-zinc max-w-none whitespace-pre-wrap text-zinc-800">{job.description}</div>
        </article>

        <aside>
          <ApplicationForm orgSlug={orgSlug} jobSlug={job.slug} jobTitle={job.title} />
        </aside>
      </div>
    </div>
  );
}

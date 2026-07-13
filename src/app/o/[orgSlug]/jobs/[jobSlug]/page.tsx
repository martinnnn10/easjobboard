import { notFound } from "next/navigation";
import Link from "next/link";
import { ApplicationForm } from "@/components/ApplicationForm";
import { getOrgJobUrl } from "@/lib/env";
import { buildGoogleJobPostingJsonLd, serializeJsonLd } from "@/lib/feeds/google-jobs";
import { getJobByOrgAndSlug } from "@/lib/jobs";
import { getOrganizationBySlug } from "@/lib/organizations";
import { getScreen, toPublicScreen } from "@/lib/screens";

type PageProps = { params: Promise<{ orgSlug: string; jobSlug: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { orgSlug, jobSlug } = await params;
  const organization = getOrganizationBySlug(orgSlug);
  if (!organization) return { title: "Not found" };

  const job = getJobByOrgAndSlug(organization.id, jobSlug);
  if (!job || job.status !== "published") return { title: "Not found" };

  const title = `${job.title} — ${organization.name}`;
  const description = job.description.slice(0, 200).replace(/\s+/g, " ").trim();
  const url = getOrgJobUrl(orgSlug, job.slug);
  const image = { url: `${url}/og.png`, width: 1200, height: 630, alt: `${job.title} at ${organization.name}` };

  // Rich cards so links shared to LinkedIn/Slack/Twitter/Facebook render a
  // branded preview instead of a bare URL — a low-cost visibility multiplier.
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: organization.name,
      type: "website",
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image.url],
    },
  };
}

export default async function OrgJobPage({ params }: PageProps) {
  const { orgSlug, jobSlug } = await params;
  const organization = getOrganizationBySlug(orgSlug);
  if (!organization) notFound();

  const job = getJobByOrgAndSlug(organization.id, jobSlug);
  if (!job || job.status !== "published") notFound();

  const jsonLd = buildGoogleJobPostingJsonLd(organization, job);
  const template = getScreen(job.screen_key);
  const publicScreen = template ? toPublicScreen(template) : null;

  return (
    <div className="page-shell space-y-4">
      {/* JobPosting structured data — a real, server-rendered <script> so it is
          present in view-source and reliably parsed by Google, not deferred
          client-side. serializeJsonLd escapes <, >, & to prevent breakout. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />

      <Link href={`/o/${orgSlug}`} className="text-sm text-zinc-600 hover:text-zinc-900 hover:underline">
        ← Back to {organization.name} careers
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <article className="card space-y-4">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900">{job.title}</h1>
            <p className="mt-2 text-zinc-600">{job.location}</p>
            <p className="mt-1 text-sm text-zinc-500">
              {job.employment_type.replace("_", " ")}
              {job.shift ? ` · ${job.shift}` : ""}
              {job.salary_min || job.salary_max
                ? ` · ${job.salary_min ?? ""}${job.salary_max ? `–${job.salary_max}` : ""} ${job.salary_currency}/${job.salary_period.toLowerCase()}`
                : ""}
            </p>
          </div>

          {job.certifications.length > 0 ? (
            <div>
              <h2 className="text-sm font-semibold text-zinc-700">Required certifications</h2>
              <ul className="mt-2 flex flex-wrap gap-2">
                {job.certifications.map((cert) => (
                  <li
                    key={cert}
                    className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700"
                  >
                    {cert}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {(() => {
            const details = (
              [
                ["Schedule", job.schedule],
                ["Overtime", job.overtime],
                ["Union", job.union_status],
                ["Relocation", job.relocation],
                ["Industry", job.industry],
                ["PLC platforms", job.plc_platforms],
                ["VFD experience", job.vfd_experience],
                ["Ammonia / refrigeration", job.refrigeration],
                ["Travel", job.travel],
                [
                  "Apply by",
                  job.application_deadline
                    ? new Date(`${job.application_deadline}T00:00:00`).toLocaleDateString()
                    : "",
                ],
              ] as Array<[string, string]>
            ).filter(([, v]) => v);
            if (details.length === 0) return null;
            return (
              <div>
                <h2 className="text-sm font-semibold text-zinc-700">Role details</h2>
                <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                  {details.map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-3 border-b border-zinc-100 py-1">
                      <dt className="text-zinc-500">{label}</dt>
                      <dd className="text-right font-medium text-zinc-800">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            );
          })()}

          <div className="prose prose-zinc max-w-none whitespace-pre-wrap text-zinc-800">{job.description}</div>
        </article>

        <aside>
          <ApplicationForm orgSlug={orgSlug} jobSlug={job.slug} jobTitle={job.title} screen={publicScreen} />
        </aside>
      </div>
    </div>
  );
}

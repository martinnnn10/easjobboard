import { notFound } from "next/navigation";
import Link from "next/link";
import { ApplicationForm } from "@/components/ApplicationForm";
import type { Job } from "@/lib/db";
import { getOrgJobUrl } from "@/lib/env";
import { buildGoogleJobPostingJsonLd, serializeJsonLd } from "@/lib/feeds/google-jobs";
import { getJobByOrgAndSlug } from "@/lib/jobs";
import { getBrandColor, getOrganizationBySlug } from "@/lib/organizations";
import { resolveScreen } from "@/lib/screen-store";
import { toPublicScreen } from "@/lib/screens";

type PageProps = {
  params: Promise<{ orgSlug: string; jobSlug: string }>;
  searchParams: Promise<{ source?: string; utm_source?: string; utm_medium?: string; utm_campaign?: string }>;
};

function formatSalary(job: Job): string | null {
  if (!job.salary_min && !job.salary_max) return null;
  const fmt = (n: number) => `$${n.toLocaleString()}`;
  const range =
    job.salary_min && job.salary_max
      ? `${fmt(job.salary_min)}–${fmt(job.salary_max)}`
      : fmt(job.salary_min ?? job.salary_max ?? 0);
  return `${range} ${job.salary_currency}/${job.salary_period.toLowerCase()}`;
}

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

export default async function OrgJobPage({ params, searchParams }: PageProps) {
  const { orgSlug, jobSlug } = await params;
  const organization = getOrganizationBySlug(orgSlug);
  if (!organization) notFound();

  const job = getJobByOrgAndSlug(organization.id, jobSlug);
  if (!job || job.status !== "published") notFound();

  const sp = await searchParams;
  const attribution = {
    source: sp.source,
    utm_source: sp.utm_source,
    utm_medium: sp.utm_medium,
    utm_campaign: sp.utm_campaign,
  };

  const jsonLd = buildGoogleJobPostingJsonLd(organization, job);
  const template = resolveScreen(job.screen_key);
  const publicScreen = template ? toPublicScreen(template) : null;

  const brandColor = getBrandColor(organization);
  const salary = formatSalary(job);

  return (
    <div className="page-shell space-y-6">
      {/* JobPosting structured data — a real, server-rendered <script> so it is
          present in view-source and reliably parsed by Google, not deferred
          client-side. serializeJsonLd escapes <, >, & to prevent breakout. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />

      <Link href={`/o/${orgSlug}`} className="back-link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Back to {organization.name} careers
      </Link>

      <div className="grid items-start gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <article className="card space-y-7 md:p-8">
          <header>
            <p className="eyebrow" style={{ color: brandColor }}>
              {organization.name}
            </p>
            <h1 className="mt-1.5 text-3xl font-bold tracking-tight text-zinc-900 md:text-4xl">{job.title}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-2">
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
              {job.shift ? <span className="pill">{job.shift}</span> : null}
              {salary ? <span className="pill">{salary}</span> : null}
            </div>
          </header>

          {job.certifications.length > 0 ? (
            <section>
              <h2 className="eyebrow mb-3" style={{ color: brandColor }}>Required certifications</h2>
              <ul className="flex flex-wrap gap-2">
                {job.certifications.map((cert) => (
                  <li
                    key={cert}
                    className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700"
                  >
                    {cert}
                  </li>
                ))}
              </ul>
            </section>
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
              <section>
                <h2 className="eyebrow mb-3" style={{ color: brandColor }}>Role details</h2>
                <dl className="grid grid-cols-1 gap-x-8 text-sm sm:grid-cols-2">
                  {details.map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-3 border-b border-zinc-100 py-2.5">
                      <dt className="text-zinc-500">{label}</dt>
                      <dd className="text-right font-medium text-zinc-800">{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            );
          })()}

          <section>
            <h2 className="eyebrow mb-3" style={{ color: brandColor }}>About the role</h2>
            {/* Split on blank lines into paragraphs for real spacing; keep single
                line breaks (e.g. bullet lists) inside each via whitespace-pre-line.
                Text is rendered as React children, so it is always escaped — a
                description can never inject raw HTML. */}
            <div className="max-w-none space-y-4 leading-relaxed text-zinc-700">
              {job.description
                .split(/\n{2,}/)
                .map((para) => para.trim())
                .filter(Boolean)
                .map((para, index) => (
                  <p key={index} className="whitespace-pre-line">
                    {para}
                  </p>
                ))}
            </div>
          </section>
        </article>

        <aside>
          <ApplicationForm
            orgSlug={orgSlug}
            jobSlug={job.slug}
            jobTitle={job.title}
            screen={publicScreen}
            attribution={attribution}
          />
        </aside>
      </div>
    </div>
  );
}

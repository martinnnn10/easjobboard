import type { Job, Organization } from "../db";
import { getOrgJobUrl } from "../env";

const EMPLOYMENT_TYPE_MAP: Record<string, string> = {
  FULL_TIME: "FULL_TIME",
  PART_TIME: "PART_TIME",
  CONTRACT: "CONTRACTOR",
  TEMPORARY: "TEMPORARY",
  INTERN: "INTERN",
};

/**
 * Google drops postings with no validThrough after a while. Prefer the job's
 * real application deadline when set; otherwise give published jobs a rolling
 * 60-day window from the post date.
 */
function computeValidThrough(job: Job): string {
  if (job.application_deadline) {
    const deadline = new Date(`${job.application_deadline}T23:59:59`);
    if (!Number.isNaN(deadline.getTime())) return deadline.toISOString().slice(0, 10);
  }
  const base = new Date(job.published_at ?? job.created_at);
  if (Number.isNaN(base.getTime())) return "";
  base.setDate(base.getDate() + 60);
  return base.toISOString().slice(0, 10);
}

function isRemote(job: Job): boolean {
  return /(^|\W)(remote|work from home|telecommute)(\W|$)/i.test(`${job.location} ${job.city}`);
}

export function buildGoogleJobPostingJsonLd(organization: Organization, job: Job): Record<string, unknown> {
  const validThrough = computeValidThrough(job);
  const remote = isRemote(job);

  const posting: Record<string, unknown> = {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: job.title,
    description: job.description,
    identifier: {
      "@type": "PropertyValue",
      name: organization.name,
      value: job.reference_number,
    },
    datePosted: (job.published_at ?? job.created_at).slice(0, 10),
    ...(validThrough ? { validThrough } : {}),
    employmentType: EMPLOYMENT_TYPE_MAP[job.employment_type] ?? "FULL_TIME",
    hiringOrganization: {
      "@type": "Organization",
      name: job.company_name,
      sameAs: organization.website || undefined,
    },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: job.city || job.location,
        addressRegion: job.state,
        postalCode: job.zip || undefined,
        addressCountry: job.country || "US",
      },
    },
    // Remote roles must declare TELECOMMUTE + where applicants may be located,
    // or Google flags the location as invalid.
    ...(remote
      ? {
          jobLocationType: "TELECOMMUTE",
          applicantLocationRequirements: {
            "@type": "Country",
            name: job.country || "US",
          },
        }
      : {}),
    // Candidates apply on this careers page (the application form is on-page).
    directApply: true,
    url: getOrgJobUrl(organization.slug, job.slug),
  };

  if (job.salary_min || job.salary_max) {
    posting.baseSalary = {
      "@type": "MonetaryAmount",
      currency: job.salary_currency,
      value: {
        "@type": "QuantitativeValue",
        minValue: job.salary_min ?? undefined,
        maxValue: job.salary_max ?? undefined,
        unitText: job.salary_period,
      },
    };
  }

  if (job.shift) {
    posting.workHours = job.shift;
  }

  if (job.certifications.length > 0) {
    posting.qualifications = job.certifications.join(", ");
  }

  return posting;
}

/**
 * Serialize a JSON-LD object for safe embedding inside an inline
 * <script type="application/ld+json"> tag. JSON.stringify alone does not
 * escape "<", so a job field containing "</script>" (or "<!--") could break
 * out of the script element. Escaping the HTML-significant characters as
 * unicode escapes keeps the JSON valid while making breakout impossible.
 */
export function serializeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

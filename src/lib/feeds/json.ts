import type { Job, Organization } from "../db";
import { getBaseUrl, getOrgJobUrl } from "../env";

/**
 * A clean, structured JSON representation of an organization's open jobs.
 *
 * Programmatic aggregators, custom integrations, and modern job distributors
 * increasingly prefer JSON over XML. This mirrors the fields in the Indeed XML
 * feed so the two stay in sync.
 */
export function buildJobsJsonFeed(organization: Organization, jobs: Job[]): Record<string, unknown> {
  const baseUrl = getBaseUrl();

  return {
    version: "1.0",
    publisher: organization.name,
    publisherUrl: `${baseUrl}/o/${organization.slug}`,
    lastBuildDate: new Date().toISOString(),
    jobCount: jobs.length,
    jobs: jobs.map((job) => ({
      referenceNumber: job.reference_number,
      title: job.title,
      description: job.description,
      company: job.company_name,
      employmentType: job.employment_type,
      location: {
        display: job.location,
        city: job.city || null,
        state: job.state || null,
        postalCode: job.zip || null,
        country: job.country || null,
      },
      salary:
        job.salary_min || job.salary_max
          ? {
              min: job.salary_min,
              max: job.salary_max,
              currency: job.salary_currency,
              period: job.salary_period,
            }
          : null,
      applyEmail: organization.application_email,
      url: getOrgJobUrl(organization.slug, job.slug),
      datePosted: job.published_at ?? job.created_at,
    })),
  };
}

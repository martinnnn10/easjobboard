import type { Job, Organization } from "../db";
import { getBaseUrl, getOrgJobUrl } from "../env";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapCdata(value: string): string {
  return `<![CDATA[${value.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

function formatIndeedDate(isoDate: string | null): string {
  const date = isoDate ? new Date(isoDate) : new Date();
  return date.toISOString().replace(/\.\d{3}Z$/, "");
}

export function buildIndeedXml(organization: Organization, jobs: Job[]): string {
  const baseUrl = getBaseUrl();
  const companyWebsite = organization.website || `${baseUrl}/o/${organization.slug}`;

  const jobNodes = jobs
    .map((job) => {
      const jobUrl = getOrgJobUrl(organization.slug, job.slug);
      const salaryBlock =
        job.salary_min || job.salary_max
          ? `<salary>
      ${job.salary_min ? `<salary_min>${job.salary_min}</salary_min>` : ""}
      ${job.salary_max ? `<salary_max>${job.salary_max}</salary_max>` : ""}
      <salary_currency>${escapeXml(job.salary_currency)}</salary_currency>
      <salary_period>${escapeXml(job.salary_period)}</salary_period>
    </salary>`
          : "";

      return `<job>
    <title>${escapeXml(job.title)}</title>
    <date>${formatIndeedDate(job.published_at ?? job.updated_at)}</date>
    <referencenumber>${escapeXml(job.reference_number)}</referencenumber>
    <url>${escapeXml(jobUrl)}</url>
    <company>${escapeXml(job.company_name)}</company>
    <sourcename>${escapeXml(job.company_name)}</sourcename>
    <city>${escapeXml(job.city || job.location)}</city>
    <state>${escapeXml(job.state)}</state>
    <country>${escapeXml(job.country)}</country>
    <postalcode>${escapeXml(job.zip)}</postalcode>
    <location>${escapeXml(job.location)}</location>
    <email>${escapeXml(organization.application_email)}</email>
    <description>${wrapCdata(job.description)}</description>
    <jobtype>${escapeXml(job.employment_type)}</jobtype>
    <website>${escapeXml(companyWebsite)}</website>
    ${salaryBlock}
  </job>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<source>
  <publisher>${escapeXml(organization.name)}</publisher>
  <publisherurl>${escapeXml(`${baseUrl}/o/${organization.slug}`)}</publisherurl>
  <lastBuildDate>${formatIndeedDate(new Date().toISOString())}</lastBuildDate>
${jobNodes}
</source>`;
}

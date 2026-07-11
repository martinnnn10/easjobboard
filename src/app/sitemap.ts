import type { MetadataRoute } from "next";
import { getOrgJobUrl, getOrgUrl, getPublicBaseUrl } from "@/lib/env";
import { getPublishedJobsByOrganization } from "@/lib/jobs";
import { listPublicOrganizations } from "@/lib/organizations";

// Read the DB at request time (not build time) so newly published jobs appear
// without a redeploy.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeDate(value: string | null | undefined): Date {
  const t = value ? Date.parse(value) : NaN;
  return Number.isFinite(t) ? new Date(t) : new Date();
}

/**
 * Root sitemap: the homepage, every real organization's public careers page,
 * and every published, non-expired job page. Excludes demo workspaces, drafts,
 * closed/expired jobs, and all admin/candidate/private routes so search engines
 * only ever see indexable public pages.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = getPublicBaseUrl();
  const today = new Date().toISOString().slice(0, 10);

  const entries: MetadataRoute.Sitemap = [
    { url: base, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
  ];

  for (const org of listPublicOrganizations()) {
    entries.push({
      url: getOrgUrl(org.slug),
      lastModified: safeDate(org.updated_at),
      changeFrequency: "daily",
      priority: 0.8,
    });

    for (const job of getPublishedJobsByOrganization(org.id)) {
      // Skip expired postings (application deadline already passed).
      if (job.application_deadline && job.application_deadline < today) continue;
      entries.push({
        url: getOrgJobUrl(org.slug, job.slug),
        lastModified: safeDate(job.updated_at),
        changeFrequency: "weekly",
        priority: 0.9,
      });
    }
  }

  return entries;
}

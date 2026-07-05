import { getOrgJobUrl, getOrgUrl } from "@/lib/env";
import { getPublishedJobsByOrganization } from "@/lib/jobs";
import { getOrganizationBySlug } from "@/lib/organizations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ orgSlug: string }> };

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Per-org sitemap so search engines discover and index every open job page,
// driving organic search visibility beyond the job boards.
export async function GET(_request: Request, context: RouteContext) {
  const { orgSlug } = await context.params;
  const organization = getOrganizationBySlug(orgSlug);
  if (!organization) {
    return new Response("Organization not found", { status: 404 });
  }

  const jobs = getPublishedJobsByOrganization(organization.id);

  const urls = [
    { loc: getOrgUrl(orgSlug), lastmod: organization.updated_at },
    ...jobs.map((job) => ({
      loc: getOrgJobUrl(orgSlug, job.slug),
      lastmod: job.updated_at,
    })),
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (entry) =>
      `  <url>\n    <loc>${escapeXml(entry.loc)}</loc>\n    <lastmod>${escapeXml(entry.lastmod.slice(0, 10))}</lastmod>\n  </url>`,
  )
  .join("\n")}
</urlset>`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

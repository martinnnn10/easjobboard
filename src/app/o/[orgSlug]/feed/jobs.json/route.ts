import { buildJobsJsonFeed } from "@/lib/feeds/json";
import { getPublishedJobsByOrganization } from "@/lib/jobs";
import { getOrganizationBySlug } from "@/lib/organizations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ orgSlug: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { orgSlug } = await context.params;
  const organization = getOrganizationBySlug(orgSlug);

  if (!organization) {
    return new Response("Organization not found", { status: 404 });
  }

  const jobs = getPublishedJobsByOrganization(organization.id);
  const feed = buildJobsJsonFeed(organization, jobs);

  return new Response(JSON.stringify(feed, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

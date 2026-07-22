import { getOrganizationBySlug, getOrganizationLogo } from "@/lib/organizations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ orgSlug: string }> };

/**
 * Public serve route for an organization's careers-page logo. Returns the stored
 * image, or 404 when the org has no logo (the careers page then renders initials).
 */
export async function GET(_request: Request, context: RouteContext) {
  const { orgSlug } = await context.params;
  const organization = getOrganizationBySlug(orgSlug);
  if (!organization) return new Response("Not found", { status: 404 });

  const logo = getOrganizationLogo(organization.id);
  if (!logo) return new Response("No logo", { status: 404 });

  return new Response(new Uint8Array(logo.data), {
    headers: {
      "Content-Type": logo.contentType,
      // Short cache so a freshly uploaded logo appears quickly.
      "Cache-Control": "public, max-age=300",
    },
  });
}

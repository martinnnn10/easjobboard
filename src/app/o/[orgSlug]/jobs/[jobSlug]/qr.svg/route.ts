import QRCode from "qrcode";
import { getOrgJobUrl } from "@/lib/env";
import { getJobByOrgAndSlug } from "@/lib/jobs";
import { getOrganizationBySlug } from "@/lib/organizations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ orgSlug: string; jobSlug: string }> };

/**
 * QR code (SVG) pointing at a job's public apply page. Useful for printed
 * flyers, job fairs, and trade shows — a scan takes a candidate straight to the
 * application. Reach beyond the screen.
 */
export async function GET(_request: Request, context: RouteContext) {
  const { orgSlug, jobSlug } = await context.params;
  const organization = getOrganizationBySlug(orgSlug);
  if (!organization) {
    return new Response("Organization not found", { status: 404 });
  }

  const job = getJobByOrgAndSlug(organization.id, jobSlug);
  if (!job || job.status !== "published") {
    return new Response("Job not found", { status: 404 });
  }

  const target = getOrgJobUrl(orgSlug, job.slug);
  const svg = await QRCode.toString(target, { type: "svg", margin: 1, width: 300 });

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

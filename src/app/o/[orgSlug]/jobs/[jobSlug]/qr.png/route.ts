import QRCode from "qrcode";
import { getOrgJobUrl } from "@/lib/env";
import { getJobByOrgAndSlug } from "@/lib/jobs";
import { getOrganizationBySlug } from "@/lib/organizations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ orgSlug: string; jobSlug: string }> };

/**
 * QR code (PNG) pointing at a job's public apply page — a backward-compatible
 * companion to qr.svg for tools/print workflows that need a raster image. SVG
 * stays the primary format; this mirrors it exactly (same target URL, same
 * published-only gating) and does not change flyer behavior.
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

  const target = `${getOrgJobUrl(orgSlug, job.slug)}?source=qr`;
  const png = await QRCode.toBuffer(target, { type: "png", margin: 1, width: 300 });

  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

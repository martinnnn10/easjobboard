import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/api";
import { requireOrgCapability } from "@/lib/auth";
import { isChannel, isValidManualStatus, setManualStatus } from "@/lib/distribution";
import { canSeeJob, getJobAccess } from "@/lib/job-visibility";
import { getJobById } from "@/lib/jobs";
import { canWrite } from "@/lib/roles";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ orgSlug: string; id: string }> };

/** Set (or reset, with an empty status) a manual distribution status for a job/channel. */
export async function POST(request: Request, context: RouteContext) {
  const { orgSlug, id } = await context.params;

  try {
    const { organization, user } = await requireOrgCapability(orgSlug, canWrite);
    const body = (await request.json().catch(() => ({}))) as { channel?: unknown; status?: unknown };

    if (!isChannel(body.channel)) {
      return NextResponse.json({ error: "Unknown channel." }, { status: 400 });
    }
    const status = typeof body.status === "string" ? body.status : "";
    if (!isValidManualStatus(body.channel, status)) {
      return NextResponse.json({ error: "Invalid status for this channel." }, { status: 400 });
    }

    const job = getJobById(id);
    if (!job || job.organization_id !== organization.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!canSeeJob(getJobAccess(organization.id, user), job.id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    setManualStatus({
      organizationId: organization.id,
      jobId: job.id,
      channel: body.channel,
      status,
      updatedBy: user.id,
    });
    return NextResponse.json({ ok: true, channel: body.channel, status });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Failed to update status." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/api";
import { requireOrgCapability } from "@/lib/auth";
import { canSeeJob, getJobAccess } from "@/lib/job-visibility";
import { getJobById, updateJob } from "@/lib/jobs";
import { canWrite } from "@/lib/roles";
import { getScreenRecord } from "@/lib/screen-store";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ orgSlug: string; id: string }> };

/**
 * Attach a published screen to a job by pinning the job's screen_key to the
 * screen's current published VERSION id (sv_…). Pinning the version — not the
 * logical screen — is what keeps future candidate results tied to an exact,
 * immutable version. Re-attaching after an edit updates the pin for FUTURE
 * invites/applies only; already-submitted results keep their own version.
 * Owner/recruiter only.
 */
export async function POST(request: Request, context: RouteContext) {
  const { orgSlug, id } = await context.params;
  try {
    const { organization, user } = await requireOrgCapability(orgSlug, canWrite);
    const body = (await request.json().catch(() => ({}))) as { job_id?: unknown };
    const jobId = typeof body.job_id === "string" ? body.job_id.trim() : "";
    if (!jobId) return NextResponse.json({ error: "Choose a job to attach the screen to." }, { status: 400 });

    const record = getScreenRecord(id, organization.id);
    if (!record) return NextResponse.json({ error: "Screen not found." }, { status: 404 });
    if (!record.publishedVersionId) {
      return NextResponse.json({ error: "Publish the screen before attaching it to a job." }, { status: 400 });
    }

    const job = getJobById(jobId);
    if (!job || job.organization_id !== organization.id || !canSeeJob(getJobAccess(organization.id, user), job.id)) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    const updated = updateJob(job.id, organization.id, { screen_key: record.publishedVersionId });
    if (!updated) return NextResponse.json({ error: "Couldn't attach the screen." }, { status: 500 });

    return NextResponse.json({ ok: true, screenKey: record.publishedVersionId, jobId: job.id });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return authError;
    console.error("Attach screen failed:", error);
    return NextResponse.json({ error: "Couldn't attach the screen." }, { status: 500 });
  }
}

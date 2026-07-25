import { NextResponse } from "next/server";
import { requireOrgCapability } from "@/lib/auth";
import { authErrorResponse } from "@/lib/api";
import { canWrite } from "@/lib/roles";
import { attachCandidateToJob } from "@/lib/applications";
import { getCandidateById } from "@/lib/candidates";
import { canSeeJob, getJobAccess } from "@/lib/job-visibility";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ orgSlug: string; id: string }> };

/** Attach an existing candidate to a job (opens an application for them). */
export async function POST(request: Request, context: RouteContext) {
  const { orgSlug, id } = await context.params;

  try {
    const { organization, user } = await requireOrgCapability(orgSlug, canWrite);
    const candidate = getCandidateById(id, organization.id);
    if (!candidate) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = (await request.json().catch(() => ({}))) as { job_id?: unknown };
    const jobId = typeof body.job_id === "string" ? body.job_id.trim() : "";
    if (!jobId) {
      return NextResponse.json({ error: "Choose a job to attach this candidate to." }, { status: 400 });
    }
    // Can't attach to a restricted job you aren't allowed to see.
    if (!canSeeJob(getJobAccess(organization.id, user), jobId)) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    const result = attachCandidateToJob({
      organization_id: organization.id,
      candidate_id: id,
      job_id: jobId,
      actor: user.name,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ application: result.application }, { status: 201 });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return authError;
    console.error("Attach candidate to job failed:", error);
    return NextResponse.json({ error: "Failed to attach candidate." }, { status: 500 });
  }
}

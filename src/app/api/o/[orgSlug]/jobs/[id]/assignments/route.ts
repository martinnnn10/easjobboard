import { NextResponse } from "next/server";
import { requireOrgCapability } from "@/lib/auth";
import { authErrorResponse } from "@/lib/api";
import { canWrite } from "@/lib/roles";
import { assignRecruiter } from "@/lib/candidate-care";
import { getCandidateById } from "@/lib/candidates";
import { getJobById } from "@/lib/jobs";
import { getUserById } from "@/lib/users";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ orgSlug: string; id: string }> };

/** Assign the recruiter responsible for a candidate on this job req. */
export async function POST(request: Request, context: RouteContext) {
  const { orgSlug, id: jobId } = await context.params;

  try {
    const { organization, user } = await requireOrgCapability(orgSlug, canWrite);
    const job = getJobById(jobId);
    if (!job || job.organization_id !== organization.id) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const body = (await request.json().catch(() => ({}))) as { candidate_id?: unknown; recruiter_id?: unknown };
    const candidateId = typeof body.candidate_id === "string" ? body.candidate_id : "";
    const recruiterId = typeof body.recruiter_id === "string" ? body.recruiter_id : "";

    const candidate = candidateId ? getCandidateById(candidateId, organization.id) : null;
    if (!candidate) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });

    const recruiter = recruiterId ? getUserById(recruiterId) : null;
    if (!recruiter || recruiter.organization_id !== organization.id) {
      return NextResponse.json({ error: "That teammate isn't in this organization." }, { status: 400 });
    }

    const assignment = assignRecruiter({
      organization_id: organization.id,
      candidate_id: candidateId,
      job_id: jobId,
      assigned_recruiter_id: recruiterId,
      assigned_by: user.id,
      actor: user.name,
    });

    return NextResponse.json({ assignment }, { status: 201 });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return authError;
    console.error("Assign recruiter failed:", error);
    return NextResponse.json({ error: "Failed to assign recruiter." }, { status: 500 });
  }
}

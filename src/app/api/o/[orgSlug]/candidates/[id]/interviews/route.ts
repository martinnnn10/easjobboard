import { NextResponse } from "next/server";
import { requireOrgCapability } from "@/lib/auth";
import { authErrorResponse } from "@/lib/api";
import { canWrite } from "@/lib/roles";
import { scheduleInterview } from "@/lib/candidate-care";
import { getCandidateById } from "@/lib/candidates";
import { getJobById } from "@/lib/jobs";
import { canSeeJob, getJobAccess } from "@/lib/job-visibility";
import { isInterviewType } from "@/lib/care-meta";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ orgSlug: string; id: string }> };

function str(v: unknown, max = 300): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/** Schedule an interview — auto-creates the required Candidate Care follow-ups. */
export async function POST(request: Request, context: RouteContext) {
  const { orgSlug, id: candidateId } = await context.params;

  try {
    const { organization, user } = await requireOrgCapability(orgSlug, canWrite);
    const candidate = getCandidateById(candidateId, organization.id);
    if (!candidate) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const jobId = str(body.job_id, 60);
    const datetime = str(body.interview_datetime, 40);
    if (!jobId) return NextResponse.json({ error: "Pick the job this interview is for." }, { status: 400 });
    if (!datetime) return NextResponse.json({ error: "Interview date & time is required." }, { status: 400 });

    const job = getJobById(jobId);
    if (!job || job.organization_id !== organization.id || !canSeeJob(getJobAccess(organization.id, user), job.id)) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const interview = scheduleInterview({
      organization_id: organization.id,
      candidate_id: candidateId,
      job_id: jobId,
      application_id: str(body.application_id, 60) || null,
      client: str(body.client, 200),
      interview_title: str(body.interview_title, 200),
      interview_type: isInterviewType(body.interview_type) ? body.interview_type : "",
      interview_datetime: datetime,
      timezone: str(body.timezone, 60),
      location: str(body.location, 500),
      hiring_manager: str(body.hiring_manager, 200),
      stage: str(body.stage, 60),
      notes: str(body.notes, 2000),
      created_by: user.id,
      actor: user.name,
    });

    return NextResponse.json({ interview }, { status: 201 });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return authError;
    console.error("Schedule interview failed:", error);
    return NextResponse.json({ error: "Failed to schedule interview." }, { status: 500 });
  }
}

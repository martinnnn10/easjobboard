import { NextResponse } from "next/server";
import { requireOrgCapability } from "@/lib/auth";
import { authErrorResponse } from "@/lib/api";
import { canWrite } from "@/lib/roles";
import { getCandidateById } from "@/lib/candidates";
import { logCall } from "@/lib/calls";
import { isCallChannel, isCallOutcome } from "@/lib/call-outcomes";
import { getApplicationDetail, updateApplicationStatus } from "@/lib/applications";
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/application-status";
import { getJobAccess } from "@/lib/job-visibility";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ orgSlug: string; id: string }> };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Log a call/text/email outcome on a candidate (+ optional stage move). */
export async function POST(request: Request, context: RouteContext) {
  const { orgSlug, id } = await context.params;

  try {
    const { organization, user } = await requireOrgCapability(orgSlug, canWrite);
    const candidate = getCandidateById(id, organization.id);
    if (!candidate) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const channel = body.channel;
    const outcome = body.outcome;
    if (!isCallChannel(channel)) {
      return NextResponse.json({ error: "Pick a valid contact method." }, { status: 400 });
    }
    if (!isCallOutcome(outcome)) {
      return NextResponse.json({ error: "Pick a valid outcome." }, { status: 400 });
    }

    const note = typeof body.note === "string" ? body.note.slice(0, 2000) : "";
    const applicationId = typeof body.application_id === "string" ? body.application_id : undefined;
    const followUpAt = typeof body.follow_up_at === "string" && DATE_RE.test(body.follow_up_at) ? body.follow_up_at : undefined;

    logCall({
      organization_id: organization.id,
      candidate_id: candidate.id,
      application_id: applicationId,
      channel,
      outcome,
      note,
      followUpAt,
      actor: user.name,
    });

    // Optional stage move (records its own stage_change timeline event).
    const status = body.status;
    if (typeof status === "string" && status && applicationId) {
      if (!(APPLICATION_STATUSES as string[]).includes(status)) {
        return NextResponse.json({ error: "Invalid stage." }, { status: 400 });
      }
      // Only advance the stage if this user can see the application's job.
      if (getApplicationDetail(applicationId, organization.id, getJobAccess(organization.id, user))) {
        updateApplicationStatus(applicationId, organization.id, status as ApplicationStatus, user.name);
      }
    }

    return NextResponse.json({ ok: true, candidate: getCandidateById(id, organization.id) });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return authError;
    console.error("Log call failed:", error);
    return NextResponse.json({ error: "Failed to log the call." }, { status: 500 });
  }
}

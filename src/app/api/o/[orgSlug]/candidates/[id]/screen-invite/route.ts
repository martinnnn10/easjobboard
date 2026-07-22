import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/api";
import {
  attachCandidateToJob,
  getApplicationByCandidateAndJob,
  setApplicationScreenStatus,
} from "@/lib/applications";
import { requireOrgCapability } from "@/lib/auth";
import { recordCandidateEvent } from "@/lib/candidate-events";
import { getCandidateById } from "@/lib/candidates";
import { sendScreenInviteEmail, isEmailConfigured } from "@/lib/email";
import { getPublicBaseUrl } from "@/lib/env";
import { canSeeJob, getJobAccess } from "@/lib/job-visibility";
import { getJobById } from "@/lib/jobs";
import { canWrite } from "@/lib/roles";
import { createScreenInvite } from "@/lib/screen-invites";
import { resolveScreenLabel, screenBelongsToOrg, screenExists } from "@/lib/screen-store";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ orgSlug: string; id: string }> };

/**
 * Send a role-specific skills screen to an existing candidate. Ensures the
 * candidate has an application on the chosen job (so the completed screen folds
 * onto real intelligence, Call Queue ranking, and the presentation), mints a
 * secure token, and — when SMTP is configured — emails the invite. Always
 * returns a copy-link so the recruiter can send it manually in v1.
 */
export async function POST(request: Request, context: RouteContext) {
  const { orgSlug, id } = await context.params;

  try {
    const { organization, user } = await requireOrgCapability(orgSlug, canWrite);
    const candidate = getCandidateById(id, organization.id);
    if (!candidate) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!candidate.email) {
      return NextResponse.json(
        { error: "This candidate has no email. Add one before sending a skills screen." },
        { status: 400 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      job_id?: unknown;
      screen_key?: unknown;
      message?: unknown;
      expires_days?: unknown;
    };
    const jobId = typeof body.job_id === "string" ? body.job_id.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim().slice(0, 1000) : "";
    if (!jobId) {
      return NextResponse.json({ error: "Choose a job to screen this candidate for." }, { status: 400 });
    }

    const job = getJobById(jobId);
    if (!job || job.organization_id !== organization.id || !canSeeJob(getJobAccess(organization.id, user), job.id)) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    // The screen template: an explicit override, else the job's configured
    // screen. A job with no screen requires the recruiter to pick one.
    const overrideKey = typeof body.screen_key === "string" ? body.screen_key.trim() : "";
    const screenKey = overrideKey || job.screen_key;
    // Accept built-in screens and the org's own custom screens; never another
    // org's screen (isolation), and never an unresolvable key.
    if (!screenKey || !screenExists(screenKey) || !screenBelongsToOrg(screenKey, organization.id)) {
      return NextResponse.json(
        { error: "This job has no skills screen configured. Choose a screen to send." },
        { status: 400 },
      );
    }

    // Ensure an application exists for this (candidate, job) — that's what the
    // completed screen updates. Reuse an existing one; otherwise open one.
    let application = getApplicationByCandidateAndJob(candidate.id, job.id, organization.id);
    if (!application) {
      const attached = attachCandidateToJob({
        organization_id: organization.id,
        candidate_id: candidate.id,
        job_id: job.id,
        actor: user.name,
        source: "manual",
      });
      if (!attached.ok) {
        return NextResponse.json({ error: attached.error }, { status: 400 });
      }
      application = attached.application;
    }

    // Mark the application as awaiting the screen — but never downgrade a screen
    // that's already completed.
    if (application.screen_status !== "completed") {
      setApplicationScreenStatus(application.id, organization.id, "pending");
    }

    // Optional expiration.
    let expiresAt = "";
    const expiresDays = Number(body.expires_days);
    if (Number.isFinite(expiresDays) && expiresDays > 0) {
      expiresAt = new Date(Date.now() + Math.min(expiresDays, 90) * 24 * 60 * 60 * 1000).toISOString();
    }

    const invite = createScreenInvite({
      organization_id: organization.id,
      candidate_id: candidate.id,
      job_id: job.id,
      application_id: application.id,
      screen_key: screenKey,
      source: "manual",
      message,
      sent_by: user.name,
      expires_at: expiresAt,
    });

    const link = `${getPublicBaseUrl()}/screen/${invite.token}`;
    const screenLabel = resolveScreenLabel(screenKey);

    // Deliver by email when we can; always return the link for copy-send.
    let emailed = false;
    if (isEmailConfigured()) {
      try {
        await sendScreenInviteEmail({
          organization,
          to: candidate.email,
          candidateName: candidate.name || candidate.email,
          jobTitle: job.title,
          link,
          message,
        });
        emailed = true;
      } catch (emailError) {
        console.error("Screen invite email failed (link still valid):", emailError);
      }
    }

    recordCandidateEvent({
      organization_id: organization.id,
      candidate_id: candidate.id,
      application_id: application.id,
      type: "email_sent",
      detail: emailed
        ? `Skills screen sent to ${candidate.email}${screenLabel ? ` — ${screenLabel}` : ""} for ${job.title}.`
        : `Skills screen link created${screenLabel ? ` — ${screenLabel}` : ""} for ${job.title}. Send it to the candidate.`,
      actor: user.name,
    });

    return NextResponse.json({ ok: true, emailed, link, token: invite.token }, { status: 201 });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return authError;
    console.error("Send screen invite failed:", error);
    return NextResponse.json({ error: "Failed to send skills screen." }, { status: 500 });
  }
}

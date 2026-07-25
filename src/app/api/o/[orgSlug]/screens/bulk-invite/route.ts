import { NextResponse } from "next/server";
import {
  attachCandidateToJob,
  getApplicationByCandidateAndJob,
  setApplicationScreenStatus,
} from "@/lib/applications";
import { authErrorResponse } from "@/lib/api";
import { requireOrgCapability } from "@/lib/auth";
import { recordCandidateEvent } from "@/lib/candidate-events";
import { getCandidateById } from "@/lib/candidates";
import { isEmailConfigured, sendScreenInviteEmail } from "@/lib/email";
import { getPublicBaseUrl } from "@/lib/env";
import { canSeeJob, getJobAccess } from "@/lib/job-visibility";
import { getJobById } from "@/lib/jobs";
import { canWrite } from "@/lib/roles";
import {
  createScreenInvite,
  findActiveInvite,
  markInviteDelivered,
  markInviteFailed,
  recordInviteBatch,
} from "@/lib/screen-invites";
import { resolveScreenLabel, screenBelongsToOrg, screenExists } from "@/lib/screen-store";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ orgSlug: string }> };

type Outcome = { candidateId: string; status: "sent" | "skipped" | "failed"; reason?: string };

/**
 * True bulk send: one attached screen to many selected candidates in a single
 * action. Validates every candidate first, dedupes active invitations (unless
 * resend is chosen), tolerates per-candidate email failures without aborting the
 * batch, records a batch summary, and preserves org isolation + RBAC.
 * Owner/recruiter only. Never sends without the explicit request from the UI.
 */
export async function POST(request: Request, context: RouteContext) {
  const { orgSlug } = await context.params;
  try {
    const { organization, user } = await requireOrgCapability(orgSlug, canWrite);
    const body = (await request.json().catch(() => ({}))) as {
      job_id?: unknown;
      candidate_ids?: unknown;
      screen_key?: unknown;
      message?: unknown;
      expires_days?: unknown;
      resend?: unknown;
    };

    const jobId = typeof body.job_id === "string" ? body.job_id.trim() : "";
    const candidateIds = Array.isArray(body.candidate_ids)
      ? [...new Set(body.candidate_ids.filter((x): x is string => typeof x === "string" && x.length > 0))]
      : [];
    const message = typeof body.message === "string" ? body.message.trim().slice(0, 1000) : "";
    const resend = body.resend === true;

    if (!jobId) return NextResponse.json({ error: "Choose a job to screen these candidates for." }, { status: 400 });
    if (candidateIds.length === 0) return NextResponse.json({ error: "Select at least one candidate." }, { status: 400 });
    if (candidateIds.length > 200) return NextResponse.json({ error: "Select 200 candidates or fewer per batch." }, { status: 400 });

    const job = getJobById(jobId);
    if (!job || job.organization_id !== organization.id || !canSeeJob(getJobAccess(organization.id, user), job.id)) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    const overrideKey = typeof body.screen_key === "string" ? body.screen_key.trim() : "";
    const screenKey = overrideKey || job.screen_key;
    if (!screenKey || !screenExists(screenKey) || !screenBelongsToOrg(screenKey, organization.id)) {
      return NextResponse.json({ error: "This job has no skills screen configured. Choose a screen to send." }, { status: 400 });
    }

    let expiresAt = "";
    const expiresDays = Number(body.expires_days);
    if (Number.isFinite(expiresDays) && expiresDays > 0) {
      expiresAt = new Date(Date.now() + Math.min(expiresDays, 90) * 24 * 60 * 60 * 1000).toISOString();
    }

    const screenLabel = resolveScreenLabel(screenKey);
    const emailOn = isEmailConfigured();
    const outcomes: Outcome[] = [];
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const candidateId of candidateIds) {
      const candidate = getCandidateById(candidateId, organization.id);
      // Org isolation: a candidate id from another org resolves to null → skipped.
      if (!candidate) {
        skipped++;
        outcomes.push({ candidateId, status: "skipped", reason: "not_found" });
        continue;
      }
      if (!candidate.email) {
        skipped++;
        outcomes.push({ candidateId, status: "skipped", reason: "no_email" });
        continue;
      }
      // Dedupe: an active pending invite already exists and no resend requested.
      if (!resend && findActiveInvite(candidate.id, job.id, organization.id)) {
        skipped++;
        outcomes.push({ candidateId, status: "skipped", reason: "already_invited" });
        continue;
      }

      // Ensure an application exists for (candidate, job).
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
          skipped++;
          outcomes.push({ candidateId, status: "skipped", reason: "attach_failed" });
          continue;
        }
        application = attached.application;
      }
      if (application.screen_status !== "completed") {
        setApplicationScreenStatus(application.id, organization.id, "pending");
      }

      const invite = createScreenInvite({
        organization_id: organization.id,
        candidate_id: candidate.id,
        job_id: job.id,
        application_id: application.id,
        screen_key: screenKey,
        source: "bulk",
        message,
        sent_by: user.name,
        expires_at: expiresAt,
      });
      const link = `${getPublicBaseUrl()}/screen/${invite.token}`;

      let emailed = false;
      let sendFailed = false;
      if (emailOn) {
        try {
          const { delivered } = await sendScreenInviteEmail({
            organization,
            to: candidate.email,
            candidateName: candidate.name || candidate.email,
            jobTitle: job.title,
            link,
            message,
          });
          emailed = true;
          if (delivered) markInviteDelivered(invite.id);
        } catch {
          // One failure never stops the batch. Persist a SAFE category only.
          markInviteFailed(invite.id, "smtp_error");
          sendFailed = true;
        }
      }

      recordCandidateEvent({
        organization_id: organization.id,
        candidate_id: candidate.id,
        application_id: application.id,
        type: "email_sent",
        detail: emailed
          ? `Skills screen sent to ${candidate.email}${screenLabel ? ` — ${screenLabel}` : ""} for ${job.title} (bulk).`
          : `Skills screen link created${screenLabel ? ` — ${screenLabel}` : ""} for ${job.title} (bulk).`,
        actor: user.name,
      });

      if (sendFailed) {
        failed++;
        outcomes.push({ candidateId, status: "failed", reason: "email_failed" });
      } else {
        sent++;
        outcomes.push({ candidateId, status: "sent" });
      }
    }

    const batchId = recordInviteBatch({
      organization_id: organization.id,
      job_id: job.id,
      screen_key: screenKey,
      created_by: user.name,
      total_selected: candidateIds.length,
      sent,
      skipped,
      failed,
    });

    return NextResponse.json(
      { ok: true, batchId, total: candidateIds.length, sent, skipped, failed, emailConfigured: emailOn, outcomes },
      { status: 201 },
    );
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return authError;
    console.error("Bulk screen invite failed:", error);
    return NextResponse.json({ error: "Failed to send skills screens." }, { status: 500 });
  }
}

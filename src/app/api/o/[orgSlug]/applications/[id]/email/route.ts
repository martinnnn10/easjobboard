import { NextResponse } from "next/server";
import { getApplicationDetail } from "@/lib/applications";
import { requireOrgCapability } from "@/lib/auth";
import { getJobAccess } from "@/lib/job-visibility";
import { authErrorResponse } from "@/lib/api";
import { canWrite } from "@/lib/roles";
import { recordCandidateEvent } from "@/lib/candidate-events";
import { sendCandidateEmail } from "@/lib/email";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

// Outbound candidate email; keep it modestly rate limited per org.
const EMAIL_RATE_LIMIT = 60;
const EMAIL_RATE_WINDOW_MS = 60 * 60 * 1000;

type RouteContext = { params: Promise<{ orgSlug: string; id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { orgSlug, id } = await context.params;

  let organization;
  let user;
  try {
    ({ organization, user } = await requireOrgCapability(orgSlug, canWrite));
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = rateLimit(`candidate-email:${orgSlug}:${getClientIp(request)}`, EMAIL_RATE_LIMIT, EMAIL_RATE_WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many emails sent. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const application = getApplicationDetail(id, organization.id, getJobAccess(organization.id, user));
  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  let body: { subject?: unknown; body?: unknown };
  try {
    body = (await request.json()) as { subject?: unknown; body?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!subject || !text) {
    return NextResponse.json({ error: "Subject and body are required" }, { status: 400 });
  }
  if (subject.length > 200 || text.length > 10_000) {
    return NextResponse.json({ error: "Email is too long" }, { status: 400 });
  }

  try {
    await sendCandidateEmail({
      organization,
      to: application.applicant_email,
      subject,
      body: text,
    });
  } catch (error) {
    console.error("Candidate email failed:", error);
    return NextResponse.json(
      { error: "Couldn't send the email — check the platform SMTP settings." },
      { status: 502 },
    );
  }

  recordCandidateEvent({
    organization_id: organization.id,
    application_id: id,
    type: "email_sent",
    detail: `Emailed candidate: "${subject}"`,
    actor: user.name,
  });

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { requireOrgSessionApi } from "@/lib/auth";
import { draftOutreachEmail, enrichCandidate } from "@/lib/enrichment";
import { getJobById } from "@/lib/jobs";
import { canWrite } from "@/lib/permissions";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

// Enrichment consumes paid Apollo credits; keep it modestly rate limited.
const ENRICH_RATE_LIMIT = 30;
const ENRICH_RATE_WINDOW_MS = 60 * 60 * 1000;

type RouteContext = { params: Promise<{ orgSlug: string; id: string }> };

type Body = {
  apolloId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  company?: string | null;
  linkedinUrl?: string | null;
  candidateName?: string;
  candidateTitle?: string;
  matchedSkills?: string[];
};

export async function POST(request: Request, context: RouteContext) {
  const { orgSlug, id } = await context.params;

  let organization;
  let user;
  try {
    ({ organization, user } = await requireOrgSessionApi(orgSlug));
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canWrite(user.role)) {
    return NextResponse.json({ error: "You have read-only access." }, { status: 403 });
  }

  const limit = rateLimit(`enrich:${orgSlug}:${getClientIp(request)}`, ENRICH_RATE_LIMIT, ENRICH_RATE_WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many enrichment requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const job = getJobById(id);
  if (!job || job.organization_id !== organization.id) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const enrichment = await enrichCandidate({
    apolloId: body.apolloId,
    firstName: body.firstName,
    lastName: body.lastName,
    name: body.name,
    company: body.company,
    linkedinUrl: body.linkedinUrl,
  });

  // Draft outreach regardless of enrichment outcome — it's useful even if the
  // email couldn't be revealed (the recruiter can still use it via LinkedIn).
  const outreach = await draftOutreachEmail({
    candidateName: body.candidateName || body.name || "there",
    candidateTitle: body.candidateTitle || "",
    matchedSkills: Array.isArray(body.matchedSkills) ? body.matchedSkills : [],
    job,
    organization,
    recruiterName: user.name,
  });

  return NextResponse.json({ enrichment, outreach });
}

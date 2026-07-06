import { NextResponse } from "next/server";
import { requireOrgSessionApi } from "@/lib/auth";
import { searchManatalCandidates } from "@/lib/integrations/manatal";
import { searchResumesPdl } from "@/lib/integrations/peopledatalabs";
import { getJobById } from "@/lib/jobs";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { sourceCandidates } from "@/lib/sourcing";

export const runtime = "nodejs";

// Sourcing calls a paid external API; keep it modestly rate limited per org.
const SOURCE_RATE_LIMIT = 20;
const SOURCE_RATE_WINDOW_MS = 60 * 60 * 1000;

type RouteContext = { params: Promise<{ orgSlug: string; id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { orgSlug, id } = await context.params;

  let organization;
  try {
    ({ organization } = await requireOrgSessionApi(orgSlug));
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = rateLimit(`source:${orgSlug}:${getClientIp(request)}`, SOURCE_RATE_LIMIT, SOURCE_RATE_WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many sourcing requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const job = getJobById(id);
  if (!job || job.organization_id !== organization.id) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Choose the read-only search provider: Apollo passive search (default) or the
  // People Data Labs resume database.
  const body = (await request.json().catch(() => ({}))) as { provider?: string };
  const result =
    body.provider === "pdl"
      ? await searchResumesPdl(job)
      : body.provider === "manatal"
        ? await searchManatalCandidates(job)
        : await sourceCandidates(job);
  return NextResponse.json(result);
}

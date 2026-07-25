import { NextResponse } from "next/server";
import { requireOrgSessionApi } from "@/lib/auth";
import { generateJobDescription } from "@/lib/jd-generation";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

// LLM generation can be costly; keep it modestly rate limited per org.
const GENERATE_RATE_LIMIT = 30;
const GENERATE_RATE_WINDOW_MS = 60 * 60 * 1000;

type RouteContext = { params: Promise<{ orgSlug: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { orgSlug } = await context.params;

  let organization;
  try {
    ({ organization } = await requireOrgSessionApi(orgSlug));
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = rateLimit(`generate-jd:${orgSlug}:${getClientIp(request)}`, GENERATE_RATE_LIMIT, GENERATE_RATE_WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many generation requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  let body: { title?: string; notes?: string; location?: string };
  try {
    body = (await request.json()) as { title?: string; notes?: string; location?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const title = (body.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "A job title is required to generate a description" }, { status: 400 });
  }

  const result = await generateJobDescription({
    title,
    notes: body.notes,
    location: body.location,
    companyName: organization.name,
  });

  return NextResponse.json(result);
}

import { NextResponse } from "next/server";
import { requireOrgSessionApi } from "@/lib/auth";
import { isHundredHiresConfigured } from "@/lib/env";
import { syncJobToHundredHires } from "@/lib/integrations/hundredhires";
import { getJobById } from "@/lib/jobs";
import { canWrite } from "@/lib/permissions";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ orgSlug: string; id: string }> };

/** Manually (re)push a single job to 100Hires and record the result. */
export async function POST(_request: Request, context: RouteContext) {
  const { orgSlug, id } = await context.params;

  try {
    const { organization, user } = await requireOrgSessionApi(orgSlug);
    if (!canWrite(user.role)) {
      return NextResponse.json({ ok: false, error: "You have read-only access." }, { status: 403 });
    }
    if (!isHundredHiresConfigured()) {
      return NextResponse.json(
        { ok: false, error: "100Hires isn't connected. Set HUNDREDHIRES_API_KEY to enable it." },
        { status: 400 },
      );
    }

    const job = getJobById(id);
    if (!job || job.organization_id !== organization.id) {
      return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
    }

    const result = await syncJobToHundredHires(job, organization);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    console.error("Manual 100Hires sync failed:", error);
    return NextResponse.json({ ok: false, error: "Sync failed" }, { status: 500 });
  }
}

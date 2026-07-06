import { NextResponse } from "next/server";
import { requireOrgSessionApi } from "@/lib/auth";
import { testHundredHiresConnection } from "@/lib/integrations/hundredhires";
import { canWrite } from "@/lib/permissions";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ orgSlug: string }> };

/** Validates the configured 100Hires API key against their API. */
export async function POST(_request: Request, context: RouteContext) {
  const { orgSlug } = await context.params;
  try {
    const { user } = await requireOrgSessionApi(orgSlug);
    if (!canWrite(user.role)) {
      return NextResponse.json({ ok: false, error: "You have read-only access." }, { status: 403 });
    }
    const result = await testHundredHiresConnection();
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: "Test failed" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { requireOrgSessionApi } from "@/lib/auth";
import { testHundredHiresConnection } from "@/lib/integrations/hundredhires";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ orgSlug: string }> };

/** Validates the configured 100Hires API key against their API. */
export async function POST(_request: Request, context: RouteContext) {
  const { orgSlug } = await context.params;
  try {
    await requireOrgSessionApi(orgSlug);
    const result = await testHundredHiresConnection();
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: "Test failed" }, { status: 500 });
  }
}

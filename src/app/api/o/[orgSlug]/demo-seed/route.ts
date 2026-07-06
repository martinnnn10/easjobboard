import { NextResponse } from "next/server";
import { requireOrgSessionApi } from "@/lib/auth";
import { canWrite } from "@/lib/permissions";
import { seedDemoData } from "@/lib/seed-demo";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ orgSlug: string }> };

/**
 * Loads the sales-demo dataset (2 screened jobs + 8 archetype candidates) into
 * the authenticated org. Idempotent — a second call is a no-op.
 */
export async function POST(_request: Request, context: RouteContext) {
  const { orgSlug } = await context.params;

  try {
    const { organization, user } = await requireOrgSessionApi(orgSlug);
    if (!canWrite(user.role)) {
      return NextResponse.json({ error: "You have read-only access." }, { status: 403 });
    }
    const result = seedDemoData(organization.id, organization.name);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Demo seed failed:", error);
    return NextResponse.json({ error: "Failed to load demo data" }, { status: 500 });
  }
}

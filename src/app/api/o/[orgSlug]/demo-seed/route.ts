import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/api";
import { requireOrgCapability } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { canManageTeam } from "@/lib/roles";
import { clearDemoData, seedDemoData } from "@/lib/seed-demo";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ orgSlug: string }> };

function setDemoFlag(orgId: string, isDemo: boolean) {
  getDb()
    .prepare("UPDATE organizations SET is_demo = ?, updated_at = ? WHERE id = ?")
    .run(isDemo ? 1 : 0, new Date().toISOString(), orgId);
}

/**
 * Loads or clears the labelled sample dataset. Owner-only. Seeding marks the org
 * as a demo workspace (is_demo=1) so the UI can badge it; clearing removes the
 * demo rows and the flag, converting to a clean real workspace.
 */
export async function POST(request: Request, context: RouteContext) {
  const { orgSlug } = await context.params;

  try {
    const { organization } = await requireOrgCapability(orgSlug, canManageTeam);
    const body = (await request.json().catch(() => ({}))) as { action?: string };

    if (body.action === "clear") {
      const result = clearDemoData(organization.id);
      setDemoFlag(organization.id, false);
      return NextResponse.json({ cleared: true, ...result });
    }

    const result = seedDemoData(organization.id, organization.name);
    setDemoFlag(organization.id, true);
    return NextResponse.json(result);
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return authError;
    console.error("Demo seed failed:", error);
    return NextResponse.json({ error: "Failed to update demo data" }, { status: 500 });
  }
}

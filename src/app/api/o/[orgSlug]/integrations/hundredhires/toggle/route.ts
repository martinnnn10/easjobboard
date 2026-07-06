import { NextResponse } from "next/server";
import { requireOrgSessionApi } from "@/lib/auth";
import { setOrgSyndicate100hires } from "@/lib/organizations";
import { canManageTeam } from "@/lib/permissions";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ orgSlug: string }> };

/** Enable/disable pushing this org's jobs to 100Hires (opt-in, default off). */
export async function POST(request: Request, context: RouteContext) {
  const { orgSlug } = await context.params;
  try {
    const { organization, user } = await requireOrgSessionApi(orgSlug);
    if (!canManageTeam(user.role)) {
      return NextResponse.json({ ok: false, error: "Only admins can change this." }, { status: 403 });
    }
    const body = (await request.json().catch(() => ({}))) as { enabled?: boolean };
    const updated = setOrgSyndicate100hires(organization.id, Boolean(body.enabled));
    return NextResponse.json({ ok: true, enabled: Boolean(updated?.syndicate_100hires) });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: "Failed to update" }, { status: 500 });
  }
}

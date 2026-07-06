import { NextResponse } from "next/server";
import { requireOrgSessionApi } from "@/lib/auth";
import { revokeInvite } from "@/lib/invites";
import { canManageTeam } from "@/lib/permissions";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ orgSlug: string; id: string }> };

/** Revoke a pending invitation. */
export async function POST(_request: Request, context: RouteContext) {
  const { orgSlug, id } = await context.params;
  try {
    const { organization, user } = await requireOrgSessionApi(orgSlug);
    if (!canManageTeam(user.role)) {
      return NextResponse.json({ error: "Only admins can manage invites." }, { status: 403 });
    }
    const revoked = revokeInvite(id, organization.id);
    return NextResponse.json({ ok: revoked });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to revoke" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { requireOrgSessionApi } from "@/lib/auth";
import { revokeInvite } from "@/lib/invites";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ orgSlug: string; id: string }> };

/** Revoke a pending invitation. */
export async function POST(_request: Request, context: RouteContext) {
  const { orgSlug, id } = await context.params;
  try {
    const { organization } = await requireOrgSessionApi(orgSlug);
    const revoked = revokeInvite(id, organization.id);
    return NextResponse.json({ ok: revoked });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to revoke" }, { status: 500 });
  }
}

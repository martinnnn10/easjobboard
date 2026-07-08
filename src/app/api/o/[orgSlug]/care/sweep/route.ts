import { NextResponse } from "next/server";
import { requireOrgCapability } from "@/lib/auth";
import { authErrorResponse } from "@/lib/api";
import { canManageTeam } from "@/lib/roles";
import { sweepEscalations } from "@/lib/candidate-care";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ orgSlug: string }> };

/**
 * Force the SLA escalation sweep. Owner-only. Also runs lazily on the owner
 * dashboard + Candidate Care page; expose here so a cron/Routine can drive it.
 */
export async function POST(_request: Request, context: RouteContext) {
  const { orgSlug } = await context.params;
  try {
    const { organization } = await requireOrgCapability(orgSlug, canManageTeam);
    const escalated = await sweepEscalations(organization.id);
    return NextResponse.json({ ok: true, escalated });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return authError;
    console.error("Care sweep failed:", error);
    return NextResponse.json({ error: "Sweep failed." }, { status: 500 });
  }
}

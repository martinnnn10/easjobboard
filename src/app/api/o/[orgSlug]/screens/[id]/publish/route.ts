import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/api";
import { requireOrgCapability } from "@/lib/auth";
import { canWrite } from "@/lib/roles";
import { publishScreen } from "@/lib/screen-store";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ orgSlug: string; id: string }> };

/**
 * Publish the current draft as a new immutable version. Prior versions and any
 * completed candidate results are never touched. Owner/recruiter only.
 */
export async function POST(_request: Request, context: RouteContext) {
  const { orgSlug, id } = await context.params;
  try {
    const { organization, user } = await requireOrgCapability(orgSlug, canWrite);
    const result = publishScreen(id, organization.id, user.name);
    if (!result.ok) {
      const status = result.error === "Screen not found." ? 404 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json({ screen: result.record, versionId: result.versionId }, { status: 201 });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return authError;
    console.error("Publish screen failed:", error);
    return NextResponse.json({ error: "Couldn't publish the screen." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/api";
import { requireOrgCapability } from "@/lib/auth";
import { canWrite } from "@/lib/roles";
import { duplicateScreen } from "@/lib/screen-store";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ orgSlug: string; id: string }> };

/** Duplicate a custom screen into a fresh editable draft. Owner/recruiter only. */
export async function POST(_request: Request, context: RouteContext) {
  const { orgSlug, id } = await context.params;
  try {
    const { organization, user } = await requireOrgCapability(orgSlug, canWrite);
    const record = duplicateScreen(id, organization.id, user.name);
    if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ screen: record }, { status: 201 });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return authError;
    console.error("Duplicate screen failed:", error);
    return NextResponse.json({ error: "Couldn't duplicate the screen." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/api";
import { requireOrgCapability, requireOrgSessionApi } from "@/lib/auth";
import { canWrite } from "@/lib/roles";
import { archiveScreen, getScreenRecord, restoreScreen, updateScreen } from "@/lib/screen-store";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ orgSlug: string; id: string }> };

/** Full draft (answer keys included — recruiter-facing, never public). */
export async function GET(_request: Request, context: RouteContext) {
  const { orgSlug, id } = await context.params;
  try {
    const { organization } = await requireOrgSessionApi(orgSlug);
    const record = getScreenRecord(id, organization.id);
    if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ screen: record });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return authError;
    console.error("Get screen failed:", error);
    return NextResponse.json({ error: "Couldn't load the screen." }, { status: 500 });
  }
}

/** Save draft edits (basics + definition). Owner/recruiter only. */
export async function PATCH(request: Request, context: RouteContext) {
  const { orgSlug, id } = await context.params;
  try {
    const { organization } = await requireOrgCapability(orgSlug, canWrite);
    const body = (await request.json().catch(() => ({}))) as {
      title?: string;
      category?: string;
      target_role?: string;
      description?: string;
      definition?: unknown;
      action?: string;
    };

    if (body.action === "archive") {
      const rec = archiveScreen(id, organization.id);
      if (!rec) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ screen: rec });
    }
    if (body.action === "restore") {
      const rec = restoreScreen(id, organization.id);
      if (!rec) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ screen: rec });
    }

    const record = updateScreen(id, organization.id, {
      title: body.title,
      category: body.category,
      targetRole: body.target_role,
      description: body.description,
      definition: body.definition,
    });
    if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ screen: record });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return authError;
    console.error("Update screen failed:", error);
    return NextResponse.json({ error: "Couldn't save the screen." }, { status: 500 });
  }
}

/** Archive (soft delete). Owner/recruiter only. */
export async function DELETE(_request: Request, context: RouteContext) {
  const { orgSlug, id } = await context.params;
  try {
    const { organization } = await requireOrgCapability(orgSlug, canWrite);
    const rec = archiveScreen(id, organization.id);
    if (!rec) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ screen: rec });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return authError;
    console.error("Archive screen failed:", error);
    return NextResponse.json({ error: "Couldn't archive the screen." }, { status: 500 });
  }
}

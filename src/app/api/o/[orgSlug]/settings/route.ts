import { NextResponse } from "next/server";
import { requireOrgCapability } from "@/lib/auth";
import { authErrorResponse } from "@/lib/api";
import { canManageTeam } from "@/lib/roles";
import { updateOrganization } from "@/lib/organizations";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ orgSlug: string }> };

function str(value: unknown, max = 200): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** Update org profile (owner only). */
export async function PATCH(request: Request, context: RouteContext) {
  const { orgSlug } = await context.params;

  try {
    const { organization } = await requireOrgCapability(orgSlug, canManageTeam);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const name = str(body.name, 120);
    const application_email = str(body.application_email, 200).toLowerCase();
    const website = str(body.website, 300);

    if (!name) {
      return NextResponse.json({ error: "Organization name is required." }, { status: 400 });
    }
    if (application_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(application_email)) {
      return NextResponse.json({ error: "Enter a valid careers inbox email." }, { status: 400 });
    }

    const updated = updateOrganization(organization.id, { name, application_email, website });
    return NextResponse.json({ organization: updated });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return authError;
    console.error("Update settings failed:", error);
    return NextResponse.json({ error: "Failed to save settings." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/api";
import { requireOrgSessionApi } from "@/lib/auth";
import { setOnboardingDismissed } from "@/lib/organizations";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ orgSlug: string }> };

/** Persist that the owner dismissed the first-run onboarding checklist. */
export async function POST(_request: Request, context: RouteContext) {
  const { orgSlug } = await context.params;
  try {
    const { organization } = await requireOrgSessionApi(orgSlug);
    setOnboardingDismissed(organization.id, true);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return authError;
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { updateApplicationStatus } from "@/lib/applications";
import { requireOrgCapability } from "@/lib/auth";
import { authErrorResponse } from "@/lib/api";
import { canWrite } from "@/lib/roles";
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/application-status";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ orgSlug: string; id: string }> };

function isApplicationStatus(value: unknown): value is ApplicationStatus {
  return typeof value === "string" && (APPLICATION_STATUSES as string[]).includes(value);
}

export async function PATCH(request: Request, context: RouteContext) {
  const { orgSlug, id } = await context.params;

  let organization;
  let user;
  try {
    ({ organization, user } = await requireOrgCapability(orgSlug, canWrite));
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { status?: unknown };
  try {
    body = (await request.json()) as { status?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!isApplicationStatus(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const updated = updateApplicationStatus(id, organization.id, body.status, user.name);
  if (!updated) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  return NextResponse.json({ status: updated.status });
}

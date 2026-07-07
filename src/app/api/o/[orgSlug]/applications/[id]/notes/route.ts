import { NextResponse } from "next/server";
import { getApplicationDetail } from "@/lib/applications";
import { requireOrgSessionApi } from "@/lib/auth";
import { recordCandidateEvent } from "@/lib/candidate-events";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ orgSlug: string; id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { orgSlug, id } = await context.params;

  let organization;
  let user;
  try {
    ({ organization, user } = await requireOrgSessionApi(orgSlug));
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const application = getApplicationDetail(id, organization.id);
  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  let body: { text?: unknown };
  try {
    body = (await request.json()) as { text?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "Note text is required" }, { status: 400 });
  }
  if (text.length > 5000) {
    return NextResponse.json({ error: "Note is too long (max 5000 characters)" }, { status: 400 });
  }

  recordCandidateEvent({
    organization_id: organization.id,
    application_id: id,
    type: "note",
    detail: text,
    actor: user.name,
  });

  return NextResponse.json({ ok: true });
}

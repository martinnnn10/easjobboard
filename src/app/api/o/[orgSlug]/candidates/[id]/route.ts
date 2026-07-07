import { NextResponse } from "next/server";
import { requireOrgCapability } from "@/lib/auth";
import { authErrorResponse } from "@/lib/api";
import { canWrite } from "@/lib/roles";
import { getCandidateById, setCandidateOwner, setCandidateTags } from "@/lib/candidates";
import { getUserById } from "@/lib/users";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ orgSlug: string; id: string }> };

/** Update a candidate's tags and/or owner. */
export async function PATCH(request: Request, context: RouteContext) {
  const { orgSlug, id } = await context.params;

  try {
    const { organization } = await requireOrgCapability(orgSlug, canWrite);
    const candidate = getCandidateById(id, organization.id);
    if (!candidate) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json();

    if (Array.isArray(body.tags)) {
      setCandidateTags(id, organization.id, body.tags.map((t: unknown) => String(t)));
    }

    if (typeof body.owner_user_id === "string") {
      const ownerId = body.owner_user_id.trim();
      if (ownerId) {
        const owner = getUserById(ownerId);
        if (!owner || owner.organization_id !== organization.id) {
          return NextResponse.json({ error: "That teammate isn't in this organization." }, { status: 400 });
        }
      }
      setCandidateOwner(id, organization.id, ownerId);
    }

    const updated = getCandidateById(id, organization.id);
    return NextResponse.json({ candidate: updated });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Failed to update candidate." }, { status: 500 });
  }
}

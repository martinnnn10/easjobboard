import { NextResponse } from "next/server";
import { requireOrgCapability } from "@/lib/auth";
import { authErrorResponse } from "@/lib/api";
import { canManageTeam, isRole } from "@/lib/roles";
import { countOwners, deleteUser, getUserById, revokeSessions, updateUserRole } from "@/lib/users";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ orgSlug: string; userId: string }> };

/** Change a teammate's role. Owners only; can't demote the last owner. */
export async function PATCH(request: Request, context: RouteContext) {
  const { orgSlug, userId } = await context.params;

  try {
    const { organization } = await requireOrgCapability(orgSlug, canManageTeam);
    const body = await request.json();
    const role = String(body.role ?? "");

    if (!isRole(role)) {
      return NextResponse.json({ error: "Pick a valid role." }, { status: 400 });
    }
    const target = getUserById(userId);
    if (!target || target.organization_id !== organization.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (target.role === "owner" && role !== "owner" && countOwners(organization.id) <= 1) {
      return NextResponse.json({ error: "An organization must keep at least one owner." }, { status: 400 });
    }

    updateUserRole(userId, organization.id, role);
    // A role change takes effect immediately by dropping the user's sessions.
    revokeSessions(organization.id, userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Failed to update role." }, { status: 500 });
  }
}

/** Remove a teammate. Owners only; can't remove yourself or the last owner. */
export async function DELETE(_request: Request, context: RouteContext) {
  const { orgSlug, userId } = await context.params;

  try {
    const { organization, session } = await requireOrgCapability(orgSlug, canManageTeam);

    if (userId === session.userId) {
      return NextResponse.json({ error: "You can't remove your own account." }, { status: 400 });
    }
    const target = getUserById(userId);
    if (!target || target.organization_id !== organization.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (target.role === "owner" && countOwners(organization.id) <= 1) {
      return NextResponse.json({ error: "An organization must keep at least one owner." }, { status: 400 });
    }

    deleteUser(userId, organization.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Failed to remove teammate." }, { status: 500 });
  }
}

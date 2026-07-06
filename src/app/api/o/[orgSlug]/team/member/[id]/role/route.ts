import { NextResponse } from "next/server";
import { requireOrgSessionApi } from "@/lib/auth";
import { canManageTeam, normalizeRole } from "@/lib/permissions";
import { countAdmins, getUserById, updateUserRole } from "@/lib/users";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ orgSlug: string; id: string }> };

/** Change a teammate's role. Admin-only; can't remove the last admin. */
export async function POST(request: Request, context: RouteContext) {
  const { orgSlug, id } = await context.params;
  try {
    const { organization, user } = await requireOrgSessionApi(orgSlug);
    if (!canManageTeam(user.role)) {
      return NextResponse.json({ error: "Only admins can change roles." }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as { role?: string };
    const role = normalizeRole(body.role);

    const target = getUserById(id);
    if (!target || target.organization_id !== organization.id) {
      return NextResponse.json({ error: "Member not found." }, { status: 404 });
    }

    // Never leave the org without an admin.
    if (target.role === "admin" && role !== "admin" && countAdmins(organization.id) <= 1) {
      return NextResponse.json({ error: "You need at least one admin. Promote someone else first." }, { status: 400 });
    }

    updateUserRole(id, organization.id, role);
    return NextResponse.json({ ok: true, role });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to update role" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { requireOrgCapability } from "@/lib/auth";
import { authErrorResponse } from "@/lib/api";
import { canManageTeam, isRole } from "@/lib/roles";
import { createUser, getUserByEmail, revokeSessions } from "@/lib/users";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ orgSlug: string }> };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request, context: RouteContext) {
  const { orgSlug } = await context.params;

  try {
    const { organization } = await requireOrgCapability(orgSlug, canManageTeam);
    const body = await request.json();
    const action = String(body.action ?? "");

    if (action === "revoke_all") {
      revokeSessions(organization.id);
      return NextResponse.json({ ok: true });
    }

    if (action === "add") {
      const name = String(body.name ?? "").trim();
      const email = String(body.email ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      const role = String(body.role ?? "");

      if (!name || !email || !password) {
        return NextResponse.json({ error: "Name, email, and password are required." }, { status: 400 });
      }
      if (!EMAIL_RE.test(email)) {
        return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
      }
      if (password.length < 8) {
        return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
      }
      if (!isRole(role)) {
        return NextResponse.json({ error: "Pick a valid role." }, { status: 400 });
      }
      if (getUserByEmail(email)) {
        return NextResponse.json({ error: "A user with that email already exists." }, { status: 409 });
      }

      const user = createUser({ organization_id: organization.id, name, email, password, role });
      return NextResponse.json(
        { user: { id: user.id, name: user.name, email: user.email, role: user.role } },
        { status: 201 },
      );
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Failed to update team." }, { status: 500 });
  }
}

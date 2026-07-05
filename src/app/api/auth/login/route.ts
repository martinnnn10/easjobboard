import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth";
import { getOrganizationById } from "@/lib/organizations";
import { createSessionToken } from "@/lib/session";
import { getUserByEmail, verifyUserPassword } from "@/lib/users";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; password?: string; orgSlug?: string };
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const requestedOrgSlug = body.orgSlug ? String(body.orgSlug).trim() : undefined;

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const user = getUserByEmail(email);
    if (!user || !(await verifyUserPassword(user, password))) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const organization = getOrganizationById(user.organization_id);
    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 500 });
    }

    // If the login was initiated from a specific org portal, verify the user belongs to it
    if (requestedOrgSlug && organization.slug !== requestedOrgSlug) {
      return NextResponse.json(
        { error: "This account belongs to a different organization portal" },
        { status: 403 },
      );
    }

    const token = await createSessionToken({
      userId: user.id,
      orgId: organization.id,
      orgSlug: organization.slug,
    });
    await setSessionCookie(token);

    return NextResponse.json({
      organization: {
        slug: organization.slug,
        name: organization.name,
      },
    });
  } catch (error) {
    console.error("Login failed:", error);
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }
}

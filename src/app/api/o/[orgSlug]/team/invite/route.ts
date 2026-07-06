import { NextResponse } from "next/server";
import { requireOrgSessionApi } from "@/lib/auth";
import { sendInviteEmail } from "@/lib/email";
import { getBaseUrl } from "@/lib/env";
import { createInvite } from "@/lib/invites";
import { canManageTeam, normalizeRole } from "@/lib/permissions";
import { getUserByEmail } from "@/lib/users";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ orgSlug: string }> };

/** Invite a teammate to join this organization. */
export async function POST(request: Request, context: RouteContext) {
  const { orgSlug } = await context.params;
  try {
    const { organization, user } = await requireOrgSessionApi(orgSlug);
    if (!canManageTeam(user.role)) {
      return NextResponse.json({ error: "Only admins can invite teammates." }, { status: 403 });
    }
    const body = (await request.json().catch(() => ({}))) as { email?: string; role?: string };
    const email = String(body.email ?? "").trim().toLowerCase();
    const role = normalizeRole(body.role);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    if (getUserByEmail(email)) {
      return NextResponse.json({ error: "That person already has an account." }, { status: 409 });
    }

    const invite = createInvite({ organizationId: organization.id, email, invitedBy: user.name, role });
    const inviteUrl = `${getBaseUrl()}/join/${invite.token}`;

    // Best-effort email; the admin still gets a copyable link back either way.
    void sendInviteEmail({ organization, toEmail: email, inviterName: user.name, inviteUrl }).catch((err) => {
      console.error("Invite email failed (invite still created):", err);
    });

    return NextResponse.json({ ok: true, email, inviteUrl });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Invite failed:", error);
    return NextResponse.json({ error: "Failed to send invite" }, { status: 500 });
  }
}

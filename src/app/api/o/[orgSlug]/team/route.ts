import { NextResponse } from "next/server";
import { requireOrgCapability } from "@/lib/auth";
import { authErrorResponse } from "@/lib/api";
import { sendTeamInviteEmail } from "@/lib/email";
import { getPublicBaseUrl } from "@/lib/env";
import { canManageTeam, isRole } from "@/lib/roles";
import { createUser, generateTempPassword, getUserByEmail, revokeSessions } from "@/lib/users";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ orgSlug: string }> };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function POST(request: Request, context: RouteContext) {
  const { orgSlug } = await context.params;

  try {
    const { organization, user: inviter } = await requireOrgCapability(orgSlug, canManageTeam);
    const body = await request.json();
    const action = String(body.action ?? "");

    if (action === "revoke_all") {
      revokeSessions(organization.id);
      return NextResponse.json({ ok: true });
    }

    if (action === "add") {
      const name = String(body.name ?? "").trim();
      const email = String(body.email ?? "").trim().toLowerCase();
      const providedPassword = String(body.password ?? "");
      const role = String(body.role ?? "");

      if (!name || !email) {
        return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
      }
      if (!EMAIL_RE.test(email)) {
        return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
      }
      // Password is optional — blank means auto-generate and email the invite.
      if (providedPassword && providedPassword.length < 8) {
        return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
      }
      if (!isRole(role)) {
        return NextResponse.json({ error: "Pick a valid role." }, { status: 400 });
      }
      if (getUserByEmail(email)) {
        return NextResponse.json({ error: "A user with that email already exists." }, { status: 409 });
      }

      const password = providedPassword || generateTempPassword();
      const user = createUser({ organization_id: organization.id, name, email, password, role });

      // Try to email the invite; never fail user creation if delivery is off.
      let emailed = false;
      if (smtpConfigured()) {
        try {
          await sendTeamInviteEmail({
            organization,
            to: email,
            name,
            tempPassword: password,
            loginUrl: `${getPublicBaseUrl()}/o/${orgSlug}/admin/login`,
            inviterName: inviter.name,
          });
          emailed = true;
        } catch (mailError) {
          console.error("Team invite email failed:", mailError);
        }
      }

      return NextResponse.json(
        {
          user: { id: user.id, name: user.name, email: user.email, role: user.role },
          emailed,
          // Only surface the password when we couldn't email it, so the admin can share it.
          tempPassword: emailed ? undefined : password,
        },
        { status: 201 },
      );
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Failed to update team." }, { status: 500 });
  }
}

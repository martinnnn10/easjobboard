import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth";
import { acceptInvite } from "@/lib/invites";
import { getOrganizationById } from "@/lib/organizations";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { createSessionToken } from "@/lib/session";

export const runtime = "nodejs";

const ACCEPT_RATE_LIMIT = 10;
const ACCEPT_RATE_WINDOW_MS = 60 * 60 * 1000;

/** Accept a team invitation: creates the teammate's account and signs them in. */
export async function POST(request: Request) {
  try {
    const limit = rateLimit(`accept-invite:${getClientIp(request)}`, ACCEPT_RATE_LIMIT, ACCEPT_RATE_WINDOW_MS);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
    }

    const body = (await request.json().catch(() => ({}))) as { token?: string; name?: string; password?: string };
    const result = acceptInvite({
      token: String(body.token ?? ""),
      name: String(body.name ?? ""),
      password: String(body.password ?? ""),
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const organization = getOrganizationById(result.organizationId);
    if (!organization) {
      return NextResponse.json({ error: "Organization not found." }, { status: 404 });
    }

    const token = await createSessionToken({
      userId: result.user.id,
      orgId: organization.id,
      orgSlug: organization.slug,
    });
    await setSessionCookie(token);

    return NextResponse.json({ ok: true, orgSlug: organization.slug });
  } catch (error) {
    console.error("Accept invite failed:", error);
    return NextResponse.json({ error: "Failed to accept invitation" }, { status: 500 });
  }
}

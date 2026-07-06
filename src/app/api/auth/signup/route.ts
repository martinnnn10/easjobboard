import { NextResponse } from "next/server";
import { createOrganization } from "@/lib/organizations";
import { createUser, getUserByEmail } from "@/lib/users";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { createSessionToken } from "@/lib/session";
import { setSessionCookie } from "@/lib/auth";

export const runtime = "nodejs";

// Limit org/account creation per IP to curb automated signup abuse.
const SIGNUP_RATE_LIMIT = 5;
const SIGNUP_RATE_WINDOW_MS = 60 * 60 * 1000;

export async function POST(request: Request) {
  try {
    const limit = rateLimit(`signup:${getClientIp(request)}`, SIGNUP_RATE_LIMIT, SIGNUP_RATE_WINDOW_MS);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many signups from this network. Please try again later." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
      );
    }

    const body = await request.json();
    const orgName = String(body.orgName ?? "").trim();
    const orgSlug = String(body.orgSlug ?? "").trim();
    const website = String(body.website ?? "").trim();
    const rawBrandColor = String(body.brandColor ?? "").trim();
    // Only accept a well-formed hex color; anything else falls back to default.
    const brandColor = /^#[0-9a-fA-F]{6}$/.test(rawBrandColor) ? rawBrandColor : "";
    const applicationEmail = String(body.applicationEmail ?? "").trim();
    const adminName = String(body.adminName ?? "").trim();
    const adminEmail = String(body.adminEmail ?? "").trim();
    const password = String(body.password ?? "");

    if (!orgName || !applicationEmail || !adminName || !adminEmail || !password) {
      return NextResponse.json({ error: "All required fields must be filled in" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(applicationEmail) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    if (getUserByEmail(adminEmail)) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }

    const organization = createOrganization({
      name: orgName,
      slug: orgSlug || undefined,
      website,
      application_email: applicationEmail,
      brand_color: brandColor,
    });

    const user = createUser({
      organization_id: organization.id,
      email: adminEmail,
      password,
      name: adminName,
      role: "admin", // the person who creates the org is its admin
    });

    const token = await createSessionToken({
      userId: user.id,
      orgId: organization.id,
      orgSlug: organization.slug,
    });
    await setSessionCookie(token);

    return NextResponse.json(
      {
        organization: {
          slug: organization.slug,
          name: organization.name,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Signup failed:", error);
    return NextResponse.json({ error: "Failed to create organization" }, { status: 500 });
  }
}

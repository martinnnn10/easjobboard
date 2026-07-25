import { NextResponse } from "next/server";
import { startTrialIfUnset } from "@/lib/billing";
import { getStripeConfig } from "@/lib/env";
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
    const adminName = String(body.adminName ?? "").trim();
    const adminEmail = String(body.adminEmail ?? "").trim();
    const password = String(body.password ?? "");
    const rawType = String(body.companyType ?? "").trim().toLowerCase();
    const companyType = ["employer", "agency", "other"].includes(rawType) ? rawType : "";

    // Only essentials are required at signup. Resume-delivery email, branding,
    // website, and teammates are collected later in onboarding/settings — the
    // resume inbox defaults to the admin's email so applications still deliver.
    if (!orgName || !adminName || !adminEmail || !password) {
      return NextResponse.json({ error: "All required fields must be filled in" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    if (getUserByEmail(adminEmail)) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }

    const organization = createOrganization({
      name: orgName,
      slug: orgSlug || undefined,
      website: "",
      application_email: adminEmail, // default resume inbox → owner; changeable in Settings
      brand_color: "",
      company_type: companyType,
    });

    // Every new workspace gets an honest local trial window from day one.
    startTrialIfUnset(organization.id, getStripeConfig().trialDays);

    const user = createUser({
      organization_id: organization.id,
      email: adminEmail,
      password,
      name: adminName,
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

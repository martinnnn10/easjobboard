import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/api";
import { requireOrgCapability } from "@/lib/auth";
import { isStripeConfigured } from "@/lib/env";
import { canManageTeam } from "@/lib/roles";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ orgSlug: string }> };

/** Owner opens the Stripe customer portal to manage payment, seats, or cancel. */
export async function POST(request: Request, context: RouteContext) {
  const { orgSlug } = await context.params;

  try {
    const { organization } = await requireOrgCapability(orgSlug, canManageTeam);

    if (!isStripeConfigured()) {
      return NextResponse.json({ error: "Billing isn't set up on this deployment yet." }, { status: 503 });
    }
    if (!organization.stripe_customer_id) {
      return NextResponse.json({ error: "No subscription to manage yet." }, { status: 400 });
    }

    const stripe = getStripe();
    const origin = new URL(request.url).origin;
    const session = await stripe.billingPortal.sessions.create({
      customer: organization.stripe_customer_id,
      return_url: `${origin}/o/${orgSlug}/admin/settings`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return authError;
    console.error("Portal failed:", error);
    return NextResponse.json({ error: "Couldn't open the billing portal." }, { status: 500 });
  }
}

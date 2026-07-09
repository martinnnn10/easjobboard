import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/api";
import { requireOrgCapability } from "@/lib/auth";
import { getBillingState, setStripeCustomerId } from "@/lib/billing";
import { getStripeConfig, isStripeConfigured } from "@/lib/env";
import { canManageTeam } from "@/lib/roles";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ orgSlug: string }> };

/** Owner starts a paid subscription — returns a Stripe Checkout URL to redirect to. */
export async function POST(request: Request, context: RouteContext) {
  const { orgSlug } = await context.params;

  try {
    const { organization, user } = await requireOrgCapability(orgSlug, canManageTeam);

    if (!isStripeConfigured()) {
      return NextResponse.json({ error: "Billing isn't set up on this deployment yet." }, { status: 503 });
    }

    const stripe = getStripe();
    const { priceId, trialDays } = getStripeConfig();
    const origin = new URL(request.url).origin;
    const state = getBillingState(organization);

    // Reuse the org's customer, or create one and remember it so the webhook
    // can map future events back to this org.
    let customerId = organization.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: organization.name,
        email: organization.application_email || user.email,
        metadata: { org_id: organization.id, org_slug: organization.slug },
      });
      customerId = customer.id;
      setStripeCustomerId(organization.id, customerId);
    }

    const seats = Math.max(1, state.seatsUsed);
    // Honor any remaining local trial so we don't double-charge a fresh signup.
    const trialPeriodDays = state.trialDaysLeft && state.trialDaysLeft > 0 ? state.trialDaysLeft : trialDays;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: organization.id,
      line_items: [{ price: priceId, quantity: seats }],
      subscription_data: {
        trial_period_days: trialPeriodDays > 0 ? trialPeriodDays : undefined,
        metadata: { org_id: organization.id },
      },
      allow_promotion_codes: true,
      success_url: `${origin}/o/${orgSlug}/admin/settings?billing=success`,
      cancel_url: `${origin}/o/${orgSlug}/admin/settings?billing=cancelled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return authError;
    console.error("Checkout failed:", error);
    return NextResponse.json({ error: "Couldn't start checkout." }, { status: 500 });
  }
}

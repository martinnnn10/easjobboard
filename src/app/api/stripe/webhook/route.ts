import type Stripe from "stripe";
import { findOrgByStripeCustomer, syncSubscriptionToOrg } from "@/lib/billing";
import { getStripeConfig, isStripeConfigured } from "@/lib/env";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

/**
 * Stripe webhook — the source of truth for subscription state. Verifies the
 * signature, then syncs subscription lifecycle events onto the org. Returns 200
 * quickly so Stripe doesn't retry; unknown events are acked and ignored.
 */
export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return new Response("Billing not configured", { status: 503 });
  }
  const { webhookSecret } = getStripeConfig();
  if (!webhookSecret) {
    return new Response("Webhook secret not configured", { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  const payload = await request.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(payload, signature, webhookSecret);
  } catch (error) {
    console.error("Stripe signature verification failed:", error);
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        const orgId = (sub.metadata?.org_id as string | undefined) ?? findOrgByStripeCustomer(customerId)?.id;
        if (orgId) syncSubscriptionToOrg(orgId, sub);
        break;
      }
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription) {
          const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
          const sub = await stripe.subscriptions.retrieve(subId);
          const orgId =
            (session.client_reference_id as string | undefined) ??
            (sub.metadata?.org_id as string | undefined) ??
            (typeof sub.customer === "string" ? findOrgByStripeCustomer(sub.customer)?.id : undefined);
          if (orgId) syncSubscriptionToOrg(orgId, sub);
        }
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error(`Error handling Stripe event ${event.type}:`, error);
    return new Response("Handler error", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}

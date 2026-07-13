import Stripe from "stripe";
import { getStripeConfig, isStripeConfigured } from "./env";

/**
 * Lazily-constructed Stripe client. The whole billing surface degrades
 * gracefully: if STRIPE_SECRET_KEY / STRIPE_PRICE_ID aren't set, callers check
 * isStripeConfigured() and never reach here, so a deployment without Stripe
 * still runs (orgs keep their local 14-day trial).
 */
let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (!isStripeConfigured()) {
    throw new Error("Stripe is not configured on this deployment.");
  }
  if (!client) {
    // Pin to the SDK's default pinned API version (no literal to keep in sync).
    client = new Stripe(getStripeConfig().secretKey);
  }
  return client;
}

export { isStripeConfigured };

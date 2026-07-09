/**
 * Single source of truth for launch pricing. Everything buyer-facing — the
 * homepage, signup copy, and the in-app billing panel — renders from here so a
 * price can never disagree with itself across the product.
 *
 * IMPORTANT: the displayed price is intentionally decoupled from any Stripe env
 * var (e.g. STRIPE_SEAT_PRICE_USD). The *charged* amount is whatever the Stripe
 * Price object is set to; keep the Stripe dashboard price for the active plan in
 * sync with ACTIVE_PLAN.priceUsd below. See README-DEPLOY / the deploy notes.
 */

export type PricingTier = {
  key: "starter" | "pro" | "enterprise";
  name: string;
  priceLabel: string; // what the buyer reads, e.g. "$49" or "Custom"
  priceUsd: number | null; // numeric for math; null for custom/contact-sales
  cadence: string; // "/month" or ""
  seats: string;
  tagline: string;
  features: string[];
  /** The one plan Stripe actually charges for today. */
  active: boolean;
  /** Shown as "Contact sales" instead of a self-serve checkout. */
  contactSales: boolean;
};

export const PRICING_TIERS: PricingTier[] = [
  {
    key: "starter",
    name: "Starter",
    priceLabel: "$49",
    priceUsd: 49,
    cadence: "/month",
    seats: "1 seat",
    tagline: "For a single recruiter getting started.",
    features: [
      "Basic skills screening",
      "Ranked Call Queue",
      "Resume Trap dashboard",
      "Candidate profiles",
    ],
    active: false,
    contactSales: true, // self-serve Starter checkout is coming soon
  },
  {
    key: "pro",
    name: "Pro",
    priceLabel: "$99",
    priceUsd: 99,
    cadence: "/month",
    seats: "Up to 3 seats",
    tagline: "For a hiring team that needs the full intelligence layer.",
    features: [
      "Advanced skills screening",
      "Interview kits & candidate presentations",
      "Team access & reporting",
      "Custom branding",
      "Everything in Starter",
    ],
    active: true,
    contactSales: false,
  },
  {
    key: "enterprise",
    name: "Agency / Enterprise",
    priceLabel: "Custom",
    priceUsd: null,
    cadence: "",
    seats: "Multi-seat",
    tagline: "For agencies and multi-site manufacturers.",
    features: [
      "White-labeling",
      "API access",
      "Multi-site support",
      "Priority onboarding",
    ],
    active: false,
    contactSales: true,
  },
];

/** The plan Stripe charges for right now (Pro). */
export const ACTIVE_PLAN = PRICING_TIERS.find((t) => t.active)!;

/** Canonical monthly price of the active paid plan, for display everywhere. */
export const ACTIVE_PLAN_PRICE_USD = ACTIVE_PLAN.priceUsd ?? 99;

export const TRIAL_DAYS = 14;

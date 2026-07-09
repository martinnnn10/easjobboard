/**
 * Single source of truth for launch pricing. Everything buyer-facing — the
 * homepage, signup copy, and the in-app billing panel — renders from here so a
 * price can never disagree with itself across the product.
 *
 * Pricing model (per Manus's launch plan):
 *   • Starter — $45/month per seat (the active, self-serve, Stripe-charged plan)
 *   • Pro     — $99/month for up to 3 seats (bundle)
 *   • Agency/Enterprise — custom
 *
 * SEAT_PRICE_USD is the per-seat rate Stripe actually charges today
 * (STRIPE_PRICE_ID). The billing panel bills seats × SEAT_PRICE_USD, matching
 * the live Stripe price object — keep the Stripe dashboard price at $45/seat.
 */

export const SEAT_PRICE_USD = 45;
export const TRIAL_DAYS = 14;

export type PricingTier = {
  key: "starter" | "pro" | "enterprise";
  name: string;
  priceLabel: string; // what the buyer reads, e.g. "$45" or "Custom"
  priceUsd: number | null; // numeric for math; null for custom/contact-sales
  cadence: string; // "/month per seat", "/month", or ""
  seats: string;
  tagline: string;
  features: string[];
  /** Self-serve via the 14-day trial + Stripe checkout. */
  selfServe: boolean;
  /** Highlighted as the recommended plan on the pricing grid. */
  popular: boolean;
};

export const PRICING_TIERS: PricingTier[] = [
  {
    key: "starter",
    name: "Starter",
    priceLabel: "$45",
    priceUsd: 45,
    cadence: "/month per seat",
    seats: "1 seat",
    tagline: "For a single recruiter getting started.",
    features: [
      "Basic skills screening",
      "Ranked Call Queue",
      "Resume Trap dashboard",
      "Candidate profiles",
    ],
    selfServe: true,
    popular: false,
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
    selfServe: true,
    popular: true,
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
    selfServe: false,
    popular: false,
  },
];

/** Features a paying customer gets, for the in-app billing panel. */
export const BILLING_PLAN_FEATURES = PRICING_TIERS.find((t) => t.key === "pro")!.features;

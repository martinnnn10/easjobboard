import type Stripe from "stripe";
import { getDb, type Organization } from "./db";
import { isStripeConfigured } from "./env";
import { getOrganizationById } from "./organizations";
import { ACTIVE_PLAN, ACTIVE_PLAN_PRICE_USD } from "./pricing";
import { listUsersByOrganization } from "./users";

/**
 * Billing lives in two layers:
 *  1. A local 14-day trial stamped at signup, so every org has an honest trial
 *     window even on a deployment with no Stripe keys.
 *  2. Stripe subscription state, synced in by the webhook once an org checks out.
 *
 * getBillingState() blends both into what the UI needs, and never invents a
 * number — seats-used is a real count of members.
 */

export type BillingState = {
  configured: boolean; // Stripe usable on this deployment
  status: "trialing" | "active" | "past_due" | "canceled" | "none";
  statusLabel: string;
  hasSubscription: boolean;
  trialEndsAt: string;
  trialDaysLeft: number | null;
  trialExpired: boolean;
  seatsUsed: number; // real active members
  seatsPaid: number; // quantity on the Stripe subscription
  currentPeriodEnd: string;
  seatPriceUsd: number; // canonical active-plan price (display), not the env var
  monthlyTotalUsd: number; // seatsPaid × price (0 while on trial with no sub)
  planName: string; // active paid plan name (e.g. "Pro")
  planFeatures: string[]; // what's included, for the paywall
};

function daysBetween(fromIso: string, to: Date): number | null {
  const t = Date.parse(fromIso);
  if (!Number.isFinite(t)) return null;
  return Math.ceil((t - to.getTime()) / 86_400_000);
}

const STATUS_LABELS: Record<BillingState["status"], string> = {
  trialing: "Free trial",
  active: "Active",
  past_due: "Past due",
  canceled: "Canceled",
  none: "No plan",
};

export function getBillingState(org: Organization, now: Date = new Date()): BillingState {
  // Display price comes from the canonical pricing model, never from a Stripe
  // env var — so a misconfigured deployment can't show a price that disagrees
  // with the homepage.
  const seatPriceUsd = ACTIVE_PLAN_PRICE_USD;
  const seatsUsed = listUsersByOrganization(org.id).length;

  // Normalize the stored status; Stripe's raw status wins when a sub exists.
  let status: BillingState["status"] = "trialing";
  const raw = org.subscription_status || org.billing_status;
  if (raw === "active" || raw === "trialing" || raw === "past_due" || raw === "canceled") {
    status = raw;
  } else if (raw === "incomplete" || raw === "incomplete_expired" || raw === "unpaid") {
    status = "past_due";
  } else if (org.billing_status === "none") {
    status = "none";
  }

  const trialDaysLeft = org.trial_ends_at ? daysBetween(org.trial_ends_at, now) : null;
  const trialExpired = trialDaysLeft !== null && trialDaysLeft <= 0 && !org.stripe_subscription_id;
  const seatsPaid = org.plan_seats || 0;

  return {
    configured: isStripeConfigured(),
    status,
    statusLabel: STATUS_LABELS[status],
    hasSubscription: Boolean(org.stripe_subscription_id),
    trialEndsAt: org.trial_ends_at,
    trialDaysLeft,
    trialExpired,
    seatsUsed,
    seatsPaid,
    currentPeriodEnd: org.current_period_end,
    seatPriceUsd,
    monthlyTotalUsd: seatsPaid * seatPriceUsd,
    planName: ACTIVE_PLAN.name,
    planFeatures: ACTIVE_PLAN.features,
  };
}

/** Stamp the local trial window at signup (idempotent — only sets if empty). */
export function startTrialIfUnset(orgId: string, trialDays: number, now: Date = new Date()): void {
  const db = getDb();
  const row = db.prepare("SELECT trial_ends_at FROM organizations WHERE id = ?").get(orgId) as
    | { trial_ends_at?: string }
    | undefined;
  if (row && row.trial_ends_at) return;
  const ends = new Date(now.getTime() + trialDays * 86_400_000).toISOString();
  db.prepare(
    "UPDATE organizations SET billing_status = 'trialing', trial_ends_at = ?, updated_at = ? WHERE id = ?",
  ).run(ends, now.toISOString(), orgId);
}

export function setStripeCustomerId(orgId: string, customerId: string): void {
  getDb()
    .prepare("UPDATE organizations SET stripe_customer_id = ?, updated_at = ? WHERE id = ?")
    .run(customerId, new Date().toISOString(), orgId);
}

/** Map a Stripe subscription onto the org row. Called from the webhook. */
export function syncSubscriptionToOrg(orgId: string, sub: Stripe.Subscription): void {
  const status = sub.status; // trialing | active | past_due | canceled | ...
  const seats = sub.items.data.reduce((sum, item) => sum + (item.quantity ?? 0), 0);
  const periodEndUnix = (sub as unknown as { current_period_end?: number }).current_period_end;
  const periodEnd = periodEndUnix ? new Date(periodEndUnix * 1000).toISOString() : "";
  const trialEndUnix = sub.trial_end ?? null;

  const billingStatus =
    status === "active" || status === "trialing"
      ? status
      : status === "past_due" || status === "unpaid" || status === "incomplete"
        ? "past_due"
        : status === "canceled" || status === "incomplete_expired"
          ? "canceled"
          : "none";

  const db = getDb();
  db.prepare(
    `UPDATE organizations SET
       stripe_subscription_id = ?,
       subscription_status = ?,
       billing_status = ?,
       plan_seats = ?,
       current_period_end = ?,
       trial_ends_at = CASE WHEN ? != '' THEN ? ELSE trial_ends_at END,
       updated_at = ?
     WHERE id = ?`,
  ).run(
    sub.id,
    status,
    billingStatus,
    seats,
    periodEnd,
    trialEndUnix ? new Date(trialEndUnix * 1000).toISOString() : "",
    trialEndUnix ? new Date(trialEndUnix * 1000).toISOString() : "",
    new Date().toISOString(),
    orgId,
  );
}

/** Find the org a Stripe customer belongs to (webhooks arrive by customer id). */
export function findOrgByStripeCustomer(customerId: string): Organization | null {
  const row = getDb()
    .prepare("SELECT id FROM organizations WHERE stripe_customer_id = ?")
    .get(customerId) as { id?: string } | undefined;
  return row?.id ? getOrganizationById(row.id) : null;
}

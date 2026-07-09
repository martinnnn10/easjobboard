"use client";

import { useState } from "react";

type BillingState = {
  configured: boolean;
  status: "trialing" | "active" | "past_due" | "canceled" | "none";
  statusLabel: string;
  hasSubscription: boolean;
  trialEndsAt: string;
  trialDaysLeft: number | null;
  trialExpired: boolean;
  seatsUsed: number;
  seatsPaid: number;
  currentPeriodEnd: string;
  seatPriceUsd: number;
  monthlyTotalUsd: number;
};

const STATUS_STYLE: Record<BillingState["status"], string> = {
  trialing: "bg-brand-50 text-brand-700",
  active: "bg-brand-50 text-brand-700",
  past_due: "bg-red-100 text-red-700",
  canceled: "bg-zinc-100 text-zinc-500",
  none: "bg-zinc-100 text-zinc-500",
};

function fmtDate(iso: string): string {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toLocaleDateString() : "—";
}

export function BillingPanel({
  orgSlug,
  state,
  contactEmail,
}: {
  orgSlug: string;
  state: BillingState;
  contactEmail: string;
}) {
  const [busy, setBusy] = useState<"checkout" | "portal" | null>(null);
  const [error, setError] = useState("");

  async function go(kind: "checkout" | "portal") {
    setBusy(kind);
    setError("");
    try {
      const res = await fetch(`/api/o/${orgSlug}/billing/${kind}`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setBusy(null);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Network error. Please try again.");
      setBusy(null);
    }
  }

  return (
    <section className="card space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Billing &amp; plan</h2>
          <p className="text-sm text-zinc-600">
            EAS Recruit · ${state.seatPriceUsd}/month per seat
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[state.status]}`}>
          {state.statusLabel}
        </span>
      </div>

      {/* Trial / renewal line */}
      {state.status === "trialing" && state.trialDaysLeft !== null ? (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            state.trialDaysLeft <= 3 ? "bg-amber-50 text-amber-800" : "bg-brand-50 text-brand-800"
          }`}
        >
          {state.trialDaysLeft > 0
            ? `Free trial — ${state.trialDaysLeft} day${state.trialDaysLeft === 1 ? "" : "s"} left (ends ${fmtDate(state.trialEndsAt)}).`
            : `Your free trial has ended. Add a payment method to keep your workspace active.`}
        </p>
      ) : null}
      {state.status === "active" && state.currentPeriodEnd ? (
        <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">
          Subscription active · renews {fmtDate(state.currentPeriodEnd)}.
        </p>
      ) : null}
      {state.status === "past_due" ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          Payment is past due. Update your payment method to avoid losing access.
        </p>
      ) : null}

      {/* Seat + cost grid */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 p-3">
          <p className="text-2xl font-bold text-zinc-900">{state.seatsUsed}</p>
          <p className="text-xs text-zinc-500">Active seats (members)</p>
        </div>
        <div className="rounded-lg border border-zinc-200 p-3">
          <p className="text-2xl font-bold text-zinc-900">{state.hasSubscription ? state.seatsPaid : "—"}</p>
          <p className="text-xs text-zinc-500">Paid seats</p>
        </div>
        <div className="rounded-lg border border-zinc-200 p-3">
          <p className="text-2xl font-bold text-zinc-900">
            {state.hasSubscription ? `$${state.monthlyTotalUsd}` : "—"}
          </p>
          <p className="text-xs text-zinc-500">Monthly total</p>
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {/* Actions */}
      {state.configured ? (
        <div className="flex flex-wrap gap-2">
          {state.hasSubscription ? (
            <button type="button" onClick={() => go("portal")} disabled={busy !== null} className="btn-primary text-sm">
              {busy === "portal" ? "Opening…" : "Manage billing"}
            </button>
          ) : (
            <button type="button" onClick={() => go("checkout")} disabled={busy !== null} className="btn-primary text-sm">
              {busy === "checkout" ? "Starting…" : "Add payment method"}
            </button>
          )}
          {state.hasSubscription ? null : (
            <span className="self-center text-xs text-zinc-500">
              You keep full access during your trial — add a card before it ends to stay active.
            </span>
          )}
        </div>
      ) : (
        <p className="rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
          Online billing isn&apos;t enabled on this deployment yet. You&apos;re on a{" "}
          {state.trialDaysLeft !== null && state.trialDaysLeft > 0
            ? `${state.trialDaysLeft}-day trial`
            : "trial"}
          . To set up a subscription, contact{" "}
          <a href={`mailto:${contactEmail}`} className="font-medium text-brand-700 hover:underline">
            {contactEmail}
          </a>
          .
        </p>
      )}
    </section>
  );
}

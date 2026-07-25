import Link from "next/link";
import { PRICING_TIERS } from "@/lib/pricing";

function Check() {
  return (
    <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.3 3.29 6.8-6.8a1 1 0 0 1 1.4 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** The three launch tiers, rendered from the single pricing source of truth. */
export function PricingTiers() {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {PRICING_TIERS.map((tier) => (
        <div
          key={tier.key}
          className={`card flex flex-col ${tier.popular ? "border-2 border-brand-500 shadow-md" : ""}`}
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">{tier.name}</p>
            {tier.popular ? (
              <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                Most popular
              </span>
            ) : !tier.selfServe ? (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-500">
                Contact sales
              </span>
            ) : null}
          </div>

          <p className="mt-3">
            <span className="text-4xl font-bold tracking-tight text-zinc-900">{tier.priceLabel}</span>
            {tier.cadence ? <span className="text-base font-medium text-zinc-500">{tier.cadence}</span> : null}
          </p>
          <p className="mt-1 text-sm text-zinc-600">{tier.seats}</p>
          <p className="mt-1 text-sm text-zinc-500">{tier.tagline}</p>

          <ul className="mt-4 flex-1 space-y-2">
            {tier.features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-zinc-700">
                <Check />
                <span>{f}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6">
            {tier.selfServe ? (
              <Link href="/signup" className={`w-full py-2.5 ${tier.popular ? "btn-primary" : "btn-secondary"}`}>
                Start free trial
              </Link>
            ) : (
              <Link href="/book-demo" className="btn-secondary w-full py-2.5">
                Contact sales
              </Link>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

import Link from "next/link";

/**
 * Clean, buyer-facing state shown on outbound-sourcing routes when no sourcing
 * provider is connected. Deliberately free of developer language (no env var
 * names, no "not configured" warnings): owners get a pointer to the setup in
 * Settings → Integrations; everyone else is told to contact their admin.
 */
export function SourcingUnavailable({
  orgSlug,
  canManage,
  title = "Outbound sourcing",
}: {
  orgSlug: string;
  canManage: boolean;
  title?: string;
}) {
  return (
    <div className="page-shell space-y-6">
      <div>
        <Link href={`/o/${orgSlug}/admin`} className="text-sm text-brand-700 hover:underline">
          ← Back to dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900">{title}</h1>
      </div>

      <div className="card mx-auto max-w-xl space-y-4 py-10 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden>
            <path d="M3 11l16-6-4 15-4-6-8-3z" />
            <path d="M11 14l4-4" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-zinc-900">Outbound sourcing isn&apos;t turned on yet</h2>
        <p className="mx-auto max-w-md text-sm text-zinc-600">
          Outbound sourcing lets your team search for passive candidates that match a job&apos;s required skills. It
          becomes available once your team connects a sourcing provider.
        </p>
        {canManage ? (
          <Link href={`/o/${orgSlug}/admin/settings`} className="btn-primary inline-block">
            Set up in Settings → Integrations
          </Link>
        ) : (
          <p className="text-sm font-medium text-zinc-700">Contact your admin to enable outbound sourcing.</p>
        )}
      </div>
    </div>
  );
}

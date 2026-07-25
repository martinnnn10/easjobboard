import { notFound, redirect } from "next/navigation";
import { BillingPanel } from "@/components/BillingPanel";
import { OrgSettingsForm } from "@/components/OrgSettingsForm";
import { isLlmConfigured } from "@/lib/anthropic";
import { requireOrgSession } from "@/lib/auth";
import { getBillingState } from "@/lib/billing";
import { getPlatformEmail, getPublicBaseUrl, hasConfiguredPublicDomain } from "@/lib/env";
import { getBrandColor, getOrganizationBySlug, organizationHasLogo } from "@/lib/organizations";
import { LogoUpload } from "@/components/LogoUpload";
import { canManageTeam } from "@/lib/roles";
import { isSourcingConfigured } from "@/lib/sourcing";

type PageProps = { params: Promise<{ orgSlug: string }> };

function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function StatusRow({ label, ok, okText, offText, note }: {
  label: string;
  ok: boolean;
  okText: string;
  offText: string;
  note?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-zinc-100 py-3 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-zinc-800">{label}</p>
        {note ? <p className="text-xs text-zinc-500">{note}</p> : null}
      </div>
      <span
        className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
          ok ? "bg-brand-50 text-brand-700" : "bg-zinc-100 text-zinc-500"
        }`}
      >
        {ok ? okText : offText}
      </span>
    </div>
  );
}

export default async function SettingsPage({ params }: PageProps) {
  const { orgSlug } = await params;
  const organization = getOrganizationBySlug(orgSlug);
  if (!organization) notFound();

  const { user } = await requireOrgSession(orgSlug);
  if (!canManageTeam(user.role)) {
    redirect(`/o/${orgSlug}/admin`);
  }

  const domainConfigured = hasConfiguredPublicDomain();
  const sourcingConnected = isSourcingConfigured();
  const billing = getBillingState(organization);

  return (
    <div className="page-shell max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Settings</h1>
        <p className="mt-1 text-sm text-zinc-600">Organization profile, billing, and platform configuration.</p>
      </div>

      <BillingPanel orgSlug={orgSlug} state={billing} contactEmail={getPlatformEmail()} />

      <OrgSettingsForm
        orgSlug={orgSlug}
        initial={{
          name: organization.name,
          application_email: organization.application_email,
          website: organization.website,
          organization_type: organization.organization_type,
        }}
      />

      <section className="card space-y-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Careers page logo</h2>
          <p className="text-sm text-zinc-600">Your company logo, shown on your public careers page and job posts.</p>
        </div>
        <LogoUpload
          orgSlug={orgSlug}
          hasLogo={organizationHasLogo(organization.id)}
          brandColor={getBrandColor(organization)}
          initials={organization.name
            .split(/\s+/)
            .slice(0, 2)
            .map((word) => word[0]?.toUpperCase() ?? "")
            .join("")}
        />
      </section>

      <section className="card space-y-1">
        <h2 className="text-base font-semibold text-zinc-900">Public domain</h2>
        <p className="text-sm text-zinc-600">
          The address used for your careers page, shareable job links, QR codes, and job-board feeds.
        </p>
        {domainConfigured ? (
          <p className="mt-2 rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-800">
            {getPublicBaseUrl()}
          </p>
        ) : (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            No public domain set yet. Once your careers domain is configured (e.g.{" "}
            <span className="font-medium">jobs.yourcompany.com</span>), shared links, QR codes, and job-board feeds show
            your brand instead of a server address.
          </p>
        )}
      </section>

      <section className="card">
        <h2 className="text-base font-semibold text-zinc-900">Platform status</h2>
        <p className="mb-2 text-sm text-zinc-600">Configured integrations. Skills-screen scoring works regardless.</p>
        <StatusRow
          label="AI resume matching"
          ok={isLlmConfigured()}
          okText="Enabled"
          offText="Keyword-only"
          note={
            isLlmConfigured()
              ? "Resume match scores use semantic AI analysis."
              : "Resume match scores use keyword matching. AI scoring can be enabled in your deployment configuration."
          }
        />
        <StatusRow
          label="Email delivery"
          ok={smtpConfigured()}
          okText="Configured"
          offText="Not configured"
          note={
            smtpConfigured()
              ? "Applicant confirmations and teammate invites are emailed automatically."
              : "Email delivery can be enabled in your deployment configuration to send applicant confirmations and teammate invites."
          }
        />
      </section>

      <section className="card space-y-1">
        <h2 className="text-base font-semibold text-zinc-900">Integrations</h2>
        <p className="mb-2 text-sm text-zinc-600">
          Optional add-ons that extend your workspace. These appear in the app only once connected.
        </p>
        <div className="flex items-start justify-between gap-4 border-b border-zinc-100 py-3 last:border-0">
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-800">Outbound sourcing</p>
            <p className="text-xs text-zinc-500">
              Search for passive candidates that match a job&apos;s required skills. Provider: Apollo.
            </p>
            {sourcingConnected ? (
              <p className="mt-1 text-xs text-zinc-500">Sourcing tools are available from Jobs and the Outreach worklist.</p>
            ) : (
              <p className="mt-1 text-xs text-zinc-500">Contact your admin to enable outbound sourcing.</p>
            )}
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              sourcingConnected ? "bg-brand-50 text-brand-700" : "bg-zinc-100 text-zinc-500"
            }`}
          >
            {sourcingConnected ? "Connected" : "Not connected"}
          </span>
        </div>
      </section>
    </div>
  );
}

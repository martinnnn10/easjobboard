function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getBaseUrl(): string {
  return (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function getPlatformName(): string {
  return process.env.PLATFORM_NAME ?? "EAS Recruit";
}

export function getPlatformCompany(): string {
  return process.env.PLATFORM_COMPANY ?? "Electrical Automation Services Inc";
}

export function getPlatformEmail(): string {
  return process.env.PLATFORM_EMAIL ?? "eas@eautomatedstaffing.com";
}

export function getAuthSecret(): string {
  return required("AUTH_SECRET");
}

export function getSmtpConfig() {
  return {
    host: required("SMTP_HOST"),
    port: Number(process.env.SMTP_PORT ?? "587"),
    user: required("SMTP_USER"),
    pass: required("SMTP_PASS"),
    fromEmail: process.env.FROM_EMAIL ?? required("SMTP_USER"),
    fromName: process.env.FROM_NAME ?? getPlatformName(),
  };
}

/**
 * The live, shareable canonical origin used for everything the public and
 * search engines see — job page canonical/OG URLs, JobPosting JSON-LD, the
 * sitemap, robots, careers links, feeds, flyers, and QR codes.
 *
 * Guarantees a real HTTPS domain: a configured PUBLIC_BASE_URL / NEXT_PUBLIC_APP_URL
 * is used only when it's a genuine shareable domain; anything else (unset, a
 * localhost/dev URL, a bare IP, or a value with no dot) falls back to the
 * production domain so a public page can never emit localhost, a raw IP, or a
 * port number.
 */
const CANONICAL_BASE_URL = "https://easrecruit.ai";

export function getPublicBaseUrl(): string {
  const configured = process.env.PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (configured) {
    try {
      const host = new URL(configured).hostname;
      const isLocal = !host || host === "localhost" || host.endsWith(".local");
      const isBareIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
      if (!isLocal && !isBareIp && host.includes(".")) {
        return configured.replace(/\/$/, "");
      }
    } catch {
      // fall through to the canonical default
    }
  }
  return CANONICAL_BASE_URL;
}

/**
 * True only when the public origin is a real, shareable domain — not a raw IP
 * (e.g. 34.x.x.x), not localhost, and not the dev default. Used to decide
 * whether to display live links or a "set your domain" placeholder.
 */
export function hasConfiguredPublicDomain(): boolean {
  const configured = process.env.PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (!configured) return false;
  let host: string;
  try {
    host = new URL(configured).hostname;
  } catch {
    return false;
  }
  if (!host || host === "localhost" || host.endsWith(".local")) return false;
  // Bare IPv4 address → not a shareable domain.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
  // Must look like a real domain (has a dot, e.g. jobs.example.com).
  return host.includes(".");
}

/** Stripe billing config. Absent keys ⇒ billing runs in "not configured" mode. */
export function getStripeConfig() {
  return {
    secretKey: process.env.STRIPE_SECRET_KEY ?? "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
    priceId: process.env.STRIPE_PRICE_ID ?? "",
    // Monthly per-seat price shown in the UI; keep in sync with the Stripe price.
    seatPriceUsd: Number(process.env.STRIPE_SEAT_PRICE_USD ?? "99"),
    trialDays: Number(process.env.STRIPE_TRIAL_DAYS ?? "14"),
  };
}

/** True only when Stripe can actually transact (secret key + a price to sell). */
export function isStripeConfigured(): boolean {
  const { secretKey, priceId } = getStripeConfig();
  return Boolean(secretKey && priceId);
}

// Public/shareable URLs use the canonical origin so search engines, printed
// flyers, QR codes, and syndication feeds never emit localhost, a raw IP, or a
// port. Only the admin URL stays on BASE_URL (internal navigation).
export function getOrgUrl(orgSlug: string): string {
  return `${getPublicBaseUrl()}/o/${orgSlug}`;
}

export function getOrgJobUrl(orgSlug: string, jobSlug: string): string {
  return `${getPublicBaseUrl()}/o/${orgSlug}/jobs/${jobSlug}`;
}

export function getOrgAdminUrl(orgSlug: string): string {
  return `${getBaseUrl()}/o/${orgSlug}/admin`;
}

export function getOrgIndeedFeedUrl(orgSlug: string): string {
  return `${getPublicBaseUrl()}/o/${orgSlug}/feed/indeed.xml`;
}

export function getOrgXmlFeedUrl(orgSlug: string): string {
  return `${getPublicBaseUrl()}/o/${orgSlug}/feed/jobs.xml`;
}

export function getOrgJsonFeedUrl(orgSlug: string): string {
  return `${getPublicBaseUrl()}/o/${orgSlug}/feed/jobs.json`;
}

export function getOrgSitemapUrl(orgSlug: string): string {
  return `${getPublicBaseUrl()}/o/${orgSlug}/sitemap.xml`;
}

export function getOrgEmbedScriptUrl(orgSlug: string): string {
  return `${getPublicBaseUrl()}/o/${orgSlug}/embed.js`;
}

export function getJobQrUrl(orgSlug: string, jobSlug: string): string {
  return `${getPublicBaseUrl()}/o/${orgSlug}/jobs/${jobSlug}/qr.svg`;
}

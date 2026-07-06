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

/**
 * Optional path to a brand logo image (e.g. "/logo.svg" or "/logo.png") placed
 * in /public. When set, the header/footer show it in place of the built-in
 * emblem. Empty by default so the bundled emblem is used.
 */
export function getPlatformLogo(): string {
  return process.env.PLATFORM_LOGO_SRC ?? "";
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

export function getOrgUrl(orgSlug: string): string {
  return `${getBaseUrl()}/o/${orgSlug}`;
}

export function getOrgJobUrl(orgSlug: string, jobSlug: string): string {
  return `${getBaseUrl()}/o/${orgSlug}/jobs/${jobSlug}`;
}

export function getOrgAdminUrl(orgSlug: string): string {
  return `${getBaseUrl()}/o/${orgSlug}/admin`;
}

export function getOrgIndeedFeedUrl(orgSlug: string): string {
  return `${getBaseUrl()}/o/${orgSlug}/feed/indeed.xml`;
}

export function getOrgXmlFeedUrl(orgSlug: string): string {
  return `${getBaseUrl()}/o/${orgSlug}/feed/jobs.xml`;
}

export function getOrgJsonFeedUrl(orgSlug: string): string {
  return `${getBaseUrl()}/o/${orgSlug}/feed/jobs.json`;
}

export function getOrgSitemapUrl(orgSlug: string): string {
  return `${getBaseUrl()}/o/${orgSlug}/sitemap.xml`;
}

export function getOrgEmbedScriptUrl(orgSlug: string): string {
  return `${getBaseUrl()}/o/${orgSlug}/embed.js`;
}

export function getJobQrUrl(orgSlug: string, jobSlug: string): string {
  return `${getBaseUrl()}/o/${orgSlug}/jobs/${jobSlug}/qr.svg`;
}

/**
 * 100Hires distribution config. The API key is read only from the environment
 * (never committed). Base URL and jobs path are overridable so the endpoint can
 * be corrected without a code change if the API shape differs.
 */
export function getHundredHiresConfig() {
  const apiKey = process.env.HUNDREDHIRES_API_KEY ?? "";
  return {
    apiKey,
    enabled: Boolean(apiKey),
    baseUrl: (process.env.HUNDREDHIRES_BASE_URL ?? "https://api.100hires.com/v2").replace(/\/$/, ""),
    jobsPath: process.env.HUNDREDHIRES_JOBS_PATH ?? "/jobs",
  };
}

export function isHundredHiresConfigured(): boolean {
  return Boolean(process.env.HUNDREDHIRES_API_KEY);
}

/**
 * People Data Labs (resume/candidate database) config. Read-only candidate
 * search, dormant until PDL_API_KEY is set. Key is read only from the
 * environment; base URL is overridable for testing.
 */
export function getPdlConfig() {
  const apiKey = process.env.PDL_API_KEY ?? "";
  return {
    apiKey,
    enabled: Boolean(apiKey),
    baseUrl: (process.env.PDL_BASE_URL ?? "https://api.peopledatalabs.com/v5").replace(/\/$/, ""),
  };
}

export function isPdlConfigured(): boolean {
  return Boolean(process.env.PDL_API_KEY);
}

/**
 * Manatal ATS config. Searches the org's own Manatal candidate database
 * (read-only). Dormant until MANATAL_API_KEY is set; key read only from the
 * environment; base URL overridable for testing.
 */
export function getManatalConfig() {
  const apiKey = process.env.MANATAL_API_KEY ?? "";
  return {
    apiKey,
    enabled: Boolean(apiKey),
    baseUrl: (process.env.MANATAL_BASE_URL ?? "https://api.manatal.com/open/v3").replace(/\/$/, ""),
  };
}

export function isManatalConfigured(): boolean {
  return Boolean(process.env.MANATAL_API_KEY);
}

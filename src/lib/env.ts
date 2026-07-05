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

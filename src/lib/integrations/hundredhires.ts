import { getHundredHiresConfig, getOrgJobUrl } from "../env";
import type { Job, Organization } from "../db";
import { upsertSyndication } from "../syndications";

/**
 * 100Hires job distribution (push API).
 *
 * Pushes published jobs to 100Hires via their REST v2 API (Bearer auth). The
 * apply URL points back at this platform's job page on purpose, so applicants
 * who come from 100Hires still flow through the skills screen and get scored.
 *
 * The exact create-job field names are validated by 100Hires; this maps to a
 * conventional camelCase shape and surfaces 100Hires' own error text when a
 * field is wrong, so a mismatch is diagnosable rather than silent. Base URL and
 * path are env-overridable (HUNDREDHIRES_BASE_URL / HUNDREDHIRES_JOBS_PATH).
 */

export const HUNDREDHIRES_CHANNEL = "100hires";

const EMPLOYMENT_TYPE_MAP: Record<string, string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  CONTRACT: "Contract",
  TEMPORARY: "Temporary",
  INTERN: "Internship",
};

const TIMEOUT_MS = 15000;

export type PushResult = {
  ok: boolean;
  status: "posted" | "error" | "skipped";
  externalId?: string;
  url?: string;
  error?: string;
};

function buildJobPayload(job: Job, organization: Organization, applyUrl: string): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    title: job.title,
    description: job.description,
    location: job.location,
    city: job.city || undefined,
    state: job.state || undefined,
    country: job.country || undefined,
    zipCode: job.zip || undefined,
    employmentType: EMPLOYMENT_TYPE_MAP[job.employment_type] ?? job.employment_type,
    remote: /remote/i.test(job.location),
    companyName: job.company_name || organization.name,
    applyUrl,
    referenceId: job.reference_number || undefined,
  };
  if (job.salary_min != null) payload.salaryMin = job.salary_min;
  if (job.salary_max != null) payload.salaryMax = job.salary_max;
  if (job.salary_min != null || job.salary_max != null) {
    payload.salaryCurrency = job.salary_currency;
    payload.salaryPeriod = job.salary_period;
  }
  // Drop undefined keys so we don't send nulls a strict validator may reject.
  return Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined));
}

function extractError(data: unknown, fallbackText: string): string {
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (typeof obj.message === "string") return obj.message;
    if (typeof obj.error === "string") return obj.error;
    if (obj.errors) return JSON.stringify(obj.errors).slice(0, 300);
  }
  return fallbackText.slice(0, 300) || "Unknown error";
}

async function requestJson(
  url: string,
  init: RequestInit,
): Promise<{ ok: boolean; httpStatus: number; data: unknown; text: string; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const text = await res.text();
    let data: unknown = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {};
    }
    return { ok: res.ok, httpStatus: res.status, data, text };
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "Request timed out"
        : error instanceof Error
          ? error.message
          : String(error);
    return { ok: false, httpStatus: 0, data: {}, text: "", error: message };
  } finally {
    clearTimeout(timer);
  }
}

/** POSTs a single job to 100Hires. Does not touch the database. */
export async function postJobToHundredHires(
  job: Job,
  organization: Organization,
  applyUrl: string,
): Promise<PushResult> {
  const cfg = getHundredHiresConfig();
  if (!cfg.enabled) {
    return { ok: false, status: "skipped", error: "100Hires API key not configured (set HUNDREDHIRES_API_KEY)." };
  }

  const result = await requestJson(`${cfg.baseUrl}${cfg.jobsPath}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(buildJobPayload(job, organization, applyUrl)),
  });

  if (result.error && result.httpStatus === 0) {
    return { ok: false, status: "error", error: result.error };
  }
  if (!result.ok) {
    return { ok: false, status: "error", error: `HTTP ${result.httpStatus}: ${extractError(result.data, result.text)}` };
  }

  const data = (result.data ?? {}) as Record<string, unknown>;
  const nested = (data.data ?? {}) as Record<string, unknown>;
  const externalId = String(data.id ?? data.jobId ?? nested.id ?? "");
  const url = String(data.url ?? data.publicUrl ?? data.applyUrl ?? nested.url ?? "");
  return { ok: true, status: "posted", externalId, url };
}

/** Pushes a job to 100Hires and records the result in job_syndications. */
export async function syncJobToHundredHires(job: Job, organization: Organization): Promise<PushResult> {
  const applyUrl = getOrgJobUrl(organization.slug, job.slug);
  const result = await postJobToHundredHires(job, organization, applyUrl);
  if (result.status !== "skipped") {
    upsertSyndication({
      organizationId: organization.id,
      jobId: job.id,
      channel: HUNDREDHIRES_CHANNEL,
      externalId: result.externalId,
      status: result.ok ? "posted" : "error",
      url: result.url,
      error: result.ok ? "" : result.error,
    });
  }
  return result;
}

/** Validates the API key by hitting a lightweight read endpoint. */
export async function testHundredHiresConnection(): Promise<{ ok: boolean; error?: string }> {
  const cfg = getHundredHiresConfig();
  if (!cfg.enabled) return { ok: false, error: "100Hires API key not configured (set HUNDREDHIRES_API_KEY)." };

  const result = await requestJson(`${cfg.baseUrl}${cfg.jobsPath}?limit=1`, {
    method: "GET",
    headers: { Authorization: `Bearer ${cfg.apiKey}`, Accept: "application/json" },
  });
  if (result.error && result.httpStatus === 0) return { ok: false, error: result.error };
  if (!result.ok) return { ok: false, error: `HTTP ${result.httpStatus}: ${extractError(result.data, result.text)}` };
  return { ok: true };
}

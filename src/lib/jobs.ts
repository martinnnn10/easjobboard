import { randomUUID } from "crypto";
import { getOrgJobUrl } from "./env";
import { getDb, rowToJob, type Job, type JobInput, type JobStatus } from "./db";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function uniqueSlug(organizationId: string, base: string): string {
  const database = getDb();
  let slug = slugify(base);
  if (!slug) slug = "job";
  let candidate = slug;
  let counter = 1;

  while (
    database
      .prepare("SELECT 1 FROM jobs WHERE organization_id = ? AND slug = ?")
      .get(organizationId, candidate)
  ) {
    candidate = `${slug}-${counter}`;
    counter += 1;
  }

  return candidate;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function listJobsByOrganization(organizationId: string, status?: JobStatus): Job[] {
  const database = getDb();
  if (status) {
    return database
      .prepare(
        "SELECT * FROM jobs WHERE organization_id = ? AND status = ? ORDER BY published_at DESC, created_at DESC",
      )
      .all(organizationId, status)
      .map((row) => rowToJob(row as Record<string, unknown>));
  }

  return database
    .prepare("SELECT * FROM jobs WHERE organization_id = ? ORDER BY created_at DESC")
    .all(organizationId)
    .map((row) => rowToJob(row as Record<string, unknown>));
}

export function getJobById(id: string): Job | null {
  const row = getDb().prepare("SELECT * FROM jobs WHERE id = ?").get(id);
  return row ? rowToJob(row as Record<string, unknown>) : null;
}

export function getJobByOrgAndSlug(organizationId: string, slug: string): Job | null {
  const row = getDb()
    .prepare("SELECT * FROM jobs WHERE organization_id = ? AND slug = ?")
    .get(organizationId, slug);
  return row ? rowToJob(row as Record<string, unknown>) : null;
}

export function getPublishedJobsByOrganization(organizationId: string): Job[] {
  return listJobsByOrganization(organizationId, "published");
}

export function createJob(
  organizationId: string,
  companyName: string,
  input: Partial<JobInput> & Pick<JobInput, "title" | "description" | "location">,
): Job {
  const database = getDb();
  const id = randomUUID();
  const timestamp = nowIso();
  const referenceNumber = input.reference_number?.trim() || `JOB-${Date.now()}`;
  const slug = uniqueSlug(organizationId, input.slug ?? `${input.title}-${referenceNumber}`);

  database
    .prepare(
      `INSERT INTO jobs (
        id, organization_id, slug, title, description, location, city, state, country, zip,
        employment_type, salary_min, salary_max, salary_currency, salary_period,
        company_name, reference_number, status, screen_key, created_at, updated_at, published_at, closed_at
      ) VALUES (
        @id, @organization_id, @slug, @title, @description, @location, @city, @state, @country, @zip,
        @employment_type, @salary_min, @salary_max, @salary_currency, @salary_period,
        @company_name, @reference_number, @status, @screen_key, @created_at, @updated_at, @published_at, @closed_at
      )`,
    )
    .run({
      id,
      organization_id: organizationId,
      slug,
      title: input.title.trim(),
      description: input.description.trim(),
      location: input.location.trim(),
      city: input.city?.trim() ?? "",
      state: input.state?.trim() ?? "",
      country: input.country?.trim() ?? "US",
      zip: input.zip?.trim() ?? "",
      employment_type: input.employment_type ?? "FULL_TIME",
      salary_min: input.salary_min ?? null,
      salary_max: input.salary_max ?? null,
      salary_currency: input.salary_currency ?? "USD",
      salary_period: input.salary_period ?? "YEAR",
      company_name: (input.company_name?.trim() || companyName).trim(),
      reference_number: referenceNumber,
      status: input.status ?? "draft",
      screen_key: input.screen_key?.trim() ?? "",
      created_at: timestamp,
      updated_at: timestamp,
      published_at: input.status === "published" ? timestamp : null,
      closed_at: null,
    });

  return getJobById(id)!;
}

export function updateJob(id: string, organizationId: string, input: Partial<JobInput>): Job | null {
  const existing = getJobById(id);
  if (!existing || existing.organization_id !== organizationId) return null;

  const database = getDb();
  const timestamp = nowIso();
  const nextStatus = input.status ?? existing.status;
  let publishedAt = existing.published_at;
  let closedAt = existing.closed_at;

  if (nextStatus === "published" && existing.status !== "published") {
    publishedAt = timestamp;
    closedAt = null;
  } else if (nextStatus === "closed" && existing.status !== "closed") {
    closedAt = timestamp;
  } else if (nextStatus === "draft") {
    publishedAt = null;
    closedAt = null;
  }

  database
    .prepare(
      `UPDATE jobs SET
        title = @title,
        description = @description,
        location = @location,
        city = @city,
        state = @state,
        country = @country,
        zip = @zip,
        employment_type = @employment_type,
        salary_min = @salary_min,
        salary_max = @salary_max,
        salary_currency = @salary_currency,
        salary_period = @salary_period,
        company_name = @company_name,
        reference_number = @reference_number,
        status = @status,
        screen_key = @screen_key,
        updated_at = @updated_at,
        published_at = @published_at,
        closed_at = @closed_at
      WHERE id = @id AND organization_id = @organization_id`,
    )
    .run({
      id,
      organization_id: organizationId,
      title: (input.title ?? existing.title).trim(),
      description: (input.description ?? existing.description).trim(),
      location: (input.location ?? existing.location).trim(),
      city: (input.city ?? existing.city).trim(),
      state: (input.state ?? existing.state).trim(),
      country: (input.country ?? existing.country).trim(),
      zip: (input.zip ?? existing.zip).trim(),
      employment_type: input.employment_type ?? existing.employment_type,
      salary_min: input.salary_min !== undefined ? input.salary_min : existing.salary_min,
      salary_max: input.salary_max !== undefined ? input.salary_max : existing.salary_max,
      salary_currency: input.salary_currency ?? existing.salary_currency,
      salary_period: input.salary_period ?? existing.salary_period,
      company_name: (input.company_name ?? existing.company_name).trim(),
      reference_number: (input.reference_number ?? existing.reference_number).trim(),
      status: nextStatus,
      screen_key: input.screen_key !== undefined ? input.screen_key.trim() : existing.screen_key,
      updated_at: timestamp,
      published_at: publishedAt,
      closed_at: closedAt,
    });

  return getJobById(id);
}

export function deleteJob(id: string, organizationId: string): boolean {
  const result = getDb()
    .prepare("DELETE FROM jobs WHERE id = ? AND organization_id = ?")
    .run(id, organizationId);
  return result.changes > 0;
}

export function getJobPublicUrl(orgSlug: string, jobSlug: string): string {
  return getOrgJobUrl(orgSlug, jobSlug);
}

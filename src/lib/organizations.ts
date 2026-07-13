import { randomUUID } from "crypto";
import { getDb, rowToOrganization, type Organization } from "./db";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function uniqueOrgSlug(base: string): string {
  const database = getDb();
  let slug = slugify(base);
  if (!slug) slug = "organization";
  let candidate = slug;
  let counter = 1;

  while (database.prepare("SELECT 1 FROM organizations WHERE slug = ?").get(candidate)) {
    candidate = `${slug}-${counter}`;
    counter += 1;
  }

  return candidate;
}

function nowIso(): string {
  return new Date().toISOString();
}

const DEFAULT_BRAND_COLOR = "#2563eb";

/** The org's brand color, falling back to the platform default blue. */
export function getBrandColor(organization: Organization): string {
  return /^#[0-9a-fA-F]{6}$/.test(organization.brand_color)
    ? organization.brand_color
    : DEFAULT_BRAND_COLOR;
}

export function getOrganizationById(id: string): Organization | null {
  const row = getDb().prepare("SELECT * FROM organizations WHERE id = ?").get(id);
  return row ? rowToOrganization(row as Record<string, unknown>) : null;
}

export function getOrganizationBySlug(slug: string): Organization | null {
  const row = getDb().prepare("SELECT * FROM organizations WHERE slug = ?").get(slug);
  return row ? rowToOrganization(row as Record<string, unknown>) : null;
}

/**
 * Real (non-demo) organizations, for public surfaces like the root sitemap.
 * Demo/sample workspaces are excluded so private demo pages never get indexed.
 */
export function listPublicOrganizations(): Organization[] {
  const rows = getDb()
    .prepare("SELECT * FROM organizations WHERE COALESCE(is_demo, 0) = 0 ORDER BY created_at ASC")
    .all() as Array<Record<string, unknown>>;
  return rows.map(rowToOrganization);
}

export function createOrganization(input: {
  name: string;
  slug?: string;
  website?: string;
  application_email: string;
  brand_color?: string;
  company_type?: string;
  is_demo?: boolean;
}): Organization {
  const database = getDb();
  const id = randomUUID();
  const timestamp = nowIso();
  const slug = input.slug?.trim() ? uniqueOrgSlug(input.slug) : uniqueOrgSlug(input.name);

  database
    .prepare(
      `INSERT INTO organizations (id, slug, name, website, application_email, brand_color, company_type, is_demo, created_at, updated_at)
       VALUES (@id, @slug, @name, @website, @application_email, @brand_color, @company_type, @is_demo, @created_at, @updated_at)`,
    )
    .run({
      id,
      slug,
      name: input.name.trim(),
      website: input.website?.trim() ?? "",
      application_email: input.application_email.trim(),
      brand_color: input.brand_color?.trim() ?? "",
      company_type: input.company_type?.trim() ?? "",
      is_demo: input.is_demo ? 1 : 0,
      created_at: timestamp,
      updated_at: timestamp,
    });

  return getOrganizationById(id)!;
}

/** Mark the onboarding checklist dismissed (or re-shown) for an org. */
export function setOnboardingDismissed(id: string, dismissed: boolean): void {
  getDb()
    .prepare("UPDATE organizations SET onboarding_dismissed = ?, updated_at = ? WHERE id = ?")
    .run(dismissed ? 1 : 0, nowIso(), id);
}

export function updateOrganization(
  id: string,
  input: Partial<Pick<Organization, "name" | "website" | "application_email">>,
): Organization | null {
  const existing = getOrganizationById(id);
  if (!existing) return null;

  getDb()
    .prepare(
      `UPDATE organizations SET
        name = @name,
        website = @website,
        application_email = @application_email,
        updated_at = @updated_at
      WHERE id = @id`,
    )
    .run({
      id,
      name: (input.name ?? existing.name).trim(),
      website: (input.website ?? existing.website).trim(),
      application_email: (input.application_email ?? existing.application_email).trim(),
      updated_at: nowIso(),
    });

  return getOrganizationById(id);
}

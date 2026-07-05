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

export function getOrganizationById(id: string): Organization | null {
  const row = getDb().prepare("SELECT * FROM organizations WHERE id = ?").get(id);
  return row ? rowToOrganization(row as Record<string, unknown>) : null;
}

export function getOrganizationBySlug(slug: string): Organization | null {
  const row = getDb().prepare("SELECT * FROM organizations WHERE slug = ?").get(slug);
  return row ? rowToOrganization(row as Record<string, unknown>) : null;
}

export function createOrganization(input: {
  name: string;
  slug?: string;
  website?: string;
  application_email: string;
}): Organization {
  const database = getDb();
  const id = randomUUID();
  const timestamp = nowIso();
  const slug = input.slug?.trim() ? uniqueOrgSlug(input.slug) : uniqueOrgSlug(input.name);

  database
    .prepare(
      `INSERT INTO organizations (id, slug, name, website, application_email, created_at, updated_at)
       VALUES (@id, @slug, @name, @website, @application_email, @created_at, @updated_at)`,
    )
    .run({
      id,
      slug,
      name: input.name.trim(),
      website: input.website?.trim() ?? "",
      application_email: input.application_email.trim(),
      created_at: timestamp,
      updated_at: timestamp,
    });

  return getOrganizationById(id)!;
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

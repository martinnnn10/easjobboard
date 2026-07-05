import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

export type JobStatus = "draft" | "published" | "closed";

export type ApplicationStatus =
  | "new"
  | "screening"
  | "interview"
  | "offer"
  | "hired"
  | "rejected";

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  "new",
  "screening",
  "interview",
  "offer",
  "hired",
  "rejected",
];

export type Organization = {
  id: string;
  slug: string;
  name: string;
  website: string;
  application_email: string;
  created_at: string;
  updated_at: string;
};

export type User = {
  id: string;
  organization_id: string;
  email: string;
  password_hash: string;
  name: string;
  created_at: string;
};

export type Job = {
  id: string;
  organization_id: string;
  slug: string;
  title: string;
  description: string;
  location: string;
  city: string;
  state: string;
  country: string;
  zip: string;
  employment_type: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  salary_period: string;
  company_name: string;
  reference_number: string;
  status: JobStatus;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  closed_at: string | null;
};

export type Application = {
  id: string;
  organization_id: string;
  job_id: string;
  applicant_name: string;
  applicant_email: string;
  applicant_phone: string;
  cover_letter: string;
  resume_filename: string;
  resume_content_type: string;
  status: ApplicationStatus;
  created_at: string;
};

export type JobInput = Omit<
  Job,
  "id" | "slug" | "created_at" | "updated_at" | "published_at" | "closed_at"
> & {
  slug?: string;
};

let db: Database.Database | null = null;

function getDbPath(): string {
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return path.join(dataDir, "jobs.db");
}

function tableExists(database: Database.Database, name: string): boolean {
  const row = database
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(name);
  return Boolean(row);
}

function columnExists(database: Database.Database, table: string, column: string): boolean {
  const columns = database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return columns.some((entry) => entry.name === column);
}

function migrateLegacyJobs(database: Database.Database): void {
  if (!tableExists(database, "jobs") || columnExists(database, "jobs", "organization_id")) {
    return;
  }

  database.exec(`
    CREATE TABLE jobs_migrated (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      slug TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      location TEXT NOT NULL,
      city TEXT NOT NULL DEFAULT '',
      state TEXT NOT NULL DEFAULT '',
      country TEXT NOT NULL DEFAULT 'US',
      zip TEXT NOT NULL DEFAULT '',
      employment_type TEXT NOT NULL DEFAULT 'FULL_TIME',
      salary_min INTEGER,
      salary_max INTEGER,
      salary_currency TEXT NOT NULL DEFAULT 'USD',
      salary_period TEXT NOT NULL DEFAULT 'YEAR',
      company_name TEXT NOT NULL,
      reference_number TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      published_at TEXT,
      closed_at TEXT,
      UNIQUE(organization_id, slug),
      UNIQUE(organization_id, reference_number),
      FOREIGN KEY (organization_id) REFERENCES organizations(id)
    );
  `);

  const legacyOrgId = "legacy-default-org";
  const timestamp = new Date().toISOString();

  database
    .prepare(
      `INSERT OR IGNORE INTO organizations (id, slug, name, website, application_email, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      legacyOrgId,
      "legacy-org",
      "Legacy Organization",
      "",
      process.env.PLATFORM_EMAIL ?? "eas@eautomatedstaffing.com",
      timestamp,
      timestamp,
    );

  database.exec(`
    INSERT INTO jobs_migrated (
      id, organization_id, slug, title, description, location, city, state, country, zip,
      employment_type, salary_min, salary_max, salary_currency, salary_period,
      company_name, reference_number, status, created_at, updated_at, published_at, closed_at
    )
    SELECT
      id, '${legacyOrgId}', slug, title, description, location, city, state, country, zip,
      employment_type, salary_min, salary_max, salary_currency, salary_period,
      company_name, reference_number, status, created_at, updated_at, published_at, closed_at
    FROM jobs;
  `);

  database.exec("DROP TABLE jobs;");
  database.exec("ALTER TABLE jobs_migrated RENAME TO jobs;");
}

function initDb(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      website TEXT NOT NULL DEFAULT '',
      application_email TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (organization_id) REFERENCES organizations(id)
    );

    CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);
  `);

  migrateLegacyJobs(database);

  if (!tableExists(database, "jobs")) {
    database.exec(`
      CREATE TABLE jobs (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        slug TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        location TEXT NOT NULL,
        city TEXT NOT NULL DEFAULT '',
        state TEXT NOT NULL DEFAULT '',
        country TEXT NOT NULL DEFAULT 'US',
        zip TEXT NOT NULL DEFAULT '',
        employment_type TEXT NOT NULL DEFAULT 'FULL_TIME',
        salary_min INTEGER,
        salary_max INTEGER,
        salary_currency TEXT NOT NULL DEFAULT 'USD',
        salary_period TEXT NOT NULL DEFAULT 'YEAR',
        company_name TEXT NOT NULL,
        reference_number TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        published_at TEXT,
        closed_at TEXT,
        UNIQUE(organization_id, slug),
        UNIQUE(organization_id, reference_number),
        FOREIGN KEY (organization_id) REFERENCES organizations(id)
      );

      CREATE INDEX IF NOT EXISTS idx_jobs_org ON jobs(organization_id);
      CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
    `);
  }

  database.exec(`
    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      job_id TEXT NOT NULL,
      applicant_name TEXT NOT NULL,
      applicant_email TEXT NOT NULL,
      applicant_phone TEXT NOT NULL DEFAULT '',
      cover_letter TEXT NOT NULL DEFAULT '',
      resume_filename TEXT NOT NULL,
      resume_content_type TEXT NOT NULL,
      resume_data BLOB NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TEXT NOT NULL,
      FOREIGN KEY (organization_id) REFERENCES organizations(id),
      FOREIGN KEY (job_id) REFERENCES jobs(id)
    );

    CREATE INDEX IF NOT EXISTS idx_applications_org ON applications(organization_id);
    CREATE INDEX IF NOT EXISTS idx_applications_job ON applications(job_id);
  `);

  // Migration: add the pipeline status column to databases created before it existed.
  if (!columnExists(database, "applications", "status")) {
    database.exec("ALTER TABLE applications ADD COLUMN status TEXT NOT NULL DEFAULT 'new'");
  }
  database.exec("CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status)");
}

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(getDbPath());
    db.pragma("journal_mode = WAL");
    initDb(db);
  }
  return db;
}

export function rowToOrganization(row: Record<string, unknown>): Organization {
  return {
    id: row.id as string,
    slug: row.slug as string,
    name: row.name as string,
    website: row.website as string,
    application_email: row.application_email as string,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export function rowToUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    email: row.email as string,
    password_hash: row.password_hash as string,
    name: row.name as string,
    created_at: row.created_at as string,
  };
}

export function rowToJob(row: Record<string, unknown>): Job {
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    slug: row.slug as string,
    title: row.title as string,
    description: row.description as string,
    location: row.location as string,
    city: row.city as string,
    state: row.state as string,
    country: row.country as string,
    zip: row.zip as string,
    employment_type: row.employment_type as string,
    salary_min: row.salary_min as number | null,
    salary_max: row.salary_max as number | null,
    salary_currency: row.salary_currency as string,
    salary_period: row.salary_period as string,
    company_name: row.company_name as string,
    reference_number: row.reference_number as string,
    status: row.status as JobStatus,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    published_at: row.published_at as string | null,
    closed_at: row.closed_at as string | null,
  };
}

export function rowToApplication(row: Record<string, unknown>): Application {
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    job_id: row.job_id as string,
    applicant_name: row.applicant_name as string,
    applicant_email: row.applicant_email as string,
    applicant_phone: row.applicant_phone as string,
    cover_letter: row.cover_letter as string,
    resume_filename: row.resume_filename as string,
    resume_content_type: row.resume_content_type as string,
    status: (row.status as ApplicationStatus | undefined) ?? "new",
    created_at: row.created_at as string,
  };
}

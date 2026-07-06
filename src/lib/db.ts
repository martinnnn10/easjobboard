import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

import { type ApplicationStatus } from "./application-status";

export type { ApplicationStatus } from "./application-status";
export { APPLICATION_STATUSES } from "./application-status";

export type JobStatus = "draft" | "published" | "closed";

export type Organization = {
  id: string;
  slug: string;
  name: string;
  website: string;
  application_email: string;
  brand_color: string;
  /** Opt-in: push this org's published jobs to 100Hires. Default false. */
  syndicate_100hires: boolean;
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
  /** Skills-screen template key attached to this job ("" = no screen). */
  screen_key: string;
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
  resume_skills: string[];
  match_score: number | null;
  /** Applicant-supplied context that powers risk flags. */
  applicant_location: string;
  desired_pay: string;
  /** Screening state: "none" (no screen), "pending" (attached, not done), "completed". */
  screen_status: ScreenStatus;
  /** 0–100 practical skills score — the PRIMARY ranking signal. */
  screen_score: number | null;
  risk_level: RiskLevelValue;
  risk_flags: RiskFlagRecord[];
  /** Denormalized snapshot for fast card/list rendering (see ScreenSummary). */
  screen_summary: ScreenSummaryRecord | null;
  created_at: string;
};

export type ScreenStatus = "none" | "pending" | "completed";
export type RiskLevelValue = "low" | "medium" | "high" | "";

export type RiskFlagRecord = {
  key: string;
  label: string;
  detail: string;
  severity: "medium" | "high";
};

export type ScreenSummaryRecord = {
  strengths: string[];
  redFlags: string[];
  recommendedAction: string;
  strongDims: string[];
  weakDims: string[];
  method: "llm" | "heuristic";
  confidence?: "high" | "medium" | "low";
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
      brand_color TEXT NOT NULL DEFAULT '',
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

  // Migration: add branding to databases created before it existed.
  if (!columnExists(database, "organizations", "brand_color")) {
    database.exec("ALTER TABLE organizations ADD COLUMN brand_color TEXT NOT NULL DEFAULT ''");
  }
  // Migration: per-org 100Hires opt-in (default off, so existing orgs never
  // start pushing to 100Hires without explicitly enabling it).
  if (!columnExists(database, "organizations", "syndicate_100hires")) {
    database.exec("ALTER TABLE organizations ADD COLUMN syndicate_100hires INTEGER NOT NULL DEFAULT 0");
  }

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
        screen_key TEXT NOT NULL DEFAULT '',
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
      resume_text TEXT NOT NULL DEFAULT '',
      resume_skills TEXT NOT NULL DEFAULT '[]',
      match_score INTEGER,
      created_at TEXT NOT NULL,
      FOREIGN KEY (organization_id) REFERENCES organizations(id),
      FOREIGN KEY (job_id) REFERENCES jobs(id)
    );

    CREATE INDEX IF NOT EXISTS idx_applications_org ON applications(organization_id);
    CREATE INDEX IF NOT EXISTS idx_applications_job ON applications(job_id);
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS candidate_events (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      application_id TEXT NOT NULL,
      type TEXT NOT NULL,
      detail TEXT NOT NULL DEFAULT '',
      actor TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY (organization_id) REFERENCES organizations(id),
      FOREIGN KEY (application_id) REFERENCES applications(id)
    );

    CREATE INDEX IF NOT EXISTS idx_candidate_events_app ON candidate_events(application_id);
  `);

  // Per-application skills-screen submissions (candidate answers + AI scoring).
  database.exec(`
    CREATE TABLE IF NOT EXISTS screen_submissions (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      application_id TEXT NOT NULL,
      job_id TEXT NOT NULL,
      screen_key TEXT NOT NULL,
      answers TEXT NOT NULL DEFAULT '{}',
      overall_score INTEGER,
      dimension_scores TEXT NOT NULL DEFAULT '{}',
      per_answer TEXT NOT NULL DEFAULT '[]',
      follow_up_questions TEXT NOT NULL DEFAULT '[]',
      method TEXT NOT NULL DEFAULT 'heuristic',
      created_at TEXT NOT NULL,
      FOREIGN KEY (organization_id) REFERENCES organizations(id),
      FOREIGN KEY (application_id) REFERENCES applications(id),
      FOREIGN KEY (job_id) REFERENCES jobs(id)
    );

    CREATE INDEX IF NOT EXISTS idx_screen_submissions_app ON screen_submissions(application_id);
    CREATE INDEX IF NOT EXISTS idx_screen_submissions_job ON screen_submissions(job_id);
  `);

  // Per-job distribution to external boards (e.g. 100Hires) that accept a push
  // API rather than a pulled feed. One row per (job, channel).
  database.exec(`
    CREATE TABLE IF NOT EXISTS job_syndications (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      job_id TEXT NOT NULL,
      channel TEXT NOT NULL,
      external_id TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL DEFAULT '',
      error TEXT NOT NULL DEFAULT '',
      synced_at TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(job_id, channel),
      FOREIGN KEY (organization_id) REFERENCES organizations(id),
      FOREIGN KEY (job_id) REFERENCES jobs(id)
    );

    CREATE INDEX IF NOT EXISTS idx_job_syndications_org ON job_syndications(organization_id);
    CREATE INDEX IF NOT EXISTS idx_job_syndications_job ON job_syndications(job_id);
  `);

  // Migrations: add columns to databases created before these features existed.
  if (!columnExists(database, "applications", "status")) {
    database.exec("ALTER TABLE applications ADD COLUMN status TEXT NOT NULL DEFAULT 'new'");
  }
  if (!columnExists(database, "applications", "resume_text")) {
    database.exec("ALTER TABLE applications ADD COLUMN resume_text TEXT NOT NULL DEFAULT ''");
  }
  if (!columnExists(database, "applications", "resume_skills")) {
    database.exec("ALTER TABLE applications ADD COLUMN resume_skills TEXT NOT NULL DEFAULT '[]'");
  }
  if (!columnExists(database, "applications", "match_score")) {
    database.exec("ALTER TABLE applications ADD COLUMN match_score INTEGER");
  }
  // Skills-screen + candidate-intelligence columns.
  if (!columnExists(database, "applications", "applicant_location")) {
    database.exec("ALTER TABLE applications ADD COLUMN applicant_location TEXT NOT NULL DEFAULT ''");
  }
  if (!columnExists(database, "applications", "desired_pay")) {
    database.exec("ALTER TABLE applications ADD COLUMN desired_pay TEXT NOT NULL DEFAULT ''");
  }
  if (!columnExists(database, "applications", "screen_status")) {
    database.exec("ALTER TABLE applications ADD COLUMN screen_status TEXT NOT NULL DEFAULT 'none'");
  }
  if (!columnExists(database, "applications", "screen_score")) {
    database.exec("ALTER TABLE applications ADD COLUMN screen_score INTEGER");
  }
  if (!columnExists(database, "applications", "risk_level")) {
    database.exec("ALTER TABLE applications ADD COLUMN risk_level TEXT NOT NULL DEFAULT ''");
  }
  if (!columnExists(database, "applications", "risk_flags")) {
    database.exec("ALTER TABLE applications ADD COLUMN risk_flags TEXT NOT NULL DEFAULT '[]'");
  }
  if (!columnExists(database, "applications", "screen_summary")) {
    database.exec("ALTER TABLE applications ADD COLUMN screen_summary TEXT NOT NULL DEFAULT ''");
  }
  if (!columnExists(database, "jobs", "screen_key")) {
    database.exec("ALTER TABLE jobs ADD COLUMN screen_key TEXT NOT NULL DEFAULT ''");
  }
  database.exec("CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status)");
  database.exec("CREATE INDEX IF NOT EXISTS idx_applications_screen_score ON applications(screen_score)");
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
    brand_color: (row.brand_color as string | undefined) ?? "",
    syndicate_100hires: Boolean(row.syndicate_100hires),
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
    screen_key: (row.screen_key as string | undefined) ?? "",
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
    resume_skills: parseSkills(row.resume_skills),
    match_score: row.match_score == null ? null : Number(row.match_score),
    applicant_location: (row.applicant_location as string | undefined) ?? "",
    desired_pay: (row.desired_pay as string | undefined) ?? "",
    screen_status: (row.screen_status as ScreenStatus | undefined) ?? "none",
    screen_score: row.screen_score == null ? null : Number(row.screen_score),
    risk_level: (row.risk_level as RiskLevelValue | undefined) ?? "",
    risk_flags: parseJson<RiskFlagRecord[]>(row.risk_flags, []),
    screen_summary: parseJson<ScreenSummaryRecord | null>(row.screen_summary, null),
    created_at: row.created_at as string,
  };
}

function parseSkills(value: unknown): string[] {
  if (typeof value !== "string" || value.length === 0) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || value.length === 0) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

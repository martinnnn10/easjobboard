import Database from "better-sqlite3";
import { randomUUID } from "crypto";
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
  /** trialing | active | past_due | canceled | none */
  billing_status: string;
  trial_ends_at: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  /** Raw Stripe subscription status when present (trialing|active|past_due|…). */
  subscription_status: string;
  plan_seats: number;
  current_period_end: string;
  /** employer | agency | other (optional, from signup). */
  company_type: string;
  /**
   * in_house | agency — drives nav labels and buyer-facing copy only (not
   * permissions). Seeded from company_type; changeable in Settings.
   */
  organization_type: string;
  /** True for the sample/demo workspace so the UI can label it. */
  is_demo: boolean;
  /** Owner dismissed the first-run onboarding checklist. */
  onboarding_dismissed: boolean;
  created_at: string;
  updated_at: string;
};

export type User = {
  id: string;
  organization_id: string;
  email: string;
  password_hash: string;
  name: string;
  /** Access role: "owner" | "recruiter" | "viewer". */
  role: string;
  /**
   * ISO timestamp; session tokens issued before this are rejected. Bumping it
   * revokes every outstanding session for the user (server-side sign-out).
   */
  sessions_valid_after: string;
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
  /** Work schedule label, e.g. "1st Shift (Day)" ("" = unspecified). */
  shift: string;
  /** Required certifications/licenses (e.g. "Journeyman", "OSHA 30"). */
  certifications: string[];
  /** Weekly schedule, e.g. "Mon–Fri, 4x10" ("" = unspecified). */
  schedule: string;
  /** Overtime expectation, e.g. "Occasional", "Frequent", "Required". */
  overtime: string;
  /** "Union" | "Non-union" | "" (unspecified). */
  union_status: string;
  /** Relocation support, e.g. "Offered", "Case-by-case", "None". */
  relocation: string;
  /** PLC platforms, e.g. "Allen-Bradley, Siemens". */
  plc_platforms: string;
  /** VFD experience expectation: "Required" | "Preferred" | "". */
  vfd_experience: string;
  /** Ammonia/refrigeration expectation: "Required" | "Preferred" | "". */
  refrigeration: string;
  /** Industry, e.g. "Food & Beverage", "Automotive". */
  industry: string;
  /** Travel expectation, e.g. "None", "Occasional", "Up to 25%". */
  travel: string;
  /** Application deadline (YYYY-MM-DD) ("" = none). */
  application_deadline: string;
  /** Email the org resume inbox when a new application arrives (default on). */
  notify_on_apply: boolean;
  /** User id of the teammate who created the job ("" = unknown/legacy). */
  created_by: string;
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
  /** The persistent candidate (person) this application belongs to. */
  candidate_id: string;
  resume_skills: string[];
  match_score: number | null;
  /** How match_score was computed: "llm" (semantic) or "heuristic" (keyword). "" = not scored. */
  match_method: string;
  /** Applicant-supplied context that powers risk flags. */
  applicant_location: string;
  desired_pay: string;
  /** Screening state: "none" (no screen), "pending" (attached, not done), "completed". */
  screen_status: ScreenStatus;
  /** 0–100 practical skills score — the PRIMARY ranking signal. */
  screen_score: number | null;
  /** Knockout verdict from the screen's must-pass rules: "qualified" | "knockout" | "". */
  screen_outcome: string;
  risk_level: RiskLevelValue;
  risk_flags: RiskFlagRecord[];
  /** Denormalized snapshot for fast card/list rendering (see ScreenSummary). */
  screen_summary: ScreenSummaryRecord | null;
  /** True for sample rows loaded by the demo workspace. */
  is_demo: boolean;
  /** How the application was created: 'applied' (public) or a manual/import source. */
  source: string;
  /** Distribution attribution captured from the apply link (?source=…&utm_*=…). */
  apply_source: string;
  referrer: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  created_at: string;
};

// none = job has no screen configured; pending = screen sent, awaiting the
// candidate; skipped = candidate applied resume-only and skipped the optional
// screen; completed = screen answered and scored.
export type ScreenStatus = "none" | "pending" | "skipped" | "completed";
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

/**
 * Rebuild candidate_events so application_id is NULLABLE. Person-level activity
 * (a call/note logged on a sourced candidate who never applied) has no owning
 * application, so the old `application_id TEXT NOT NULL` + FK forced us to anchor
 * such events to an arbitrary application. Now the column is nullable: person
 * events store NULL and are keyed by candidate_id instead. Idempotent — only
 * rebuilds when the column is still NOT NULL. Existing empty strings become NULL.
 */
function migrateCandidateEventsNullableApp(database: Database.Database): void {
  if (!tableExists(database, "candidate_events")) return;
  const columns = database.prepare("PRAGMA table_info(candidate_events)").all() as Array<{
    name: string;
    notnull: number;
  }>;
  const appCol = columns.find((c) => c.name === "application_id");
  if (!appCol || appCol.notnull === 0) return; // already nullable (or table missing)
  const hasCandidateId = columns.some((c) => c.name === "candidate_id");

  // Table rebuild is the only way to drop NOT NULL in SQLite. Nothing has a
  // foreign key pointing AT candidate_events, so dropping it is safe.
  const rebuild = database.transaction(() => {
    database.exec(`
      CREATE TABLE candidate_events_new (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        application_id TEXT,
        candidate_id TEXT NOT NULL DEFAULT '',
        type TEXT NOT NULL,
        detail TEXT NOT NULL DEFAULT '',
        actor TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
        FOREIGN KEY (application_id) REFERENCES applications(id)
      );
    `);
    const candidateExpr = hasCandidateId ? "candidate_id" : "''";
    database.exec(`
      INSERT INTO candidate_events_new (id, organization_id, application_id, candidate_id, type, detail, actor, created_at)
      SELECT id, organization_id, NULLIF(application_id, ''), ${candidateExpr}, type, detail, actor, created_at
      FROM candidate_events;
    `);
    database.exec("DROP TABLE candidate_events;");
    database.exec("ALTER TABLE candidate_events_new RENAME TO candidate_events;");
  });
  rebuild();
  database.exec("CREATE INDEX IF NOT EXISTS idx_candidate_events_app ON candidate_events(application_id)");
  database.exec("CREATE INDEX IF NOT EXISTS idx_candidate_events_candidate ON candidate_events(candidate_id)");
}

function mergeSkillJson(a: string, b: string): string {
  const parse = (v: string): string[] => {
    try {
      const p = JSON.parse(v);
      return Array.isArray(p) ? p.filter((s): s is string => typeof s === "string") : [];
    } catch {
      return [];
    }
  };
  const set = new Set([...parse(a), ...parse(b)]);
  return JSON.stringify([...set]);
}

/**
 * One-time backfill: group unlinked applications by (org, lowercased email) into
 * persistent candidate rows, then stamp candidate_id onto each application and
 * its events. Idempotent — only touches applications whose candidate_id is "".
 */
function backfillCandidates(database: Database.Database): void {
  const pending = database
    .prepare("SELECT COUNT(*) AS c FROM applications WHERE candidate_id = ''")
    .get() as { c: number };
  if (pending.c === 0) return;

  const rows = database
    .prepare(
      `SELECT id, organization_id, applicant_name, applicant_email, applicant_phone,
              applicant_location, resume_skills, created_at
       FROM applications WHERE candidate_id = '' ORDER BY created_at ASC`,
    )
    .all() as Array<{
    id: string;
    organization_id: string;
    applicant_name: string;
    applicant_email: string;
    applicant_phone: string;
    applicant_location: string;
    resume_skills: string;
    created_at: string;
  }>;

  const findCandidate = database.prepare(
    "SELECT id, skills FROM candidates WHERE organization_id = ? AND email = ?",
  );
  const insertCandidate = database.prepare(
    `INSERT INTO candidates (id, organization_id, email, name, phone, location, skills, tags,
       owner_user_id, first_applied_at, last_applied_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, '[]', '', ?, ?, ?, ?)`,
  );
  const updateCandidate = database.prepare(
    "UPDATE candidates SET name = ?, phone = ?, location = ?, skills = ?, last_applied_at = ?, updated_at = ? WHERE id = ?",
  );
  const linkApplication = database.prepare("UPDATE applications SET candidate_id = ? WHERE id = ?");
  const linkEvents = database.prepare("UPDATE candidate_events SET candidate_id = ? WHERE application_id = ?");

  const run = database.transaction(() => {
    for (const row of rows) {
      const email = row.applicant_email.trim().toLowerCase();
      const now = row.created_at;
      const existing = findCandidate.get(row.organization_id, email) as
        | { id: string; skills: string }
        | undefined;

      let candidateId: string;
      if (existing) {
        candidateId = existing.id;
        // Rows are oldest-first, so the latest name/phone/location wins.
        updateCandidate.run(
          row.applicant_name,
          row.applicant_phone || "",
          row.applicant_location || "",
          mergeSkillJson(existing.skills, row.resume_skills || "[]"),
          now,
          now,
          candidateId,
        );
      } else {
        candidateId = randomUUID();
        insertCandidate.run(
          candidateId,
          row.organization_id,
          email,
          row.applicant_name,
          row.applicant_phone || "",
          row.applicant_location || "",
          row.resume_skills || "[]",
          now,
          now,
          now,
          now,
        );
      }
      linkApplication.run(candidateId, row.id);
      linkEvents.run(candidateId, row.id);
    }
  });
  run();
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
      organization_type TEXT NOT NULL DEFAULT 'in_house',
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

  // Migration: subscription/billing state. Trial is tracked locally so an org
  // has an honest 14-day trial from signup even before Stripe is involved;
  // Stripe columns fill in once a subscription is created.
  for (const [col, ddl] of [
    ["billing_status", "ALTER TABLE organizations ADD COLUMN billing_status TEXT NOT NULL DEFAULT 'trialing'"],
    ["trial_ends_at", "ALTER TABLE organizations ADD COLUMN trial_ends_at TEXT NOT NULL DEFAULT ''"],
    ["stripe_customer_id", "ALTER TABLE organizations ADD COLUMN stripe_customer_id TEXT NOT NULL DEFAULT ''"],
    ["stripe_subscription_id", "ALTER TABLE organizations ADD COLUMN stripe_subscription_id TEXT NOT NULL DEFAULT ''"],
    ["subscription_status", "ALTER TABLE organizations ADD COLUMN subscription_status TEXT NOT NULL DEFAULT ''"],
    ["plan_seats", "ALTER TABLE organizations ADD COLUMN plan_seats INTEGER NOT NULL DEFAULT 0"],
    ["current_period_end", "ALTER TABLE organizations ADD COLUMN current_period_end TEXT NOT NULL DEFAULT ''"],
    ["company_type", "ALTER TABLE organizations ADD COLUMN company_type TEXT NOT NULL DEFAULT ''"],
    ["is_demo", "ALTER TABLE organizations ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0"],
    ["onboarding_dismissed", "ALTER TABLE organizations ADD COLUMN onboarding_dismissed INTEGER NOT NULL DEFAULT 0"],
  ] as const) {
    if (!columnExists(database, "organizations", col)) database.exec(ddl);
  }

  // Migration: organization_type drives nav labels and buyer-facing copy
  // (in_house vs agency). Seed it once, on first add, from the company_type
  // captured at signup so existing agencies land in agency mode; owners can
  // change it later in Settings without this backfill clobbering their choice.
  if (!columnExists(database, "organizations", "organization_type")) {
    database.exec("ALTER TABLE organizations ADD COLUMN organization_type TEXT NOT NULL DEFAULT 'in_house'");
    database.exec("UPDATE organizations SET organization_type = 'agency' WHERE LOWER(company_type) = 'agency'");
  }

  // Inbound "Book a demo" requests from the public site.
  database.exec(`
    CREATE TABLE IF NOT EXISTS demo_requests (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      company TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT '',
      challenge TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
  `);

  // Token-based skills-screen invites — lets a recruiter send a role-specific
  // screen to an imported/sourced candidate who completes it on a public page.
  database.exec(`
    CREATE TABLE IF NOT EXISTS screen_invites (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      candidate_id TEXT NOT NULL,
      job_id TEXT NOT NULL DEFAULT '',
      application_id TEXT NOT NULL DEFAULT '',
      screen_key TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'pending',
      source TEXT NOT NULL DEFAULT 'manual',
      message TEXT NOT NULL DEFAULT '',
      sent_by TEXT NOT NULL DEFAULT '',
      sent_at TEXT NOT NULL,
      completed_at TEXT NOT NULL DEFAULT '',
      expires_at TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY (organization_id) REFERENCES organizations(id)
    );
    CREATE INDEX IF NOT EXISTS idx_screen_invites_candidate ON screen_invites(candidate_id);
    CREATE INDEX IF NOT EXISTS idx_screen_invites_token ON screen_invites(token);
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
        screen_key TEXT NOT NULL DEFAULT '',
        notify_on_apply INTEGER NOT NULL DEFAULT 1,
        created_by TEXT NOT NULL DEFAULT '',
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

  // Per-job visibility allowlist. Presence of ANY row for a job restricts it to
  // those users (plus owners + the job creator); no rows ⇒ visible to all org
  // members (backward-compatible for pre-existing jobs).
  database.exec(`
    CREATE TABLE IF NOT EXISTS job_visible_users (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      job_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(job_id, user_id),
      FOREIGN KEY (organization_id) REFERENCES organizations(id),
      FOREIGN KEY (job_id) REFERENCES jobs(id)
    );
    CREATE INDEX IF NOT EXISTS idx_job_visible_users_job ON job_visible_users(job_id);
    CREATE INDEX IF NOT EXISTS idx_job_visible_users_user ON job_visible_users(organization_id, user_id);
  `);

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

  // Persistent candidate (person) entity — one row per person per org, keyed by
  // email. Applications and events link to it so a candidate has a single
  // profile, unified timeline, tags, and owner across every job they apply to.
  database.exec(`
    CREATE TABLE IF NOT EXISTS candidates (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      email TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      skills TEXT NOT NULL DEFAULT '[]',
      tags TEXT NOT NULL DEFAULT '[]',
      owner_user_id TEXT NOT NULL DEFAULT '',
      first_applied_at TEXT NOT NULL,
      last_applied_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(organization_id, email),
      FOREIGN KEY (organization_id) REFERENCES organizations(id)
    );

    CREATE INDEX IF NOT EXISTS idx_candidates_org ON candidates(organization_id);
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

  // Candidate Care: per-req recruiter assignment, scheduled interviews, and the
  // SLA follow-up tasks that keep candidates engaged before/after each step.
  database.exec(`
    CREATE TABLE IF NOT EXISTS candidate_assignments (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      candidate_id TEXT NOT NULL,
      job_id TEXT NOT NULL,
      assigned_recruiter_id TEXT NOT NULL,
      assigned_by TEXT NOT NULL DEFAULT '',
      assigned_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      FOREIGN KEY (organization_id) REFERENCES organizations(id)
    );
    CREATE INDEX IF NOT EXISTS idx_assignments_job ON candidate_assignments(job_id);
    CREATE INDEX IF NOT EXISTS idx_assignments_candidate ON candidate_assignments(candidate_id);

    CREATE TABLE IF NOT EXISTS interviews (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      candidate_id TEXT NOT NULL,
      job_id TEXT NOT NULL DEFAULT '',
      application_id TEXT,
      client TEXT NOT NULL DEFAULT '',
      interview_title TEXT NOT NULL DEFAULT '',
      interview_type TEXT NOT NULL DEFAULT '',
      interview_datetime TEXT NOT NULL,
      timezone TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      hiring_manager TEXT NOT NULL DEFAULT '',
      stage TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_by TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY (organization_id) REFERENCES organizations(id)
    );
    CREATE INDEX IF NOT EXISTS idx_interviews_candidate ON interviews(candidate_id);
    CREATE INDEX IF NOT EXISTS idx_interviews_job ON interviews(job_id);

    CREATE TABLE IF NOT EXISTS care_tasks (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      candidate_id TEXT NOT NULL,
      job_id TEXT NOT NULL DEFAULT '',
      application_id TEXT,
      interview_id TEXT,
      assigned_recruiter_id TEXT NOT NULL DEFAULT '',
      task_type TEXT NOT NULL,
      due_at TEXT NOT NULL,
      escalation_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      confirmed_at TEXT NOT NULL DEFAULT '',
      confirmed_by TEXT NOT NULL DEFAULT '',
      contact_method TEXT NOT NULL DEFAULT '',
      outcome TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      escalated_at TEXT NOT NULL DEFAULT '',
      escalated_to TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (organization_id) REFERENCES organizations(id)
    );
    CREATE INDEX IF NOT EXISTS idx_care_tasks_recruiter ON care_tasks(assigned_recruiter_id);
    CREATE INDEX IF NOT EXISTS idx_care_tasks_candidate ON care_tasks(candidate_id);
    CREATE INDEX IF NOT EXISTS idx_care_tasks_status ON care_tasks(status);
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
  if (!columnExists(database, "applications", "match_method")) {
    database.exec("ALTER TABLE applications ADD COLUMN match_method TEXT NOT NULL DEFAULT ''");
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
  if (!columnExists(database, "applications", "screen_outcome")) {
    database.exec("ALTER TABLE applications ADD COLUMN screen_outcome TEXT NOT NULL DEFAULT ''");
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
  // Demo labelling: mark sample rows so they can be badged and never mistaken
  // for real candidates in a real workspace.
  if (!columnExists(database, "applications", "is_demo")) {
    database.exec("ALTER TABLE applications ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0");
  }
  if (!columnExists(database, "candidates", "is_demo")) {
    database.exec("ALTER TABLE candidates ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0");
  }
  // How an application was created — 'applied' (public apply) vs a manual/import
  // source, so imported applications can be clearly labelled.
  if (!columnExists(database, "applications", "source")) {
    database.exec("ALTER TABLE applications ADD COLUMN source TEXT NOT NULL DEFAULT 'applied'");
  }
  // Distribution attribution: where the applicant clicked through from, plus any
  // UTM tags on the apply link. All optional (empty when applied directly).
  for (const col of ["apply_source", "referrer", "utm_source", "utm_medium", "utm_campaign"]) {
    if (!columnExists(database, "applications", col)) {
      database.exec(`ALTER TABLE applications ADD COLUMN ${col} TEXT NOT NULL DEFAULT ''`);
    }
  }
  // Manual distribution-status overrides per (job, channel) — e.g. an owner
  // marking an Indeed feed "Registered". Absent rows fall back to the derived
  // status (published ⇒ feed ready / eligible, etc.).
  database.exec(`
    CREATE TABLE IF NOT EXISTS job_channel_status (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      job_id TEXT NOT NULL,
      channel TEXT NOT NULL,
      status TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      updated_by TEXT NOT NULL DEFAULT ''
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_job_channel ON job_channel_status(job_id, channel);
  `);
  // Candidate-level resume for imported/sourced people who never applied through
  // a public job page. Nullable — most sourced candidates have no resume.
  if (!columnExists(database, "candidates", "resume_filename")) {
    database.exec("ALTER TABLE candidates ADD COLUMN resume_filename TEXT NOT NULL DEFAULT ''");
  }
  if (!columnExists(database, "candidates", "resume_content_type")) {
    database.exec("ALTER TABLE candidates ADD COLUMN resume_content_type TEXT NOT NULL DEFAULT ''");
  }
  if (!columnExists(database, "candidates", "resume_data")) {
    database.exec("ALTER TABLE candidates ADD COLUMN resume_data BLOB");
  }
  // RBAC: existing single-user orgs become "owner"; multi-seat roles + revocation.
  if (!columnExists(database, "users", "role")) {
    database.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'owner'");
  }
  if (!columnExists(database, "users", "sessions_valid_after")) {
    database.exec("ALTER TABLE users ADD COLUMN sessions_valid_after TEXT NOT NULL DEFAULT ''");
  }
  // Persistent candidate CRM: link applications + events to a candidate entity.
  if (!columnExists(database, "applications", "candidate_id")) {
    database.exec("ALTER TABLE applications ADD COLUMN candidate_id TEXT NOT NULL DEFAULT ''");
  }
  if (!columnExists(database, "candidate_events", "candidate_id")) {
    database.exec("ALTER TABLE candidate_events ADD COLUMN candidate_id TEXT NOT NULL DEFAULT ''");
  }
  backfillCandidates(database);
  // Person-level activity needs application_id to be optional (run after the
  // candidate_id column + backfill so existing events keep their linkage).
  migrateCandidateEventsNullableApp(database);
  // Sourced/passive candidates: people in the pool who haven't applied yet.
  // `source` records how they entered (applied|sourced|imported|referred|manual|
  // unknown); existing candidates all came from applications, so default 'applied'.
  if (!columnExists(database, "candidates", "title")) {
    database.exec("ALTER TABLE candidates ADD COLUMN title TEXT NOT NULL DEFAULT ''");
  }
  if (!columnExists(database, "candidates", "company")) {
    database.exec("ALTER TABLE candidates ADD COLUMN company TEXT NOT NULL DEFAULT ''");
  }
  if (!columnExists(database, "candidates", "source")) {
    database.exec("ALTER TABLE candidates ADD COLUMN source TEXT NOT NULL DEFAULT 'applied'");
  }
  if (!columnExists(database, "candidates", "source_provider")) {
    database.exec("ALTER TABLE candidates ADD COLUMN source_provider TEXT NOT NULL DEFAULT ''");
  }
  if (!columnExists(database, "candidates", "source_url")) {
    database.exec("ALTER TABLE candidates ADD COLUMN source_url TEXT NOT NULL DEFAULT ''");
  }
  if (!columnExists(database, "candidates", "crm_status")) {
    database.exec("ALTER TABLE candidates ADD COLUMN crm_status TEXT NOT NULL DEFAULT ''");
  }
  if (!columnExists(database, "candidates", "created_by")) {
    database.exec("ALTER TABLE candidates ADD COLUMN created_by TEXT NOT NULL DEFAULT ''");
  }
  // Call-queue workflow: track outreach so the queue can surface who's due.
  if (!columnExists(database, "candidates", "last_contacted_at")) {
    database.exec("ALTER TABLE candidates ADD COLUMN last_contacted_at TEXT NOT NULL DEFAULT ''");
  }
  if (!columnExists(database, "candidates", "follow_up_at")) {
    database.exec("ALTER TABLE candidates ADD COLUMN follow_up_at TEXT NOT NULL DEFAULT ''");
  }
  if (!columnExists(database, "jobs", "shift")) {
    database.exec("ALTER TABLE jobs ADD COLUMN shift TEXT NOT NULL DEFAULT ''");
  }
  if (!columnExists(database, "jobs", "certifications")) {
    database.exec("ALTER TABLE jobs ADD COLUMN certifications TEXT NOT NULL DEFAULT '[]'");
  }
  // Manufacturing-relevant job fields (all optional TEXT).
  for (const col of [
    "schedule",
    "overtime",
    "union_status",
    "relocation",
    "plc_platforms",
    "vfd_experience",
    "refrigeration",
    "industry",
    "travel",
    "application_deadline",
  ]) {
    if (!columnExists(database, "jobs", col)) {
      database.exec(`ALTER TABLE jobs ADD COLUMN ${col} TEXT NOT NULL DEFAULT ''`);
    }
  }
  // Per-job application-notification toggle (default on = preserve behavior).
  if (!columnExists(database, "jobs", "notify_on_apply")) {
    database.exec("ALTER TABLE jobs ADD COLUMN notify_on_apply INTEGER NOT NULL DEFAULT 1");
  }
  // Job creator (for the always-visible-to-creator rule). Legacy rows get ''.
  if (!columnExists(database, "jobs", "created_by")) {
    database.exec("ALTER TABLE jobs ADD COLUMN created_by TEXT NOT NULL DEFAULT ''");
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
    billing_status: (row.billing_status as string | undefined) ?? "trialing",
    trial_ends_at: (row.trial_ends_at as string | undefined) ?? "",
    stripe_customer_id: (row.stripe_customer_id as string | undefined) ?? "",
    stripe_subscription_id: (row.stripe_subscription_id as string | undefined) ?? "",
    subscription_status: (row.subscription_status as string | undefined) ?? "",
    plan_seats: Number(row.plan_seats ?? 0),
    current_period_end: (row.current_period_end as string | undefined) ?? "",
    company_type: (row.company_type as string | undefined) ?? "",
    organization_type: (row.organization_type as string | undefined) ?? "in_house",
    is_demo: Number(row.is_demo ?? 0) === 1,
    onboarding_dismissed: Number(row.onboarding_dismissed ?? 0) === 1,
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
    role: (row.role as string | undefined) || "owner",
    sessions_valid_after: (row.sessions_valid_after as string | undefined) ?? "",
    created_at: row.created_at as string,
  };
}

/** Parse a JSON-encoded string array column, tolerating null/legacy values. */
function parseStringArray(value: unknown): string[] {
  if (typeof value !== "string" || value.trim() === "") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
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
    shift: (row.shift as string | undefined) ?? "",
    certifications: parseStringArray(row.certifications),
    schedule: (row.schedule as string | undefined) ?? "",
    overtime: (row.overtime as string | undefined) ?? "",
    union_status: (row.union_status as string | undefined) ?? "",
    relocation: (row.relocation as string | undefined) ?? "",
    plc_platforms: (row.plc_platforms as string | undefined) ?? "",
    vfd_experience: (row.vfd_experience as string | undefined) ?? "",
    refrigeration: (row.refrigeration as string | undefined) ?? "",
    industry: (row.industry as string | undefined) ?? "",
    travel: (row.travel as string | undefined) ?? "",
    application_deadline: (row.application_deadline as string | undefined) ?? "",
    notify_on_apply: Number(row.notify_on_apply ?? 1) !== 0,
    created_by: (row.created_by as string | undefined) ?? "",
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
    candidate_id: (row.candidate_id as string | undefined) ?? "",
    resume_skills: parseSkills(row.resume_skills),
    match_score: row.match_score == null ? null : Number(row.match_score),
    match_method: (row.match_method as string | undefined) ?? "",
    applicant_location: (row.applicant_location as string | undefined) ?? "",
    desired_pay: (row.desired_pay as string | undefined) ?? "",
    screen_status: (row.screen_status as ScreenStatus | undefined) ?? "none",
    screen_score: row.screen_score == null ? null : Number(row.screen_score),
    screen_outcome: (row.screen_outcome as string | undefined) ?? "",
    risk_level: (row.risk_level as RiskLevelValue | undefined) ?? "",
    risk_flags: parseJson<RiskFlagRecord[]>(row.risk_flags, []),
    screen_summary: parseJson<ScreenSummaryRecord | null>(row.screen_summary, null),
    is_demo: Number(row.is_demo ?? 0) === 1,
    source: (row.source as string | undefined) ?? "applied",
    apply_source: (row.apply_source as string | undefined) ?? "",
    referrer: (row.referrer as string | undefined) ?? "",
    utm_source: (row.utm_source as string | undefined) ?? "",
    utm_medium: (row.utm_medium as string | undefined) ?? "",
    utm_campaign: (row.utm_campaign as string | undefined) ?? "",
    created_at: row.created_at as string,
  };
}

export type CandidateRecord = {
  id: string;
  organization_id: string;
  email: string;
  name: string;
  phone: string;
  location: string;
  /** Current job title (for sourced/passive candidates). */
  title: string;
  /** Current employer (for sourced/passive candidates). */
  company: string;
  skills: string[];
  tags: string[];
  owner_user_id: string;
  /** How they entered the pool: applied|sourced|imported|referred|manual|unknown. */
  source: string;
  /** Sourcing provider, e.g. "Apollo", "LinkedIn", "Manual" ("" when applied). */
  source_provider: string;
  /** Link to the sourced profile, if any. */
  source_url: string;
  /** Outreach/pipeline status for passive candidates (see CANDIDATE_CRM_STATUSES). */
  crm_status: string;
  /** User id who added a sourced candidate ("" for organic applicants). */
  created_by: string;
  /** ISO timestamp of the last logged call/text/email ("" if never). */
  last_contacted_at: string;
  /** ISO timestamp a follow-up is due ("" if none). */
  follow_up_at: string;
  first_applied_at: string;
  last_applied_at: string;
  /** True for sample candidates loaded by the demo workspace. */
  is_demo: boolean;
  /** Candidate-level resume metadata (imported/sourced people). "" when none. */
  resume_filename: string;
  resume_content_type: string;
  created_at: string;
  updated_at: string;
};

export function rowToCandidate(row: Record<string, unknown>): CandidateRecord {
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    email: row.email as string,
    name: (row.name as string | undefined) ?? "",
    phone: (row.phone as string | undefined) ?? "",
    location: (row.location as string | undefined) ?? "",
    title: (row.title as string | undefined) ?? "",
    company: (row.company as string | undefined) ?? "",
    skills: parseSkills(row.skills),
    tags: parseSkills(row.tags),
    owner_user_id: (row.owner_user_id as string | undefined) ?? "",
    source: (row.source as string | undefined) || "applied",
    source_provider: (row.source_provider as string | undefined) ?? "",
    source_url: (row.source_url as string | undefined) ?? "",
    crm_status: (row.crm_status as string | undefined) ?? "",
    created_by: (row.created_by as string | undefined) ?? "",
    last_contacted_at: (row.last_contacted_at as string | undefined) ?? "",
    follow_up_at: (row.follow_up_at as string | undefined) ?? "",
    first_applied_at: row.first_applied_at as string,
    last_applied_at: row.last_applied_at as string,
    is_demo: Number(row.is_demo ?? 0) === 1,
    resume_filename: (row.resume_filename as string | undefined) ?? "",
    resume_content_type: (row.resume_content_type as string | undefined) ?? "",
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
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

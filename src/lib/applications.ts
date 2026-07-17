import { randomUUID } from "crypto";
import { recordCandidateEvent } from "./candidate-events";
import { upsertCandidate } from "./candidates";
import {
  getDb,
  isOrgInDemoMode,
  rowToApplication,
  type Application,
  type ApplicationStatus,
  type RiskFlagRecord,
  type RiskLevelValue,
  type ScreenStatus,
  type ScreenSummaryRecord,
} from "./db";
import { canSeeJob, hiddenJobsSql, type JobAccess } from "./job-visibility";

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * SQL fragment that excludes seeded demo rows from a real workspace's counts and
 * lists, but keeps them while the org is in demo mode. `col` lets callers use a
 * table alias (e.g. "a.is_demo") in joined queries.
 */
function demoFilterSql(organizationId: string, col = "is_demo"): string {
  return isOrgInDemoMode(organizationId) ? "" : ` AND ${col} = 0`;
}

export type ApplicationWithJob = Application & {
  job_title: string;
  job_slug: string;
};

export function createApplication(input: {
  organization_id: string;
  job_id: string;
  applicant_name: string;
  applicant_email: string;
  applicant_phone: string;
  cover_letter: string;
  resume_filename: string;
  resume_content_type: string;
  resume_data: Buffer;
  resume_text?: string;
  resume_skills?: string[];
  match_score?: number | null;
  match_method?: string;
  applicant_location?: string;
  desired_pay?: string;
  screen_status?: ScreenStatus;
  screen_score?: number | null;
  screen_outcome?: string;
  risk_level?: RiskLevelValue;
  risk_flags?: RiskFlagRecord[];
  screen_summary?: ScreenSummaryRecord | null;
  created_at?: string;
  /** 'applied' (public) or a manual/import source. Marks the application. */
  source?: string;
  /** Distribution attribution from the apply link. */
  apply_source?: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  /** Actor for the timeline event (recruiter name for manual attaches). */
  actor?: string;
}): Application {
  const database = getDb();
  const id = randomUUID();
  const appliedAt = input.created_at ?? nowIso();
  const source = input.source?.trim() || "applied";
  const isManual = source !== "applied";

  // Attach to (or create) the persistent candidate for this person, so their
  // applications, timeline, tags, and owner live on one profile across jobs.
  const candidateId = upsertCandidate({
    organization_id: input.organization_id,
    email: input.applicant_email,
    name: input.applicant_name,
    phone: input.applicant_phone,
    location: input.applicant_location,
    skills: input.resume_skills,
    appliedAt,
  });

  database
    .prepare(
      `INSERT INTO applications (
        id, organization_id, job_id, candidate_id, applicant_name, applicant_email, applicant_phone,
        cover_letter, resume_filename, resume_content_type, resume_data,
        resume_text, resume_skills, match_score, match_method, applicant_location, desired_pay,
        screen_status, screen_score, screen_outcome, risk_level, risk_flags, screen_summary, source,
        apply_source, referrer, utm_source, utm_medium, utm_campaign, created_at
      ) VALUES (
        @id, @organization_id, @job_id, @candidate_id, @applicant_name, @applicant_email, @applicant_phone,
        @cover_letter, @resume_filename, @resume_content_type, @resume_data,
        @resume_text, @resume_skills, @match_score, @match_method, @applicant_location, @desired_pay,
        @screen_status, @screen_score, @screen_outcome, @risk_level, @risk_flags, @screen_summary, @source,
        @apply_source, @referrer, @utm_source, @utm_medium, @utm_campaign, @created_at
      )`,
    )
    .run({
      id,
      organization_id: input.organization_id,
      job_id: input.job_id,
      candidate_id: candidateId,
      applicant_name: input.applicant_name,
      applicant_email: input.applicant_email,
      applicant_phone: input.applicant_phone,
      cover_letter: input.cover_letter,
      resume_filename: input.resume_filename,
      resume_content_type: input.resume_content_type,
      resume_data: input.resume_data,
      resume_text: input.resume_text ?? "",
      resume_skills: JSON.stringify(input.resume_skills ?? []),
      match_score: input.match_score ?? null,
      match_method: input.match_method ?? "",
      applicant_location: input.applicant_location ?? "",
      desired_pay: input.desired_pay ?? "",
      screen_status: input.screen_status ?? "none",
      screen_score: input.screen_score ?? null,
      screen_outcome: input.screen_outcome ?? "",
      risk_level: input.risk_level ?? "",
      risk_flags: JSON.stringify(input.risk_flags ?? []),
      screen_summary: input.screen_summary ? JSON.stringify(input.screen_summary) : "",
      source,
      apply_source: input.apply_source?.slice(0, 60) ?? "",
      referrer: input.referrer?.slice(0, 500) ?? "",
      utm_source: input.utm_source?.slice(0, 120) ?? "",
      utm_medium: input.utm_medium?.slice(0, 120) ?? "",
      utm_campaign: input.utm_campaign?.slice(0, 120) ?? "",
      created_at: input.created_at ?? nowIso(),
    });

  const jobTitle = (
    database.prepare("SELECT title FROM jobs WHERE id = ?").get(input.job_id) as { title?: string } | undefined
  )?.title;
  recordCandidateEvent({
    organization_id: input.organization_id,
    application_id: id,
    candidate_id: candidateId,
    type: "applied",
    detail: isManual
      ? `Manually added to ${jobTitle ?? "a job"}`
      : jobTitle
        ? `Applied to ${jobTitle}`
        : "Application received",
    actor: isManual ? input.actor ?? "" : input.applicant_name,
  });

  return getApplicationById(id)!;
}

export function getApplicationById(id: string): Application | null {
  const row = getDb().prepare("SELECT * FROM applications WHERE id = ?").get(id);
  return row ? rowToApplication(row as Record<string, unknown>) : null;
}

/** The existing application for a (candidate, job) pair, if one is open. */
export function getApplicationByCandidateAndJob(
  candidateId: string,
  jobId: string,
  organizationId: string,
): Application | null {
  const row = getDb()
    .prepare("SELECT * FROM applications WHERE candidate_id = ? AND job_id = ? AND organization_id = ?")
    .get(candidateId, jobId, organizationId);
  return row ? rowToApplication(row as Record<string, unknown>) : null;
}

function parseSkillsJson(value: unknown): string[] {
  if (typeof value !== "string" || value.length === 0) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Attach an existing (typically sourced) candidate to a job by opening an
 * application for them from their stored profile — no resume required. Reuses
 * createApplication, which re-attaches to the same candidate via email, so the
 * new application lands on their existing timeline. Guards against duplicating
 * an application for the same (candidate, job).
 */
export function attachCandidateToJob(input: {
  organization_id: string;
  candidate_id: string;
  job_id: string;
  actor?: string;
  /** Marks the created application as manual/import (default 'manual'). */
  source?: string;
}): { ok: true; application: Application } | { ok: false; error: string } {
  const database = getDb();
  const candidate = database
    .prepare("SELECT * FROM candidates WHERE id = ? AND organization_id = ?")
    .get(input.candidate_id, input.organization_id) as Record<string, unknown> | undefined;
  if (!candidate) return { ok: false, error: "Candidate not found." };

  const job = database
    .prepare("SELECT id FROM jobs WHERE id = ? AND organization_id = ?")
    .get(input.job_id, input.organization_id) as { id?: string } | undefined;
  if (!job) return { ok: false, error: "Job not found." };

  const email = String(candidate.email ?? "").trim();
  if (!email) return { ok: false, error: "This candidate has no email to attach an application." };

  const existing = database
    .prepare("SELECT id FROM applications WHERE candidate_id = ? AND job_id = ?")
    .get(input.candidate_id, input.job_id) as { id?: string } | undefined;
  if (existing) return { ok: false, error: "This candidate is already attached to that job." };

  const application = createApplication({
    organization_id: input.organization_id,
    job_id: input.job_id,
    applicant_name: String(candidate.name ?? ""),
    applicant_email: email,
    applicant_phone: String(candidate.phone ?? ""),
    cover_letter: "",
    resume_filename: String(candidate.resume_filename ?? ""),
    resume_content_type: String(candidate.resume_content_type ?? ""),
    resume_data: (candidate.resume_data as Buffer | null) ?? Buffer.alloc(0),
    resume_skills: parseSkillsJson(candidate.skills),
    applicant_location: String(candidate.location ?? ""),
    source: input.source?.trim() || "manual",
    actor: input.actor,
  });

  return { ok: true, application };
}

/**
 * Single application with its job, org-scoped and without loading the resume
 * BLOB — the shape the candidate detail page needs.
 */
export function getApplicationDetail(
  id: string,
  organizationId: string,
  access?: JobAccess,
): ApplicationWithJob | null {
  const row = getDb()
    .prepare(
      `SELECT a.id, a.organization_id, a.job_id, a.applicant_name, a.applicant_email,
              a.applicant_phone, a.cover_letter, a.resume_filename, a.resume_content_type,
              a.status, a.resume_skills, a.match_score, a.applicant_location, a.desired_pay,
              a.screen_status, a.screen_score, a.risk_level, a.risk_flags, a.screen_summary,
              a.is_demo, a.created_at, j.title AS job_title, j.slug AS job_slug
       FROM applications a
       JOIN jobs j ON j.id = a.job_id
       WHERE a.id = ? AND a.organization_id = ?`,
    )
    .get(id, organizationId) as Record<string, unknown> | undefined;

  if (!row) return null;
  // Deny when the caller may not see this application's job.
  if (access && !canSeeJob(access, row.job_id as string)) return null;
  return {
    ...rowToApplication(row),
    job_title: row.job_title as string,
    job_slug: row.job_slug as string,
  };
}

export function getApplicationResume(
  id: string,
  organizationId: string,
  access?: JobAccess,
): {
  filename: string;
  contentType: string;
  data: Buffer;
} | null {
  const row = getDb()
    .prepare(
      `SELECT job_id, resume_filename, resume_content_type, resume_data
       FROM applications WHERE id = ? AND organization_id = ?`,
    )
    .get(id, organizationId) as
    | { job_id: string; resume_filename: string; resume_content_type: string; resume_data: Buffer }
    | undefined;

  if (!row) return null;
  // Never hand a restricted job's resume to an unauthorized user.
  if (access && !canSeeJob(access, row.job_id)) return null;

  return {
    filename: row.resume_filename,
    contentType: row.resume_content_type,
    data: Buffer.from(row.resume_data),
  };
}

export type ListApplicationsOptions = {
  orderBy?: "recent" | "score";
  /** Max rows to return. Omit for all rows. */
  limit?: number;
  /** Rows to skip (for pagination). Ignored unless `limit` is set. */
  offset?: number;
  /** Filter by knockout verdict: "qualified" | "knockout". Omit for all. */
  screenOutcome?: string;
  /** Only applications that never completed a skills screen (resume-only). */
  resumeOnly?: boolean;
  /** Per-job visibility; omit to return all org applications (internal callers). */
  access?: JobAccess;
};

export function listApplicationsByOrganization(
  organizationId: string,
  options: ListApplicationsOptions = {},
): ApplicationWithJob[] {
  const { orderBy = "recent", limit, offset = 0, screenOutcome, resumeOnly, access } = options;

  // "score" ranks by practical skills-screen score first (nulls last), then
  // resume keyword match, then recency; "recent" is reverse-chronological.
  const ordering =
    orderBy === "score"
      ? "a.screen_score IS NULL, a.screen_score DESC, a.match_score IS NULL, a.match_score DESC, a.created_at DESC"
      : "a.created_at DESC";

  const params: Array<string | number> = [organizationId];
  let whereClause = "";
  if (screenOutcome) {
    whereClause += " AND a.screen_outcome = ?";
    params.push(screenOutcome);
  }
  if (resumeOnly) {
    whereClause += " AND a.screen_status != 'completed'";
  }
  if (access) {
    const vis = hiddenJobsSql(access, "a.job_id");
    whereClause += vis.clause;
    params.push(...vis.params);
  }
  // Hide seeded demo applications from real workspaces (kept in demo mode).
  whereClause += demoFilterSql(organizationId, "a.is_demo");
  let limitClause = "";
  if (limit != null) {
    limitClause = " LIMIT ? OFFSET ?";
    params.push(limit, Math.max(0, offset));
  }

  return getDb()
    .prepare(
      // Explicit columns: never load the resume BLOB or full extracted text into
      // memory for list views — only the small fields the table renders.
      `SELECT a.id, a.organization_id, a.job_id, a.applicant_name, a.applicant_email,
              a.applicant_phone, a.cover_letter, a.resume_filename, a.resume_content_type,
              a.status, a.resume_skills, a.match_score, a.applicant_location, a.desired_pay,
              a.screen_status, a.screen_score, a.screen_outcome, a.risk_level, a.risk_flags, a.screen_summary,
              a.is_demo, a.created_at, j.title AS job_title, j.slug AS job_slug
       FROM applications a
       JOIN jobs j ON j.id = a.job_id
       WHERE a.organization_id = ?${whereClause}
       ORDER BY ${ordering}${limitClause}`,
    )
    .all(...params)
    .map((row) => {
      const application = rowToApplication(row as Record<string, unknown>);
      return {
        ...application,
        job_title: (row as Record<string, unknown>).job_title as string,
        job_slug: (row as Record<string, unknown>).job_slug as string,
      };
    });
}

export function countApplicationsByOrganization(
  organizationId: string,
  screenOutcome?: string,
  access?: JobAccess,
  resumeOnly?: boolean,
): number {
  const vis = access ? hiddenJobsSql(access, "job_id") : { clause: "", params: [] };
  const params: Array<string> = [organizationId];
  let sql = "SELECT COUNT(*) AS count FROM applications WHERE organization_id = ?";
  if (screenOutcome) {
    sql += " AND screen_outcome = ?";
    params.push(screenOutcome);
  }
  if (resumeOnly) {
    sql += " AND screen_status != 'completed'";
  }
  sql += vis.clause;
  params.push(...vis.params);
  sql += demoFilterSql(organizationId);
  const row = getDb().prepare(sql).get(...params) as { count: number };
  return row.count;
}

/** True if a job has at least one application — used for bulk-delete safety. */
export function jobHasApplications(jobId: string): boolean {
  return Boolean(getDb().prepare("SELECT 1 FROM applications WHERE job_id = ? LIMIT 1").get(jobId));
}

/**
 * Returns a count of applications in each pipeline stage for an organization.
 * Stages with no applications are included with a count of 0.
 */
export function getApplicationStatusCounts(
  organizationId: string,
  access?: JobAccess,
): Record<ApplicationStatus, number> {
  const counts: Record<ApplicationStatus, number> = {
    new: 0,
    screening: 0,
    interview: 0,
    offer: 0,
    hired: 0,
    rejected: 0,
  };

  const vis = access ? hiddenJobsSql(access, "job_id") : { clause: "", params: [] };
  const rows = getDb()
    .prepare(
      `SELECT status, COUNT(*) AS count FROM applications WHERE organization_id = ?${vis.clause} GROUP BY status`,
    )
    .all(organizationId, ...vis.params) as Array<{ status: ApplicationStatus; count: number }>;

  for (const row of rows) {
    if (row.status in counts) counts[row.status] = row.count;
  }
  return counts;
}

// Thresholds shared across the intelligence views. Exported so every surface
// (dashboard, queue, ROI, benchmarks) uses one definition and can't drift.
export const STRONG_FIT = 70;
export const REVIEW_FLOOR = 45;

export type ScreeningStats = {
  totalApplicants: number;
  screened: number;
  strongFit: number;
  needsReview: number;
  highRisk: number;
  avgScore: number | null;
  /** Applications that arrived with a resume attached. */
  resumesReceived: number;
  /** Applied with a resume but no completed skills screen yet. */
  resumeOnly: number;
};

/**
 * Manufacturing hiring-intelligence rollup for the dashboard: how many
 * applicants were actually screened, how many are strong-fit, how many need a
 * look, how many are high-risk, and the average practical score.
 */
export function getScreeningStats(organizationId: string, access?: JobAccess): ScreeningStats {
  const db = getDb();
  const total = countApplicationsByOrganization(organizationId, undefined, access);
  const vis = access ? hiddenJobsSql(access, "job_id") : { clause: "", params: [] };

  const row = db
    .prepare(
      `SELECT
         SUM(CASE WHEN screen_status = 'completed' AND screen_score IS NOT NULL THEN 1 ELSE 0 END) AS screened,
         SUM(CASE WHEN screen_status = 'completed' AND screen_score >= ? AND risk_level != 'high' THEN 1 ELSE 0 END) AS strong,
         SUM(CASE WHEN screen_status = 'completed' AND screen_score >= ? AND screen_score < ? THEN 1 ELSE 0 END) AS review,
         SUM(CASE WHEN risk_level = 'high' THEN 1 ELSE 0 END) AS high_risk,
         SUM(CASE WHEN resume_filename IS NOT NULL AND resume_filename != '' THEN 1 ELSE 0 END) AS resumes,
         SUM(CASE WHEN screen_status != 'completed' THEN 1 ELSE 0 END) AS resume_only,
         AVG(CASE WHEN screen_status = 'completed' AND screen_score IS NOT NULL THEN screen_score END) AS avg_score
       FROM applications WHERE organization_id = ?${vis.clause}${demoFilterSql(organizationId)}`,
    )
    .get(STRONG_FIT, REVIEW_FLOOR, STRONG_FIT, organizationId, ...vis.params) as {
    screened: number | null;
    strong: number | null;
    review: number | null;
    high_risk: number | null;
    resumes: number | null;
    resume_only: number | null;
    avg_score: number | null;
  };

  return {
    totalApplicants: total,
    screened: row.screened ?? 0,
    strongFit: row.strong ?? 0,
    needsReview: row.review ?? 0,
    highRisk: row.high_risk ?? 0,
    avgScore: row.avg_score == null ? null : Math.round(row.avg_score),
    resumesReceived: row.resumes ?? 0,
    resumeOnly: row.resume_only ?? 0,
  };
}

/**
 * "Worth a call" count for the dashboard's Call-first card. It must match what
 * the Call Queue page actually lists, which is BOTH sections it renders while
 * still in new/screening: screened candidates that cleared the review floor,
 * PLUS resume-only applicants (a resume on file but no completed screen). Demo
 * rows are excluded outside demo mode so the count matches the page exactly.
 */
export function getCallQueueCount(organizationId: string, access?: JobAccess): number {
  const vis = access ? hiddenJobsSql(access, "job_id") : { clause: "", params: [] };
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS count FROM applications
       WHERE organization_id = ? AND status IN ('new','screening')
         AND (
           (screen_status = 'completed' AND screen_score IS NOT NULL AND screen_score >= ?)
           OR (screen_status != 'completed' AND resume_filename IS NOT NULL AND resume_filename != '')
         )${vis.clause}${demoFilterSql(organizationId)}`,
    )
    .get(organizationId, REVIEW_FLOOR, ...vis.params) as { count: number };
  return row.count;
}

export type JobScreeningSummary = {
  applicants: number;
  completed: number;
  strongFit: number;
  needsReview: number;
  highRisk: number;
  /** Queue-eligible: completed screen ≥ review floor, still new/screening. */
  callsDue: number;
};

/**
 * Per-job screening rollup keyed by job id: applicants, completed screens,
 * strong-fit, and needs-review counts. One grouped query for the whole org.
 */
export function getJobScreeningSummaries(
  organizationId: string,
  access?: JobAccess,
): Record<string, JobScreeningSummary> {
  const vis = access ? hiddenJobsSql(access, "job_id") : { clause: "", params: [] };
  const rows = getDb()
    .prepare(
      `SELECT job_id,
         COUNT(*) AS applicants,
         SUM(CASE WHEN screen_status = 'completed' AND screen_score IS NOT NULL THEN 1 ELSE 0 END) AS completed,
         SUM(CASE WHEN screen_status = 'completed' AND screen_score >= ? AND risk_level != 'high' THEN 1 ELSE 0 END) AS strong,
         SUM(CASE WHEN screen_status = 'completed' AND screen_score >= ? AND screen_score < ? THEN 1 ELSE 0 END) AS review,
         SUM(CASE WHEN risk_level = 'high' THEN 1 ELSE 0 END) AS high_risk,
         SUM(CASE WHEN screen_status = 'completed' AND screen_score >= ? AND status IN ('new','screening') THEN 1 ELSE 0 END) AS calls_due
       FROM applications WHERE organization_id = ?${vis.clause} GROUP BY job_id`,
    )
    .all(STRONG_FIT, REVIEW_FLOOR, STRONG_FIT, REVIEW_FLOOR, organizationId, ...vis.params) as Array<{
    job_id: string;
    applicants: number;
    completed: number;
    strong: number;
    review: number;
    high_risk: number;
    calls_due: number;
  }>;

  const out: Record<string, JobScreeningSummary> = {};
  for (const row of rows) {
    out[row.job_id] = {
      applicants: row.applicants,
      completed: row.completed,
      strongFit: row.strong,
      needsReview: row.review,
      highRisk: row.high_risk,
      callsDue: row.calls_due,
    };
  }
  return out;
}

/**
 * Moves an application to a new pipeline stage. Scoped by organization so one
 * org can never mutate another's records. Returns the updated row, or null if
 * no matching application exists for that organization.
 */
/** Set only the screen status (e.g. "pending" when a screen invite is sent). */
export function setApplicationScreenStatus(
  id: string,
  organizationId: string,
  status: ScreenStatus,
): boolean {
  const result = getDb()
    .prepare("UPDATE applications SET screen_status = ? WHERE id = ? AND organization_id = ?")
    .run(status, id, organizationId);
  return result.changes > 0;
}

/**
 * Write a completed screen's results onto an existing application — the update
 * path the public apply flow never needed (it always creates fresh). Used when
 * an imported candidate completes a token-based skills screen, so the same
 * application powers the profile intelligence, Call Queue, and presentation.
 */
export function updateApplicationScreen(
  id: string,
  organizationId: string,
  input: {
    screen_status: ScreenStatus;
    screen_score: number | null;
    screen_outcome: string;
    risk_level: RiskLevelValue;
    risk_flags: RiskFlagRecord[];
    screen_summary: ScreenSummaryRecord | null;
  },
): boolean {
  const result = getDb()
    .prepare(
      `UPDATE applications SET
         screen_status = @screen_status,
         screen_score = @screen_score,
         screen_outcome = @screen_outcome,
         risk_level = @risk_level,
         risk_flags = @risk_flags,
         screen_summary = @screen_summary
       WHERE id = @id AND organization_id = @org`,
    )
    .run({
      id,
      org: organizationId,
      screen_status: input.screen_status,
      screen_score: input.screen_score,
      screen_outcome: input.screen_outcome,
      risk_level: input.risk_level,
      risk_flags: JSON.stringify(input.risk_flags),
      screen_summary: input.screen_summary ? JSON.stringify(input.screen_summary) : "",
    });
  return result.changes > 0;
}

export function updateApplicationStatus(
  id: string,
  organizationId: string,
  status: ApplicationStatus,
  actor?: string,
): Application | null {
  const database = getDb();
  const previous = database
    .prepare("SELECT status FROM applications WHERE id = ? AND organization_id = ?")
    .get(id, organizationId) as { status: ApplicationStatus } | undefined;
  if (!previous) return null;

  const result = database
    .prepare("UPDATE applications SET status = ? WHERE id = ? AND organization_id = ?")
    .run(status, id, organizationId);

  if (result.changes === 0) return null;

  if (previous.status !== status) {
    recordCandidateEvent({
      organization_id: organizationId,
      application_id: id,
      type: "stage_change",
      detail: `Moved from ${previous.status} to ${status}`,
      actor: actor ?? "",
    });
  }

  return getApplicationById(id);
}

import { randomUUID } from "crypto";
import { getDb, rowToCandidate, type ApplicationStatus, type CandidateRecord, type ScreenStatus } from "./db";
import { getUserById } from "./users";

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Cross-job candidate directory: dedupes applications by email so the same
 * person applying to several roles is one candidate, and supports free-text +
 * skill + stage filtering over the org's applicant pool.
 */

export type CandidateApplication = {
  applicationId: string;
  jobTitle: string;
  jobSlug: string;
  status: ApplicationStatus;
  matchScore: number | null;
  screenScore: number | null;
  screenStatus: ScreenStatus;
  resumeFilename: string;
  createdAt: string;
};

export type Candidate = {
  name: string;
  email: string;
  phone: string;
  skills: string[];
  bestScore: number | null;
  bestScreenScore: number | null;
  lastAppliedAt: string;
  applications: CandidateApplication[];
};

export type CandidateFilters = {
  query?: string;
  skill?: string;
  stage?: ApplicationStatus;
};

type Row = {
  id: string;
  applicant_name: string;
  applicant_email: string;
  applicant_phone: string;
  status: ApplicationStatus;
  match_score: number | null;
  screen_score: number | null;
  screen_status: ScreenStatus;
  resume_filename: string;
  resume_skills: string;
  created_at: string;
  job_title: string;
  job_slug: string;
};

function parseSkills(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Returns deduplicated candidates (by lowercased email) matching the filters,
 * ranked by best match score then most recent application.
 */
export function searchCandidates(organizationId: string, filters: CandidateFilters = {}): Candidate[] {
  const clauses = ["a.organization_id = ?"];
  const params: Array<string> = [organizationId];

  if (filters.query) {
    // Match name, email, or resume text; resume_text is scanned but never selected.
    clauses.push("(a.applicant_name LIKE ? OR a.applicant_email LIKE ? OR a.resume_text LIKE ?)");
    const like = `%${filters.query}%`;
    params.push(like, like, like);
  }
  if (filters.skill) {
    // resume_skills is a JSON array like ["PLC","SCADA"]; match the quoted token.
    clauses.push("a.resume_skills LIKE ?");
    params.push(`%${JSON.stringify(filters.skill).slice(1, -1)}%`);
  }
  if (filters.stage) {
    clauses.push("a.status = ?");
    params.push(filters.stage);
  }

  const rows = getDb()
    .prepare(
      `SELECT a.id, a.applicant_name, a.applicant_email, a.applicant_phone, a.status,
              a.match_score, a.screen_score, a.screen_status, a.resume_filename, a.resume_skills, a.created_at,
              j.title AS job_title, j.slug AS job_slug
       FROM applications a
       JOIN jobs j ON j.id = a.job_id
       WHERE ${clauses.join(" AND ")}
       ORDER BY a.created_at DESC`,
    )
    .all(...params) as Row[];

  const byEmail = new Map<string, Candidate>();

  for (const row of rows) {
    const key = row.applicant_email.trim().toLowerCase();
    const application: CandidateApplication = {
      applicationId: row.id,
      jobTitle: row.job_title,
      jobSlug: row.job_slug,
      status: row.status,
      matchScore: row.match_score,
      screenScore: row.screen_score,
      screenStatus: row.screen_status ?? "none",
      resumeFilename: row.resume_filename,
      createdAt: row.created_at,
    };
    const rowSkills = parseSkills(row.resume_skills);

    const existing = byEmail.get(key);
    if (!existing) {
      // Rows are ordered newest-first, so the first row per email is the latest.
      byEmail.set(key, {
        name: row.applicant_name,
        email: row.applicant_email,
        phone: row.applicant_phone,
        skills: rowSkills,
        bestScore: row.match_score,
        bestScreenScore: row.screen_score,
        lastAppliedAt: row.created_at,
        applications: [application],
      });
      continue;
    }

    existing.applications.push(application);
    for (const skill of rowSkills) {
      if (!existing.skills.includes(skill)) existing.skills.push(skill);
    }
    if (row.match_score != null && (existing.bestScore == null || row.match_score > existing.bestScore)) {
      existing.bestScore = row.match_score;
    }
    if (row.screen_score != null && (existing.bestScreenScore == null || row.screen_score > existing.bestScreenScore)) {
      existing.bestScreenScore = row.screen_score;
    }
  }

  // Rank by best practical skills-screen score first (nulls last), then resume
  // keyword match, then recency.
  return Array.from(byEmail.values()).sort((a, b) => {
    const screenDiff = (b.bestScreenScore ?? -1) - (a.bestScreenScore ?? -1);
    if (screenDiff !== 0) return screenDiff;
    const scoreDiff = (b.bestScore ?? -1) - (a.bestScore ?? -1);
    if (scoreDiff !== 0) return scoreDiff;
    return b.lastAppliedAt.localeCompare(a.lastAppliedAt);
  });
}

/**
 * Distinct skills present across an organization's applicant pool, for a filter
 * dropdown. Sorted alphabetically.
 */
export function getPoolSkills(organizationId: string): string[] {
  const rows = getDb()
    .prepare("SELECT resume_skills FROM applications WHERE organization_id = ?")
    .all(organizationId) as Array<{ resume_skills: string }>;

  const skills = new Set<string>();
  for (const row of rows) {
    for (const skill of parseSkills(row.resume_skills)) skills.add(skill);
  }
  return Array.from(skills).sort((a, b) => a.localeCompare(b));
}

// ─── Persistent candidate (person) entity ──────────────────────────────────

export type CandidateWithApps = CandidateRecord & {
  applications: CandidateApplication[];
  bestScore: number | null;
  bestScreenScore: number | null;
  ownerName: string;
};

/**
 * Insert or update the persistent candidate for (org, email). Called on every
 * application so a person accumulates one profile across jobs. Returns the id.
 */
export function upsertCandidate(input: {
  organization_id: string;
  email: string;
  name: string;
  phone?: string;
  location?: string;
  skills?: string[];
  appliedAt?: string;
}): string {
  const database = getDb();
  const email = input.email.trim().toLowerCase();
  const at = input.appliedAt ?? nowIso();
  const now = nowIso();

  const existing = database
    .prepare("SELECT id, skills FROM candidates WHERE organization_id = ? AND email = ?")
    .get(input.organization_id, email) as { id: string; skills: string } | undefined;

  if (existing) {
    const merged = new Set<string>(parseSkills(existing.skills));
    for (const s of input.skills ?? []) merged.add(s);
    database
      .prepare(
        `UPDATE candidates SET name = ?, phone = ?, location = ?, skills = ?, last_applied_at = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        input.name.trim() || email,
        input.phone?.trim() ?? "",
        input.location?.trim() ?? "",
        JSON.stringify([...merged]),
        at,
        now,
        existing.id,
      );
    return existing.id;
  }

  const id = randomUUID();
  database
    .prepare(
      `INSERT INTO candidates (id, organization_id, email, name, phone, location, skills, tags,
         owner_user_id, first_applied_at, last_applied_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, '[]', '', ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.organization_id,
      email,
      input.name.trim() || email,
      input.phone?.trim() ?? "",
      input.location?.trim() ?? "",
      JSON.stringify(input.skills ?? []),
      at,
      at,
      now,
      now,
    );
  return id;
}

export function getCandidateById(id: string, organizationId: string): CandidateRecord | null {
  const row = getDb()
    .prepare("SELECT * FROM candidates WHERE id = ? AND organization_id = ?")
    .get(id, organizationId);
  return row ? rowToCandidate(row as Record<string, unknown>) : null;
}

function applicationsForCandidate(candidateId: string): CandidateApplication[] {
  const rows = getDb()
    .prepare(
      `SELECT a.id, a.status, a.match_score, a.screen_score, a.screen_status, a.resume_filename, a.created_at,
              j.title AS job_title, j.slug AS job_slug
       FROM applications a JOIN jobs j ON j.id = a.job_id
       WHERE a.candidate_id = ? ORDER BY a.created_at DESC`,
    )
    .all(candidateId) as Array<{
    id: string;
    status: ApplicationStatus;
    match_score: number | null;
    screen_score: number | null;
    screen_status: ScreenStatus;
    resume_filename: string;
    created_at: string;
    job_title: string;
    job_slug: string;
  }>;

  return rows.map((r) => ({
    applicationId: r.id,
    jobTitle: r.job_title,
    jobSlug: r.job_slug,
    status: r.status,
    matchScore: r.match_score,
    screenScore: r.screen_score,
    screenStatus: r.screen_status ?? "none",
    resumeFilename: r.resume_filename,
    createdAt: r.created_at,
  }));
}

function enrich(candidate: CandidateRecord): CandidateWithApps {
  const applications = applicationsForCandidate(candidate.id);
  const bestScore = applications.reduce<number | null>(
    (best, a) => (a.matchScore != null && (best == null || a.matchScore > best) ? a.matchScore : best),
    null,
  );
  const bestScreenScore = applications.reduce<number | null>(
    (best, a) => (a.screenScore != null && (best == null || a.screenScore > best) ? a.screenScore : best),
    null,
  );
  const owner = candidate.owner_user_id ? getUserById(candidate.owner_user_id) : null;
  return { ...candidate, applications, bestScore, bestScreenScore, ownerName: owner?.name ?? "" };
}

export function getCandidateWithApplications(id: string, organizationId: string): CandidateWithApps | null {
  const candidate = getCandidateById(id, organizationId);
  return candidate ? enrich(candidate) : null;
}

/** Table-backed candidate listing with the same filters as the in-memory search. */
export function listCandidates(organizationId: string, filters: CandidateFilters = {}): CandidateWithApps[] {
  const clauses = ["c.organization_id = ?"];
  const params: Array<string> = [organizationId];

  if (filters.query) {
    clauses.push(
      "(c.name LIKE ? OR c.email LIKE ? OR EXISTS (SELECT 1 FROM applications a WHERE a.candidate_id = c.id AND a.resume_text LIKE ?))",
    );
    const like = `%${filters.query}%`;
    params.push(like, like, like);
  }
  if (filters.skill) {
    clauses.push("c.skills LIKE ?");
    params.push(`%${JSON.stringify(filters.skill).slice(1, -1)}%`);
  }
  if (filters.stage) {
    clauses.push("EXISTS (SELECT 1 FROM applications a WHERE a.candidate_id = c.id AND a.status = ?)");
    params.push(filters.stage);
  }

  const rows = getDb()
    .prepare(`SELECT c.* FROM candidates c WHERE ${clauses.join(" AND ")} ORDER BY c.last_applied_at DESC`)
    .all(...params) as Array<Record<string, unknown>>;

  return rows
    .map((row) => enrich(rowToCandidate(row)))
    .sort((a, b) => {
      const screenDiff = (b.bestScreenScore ?? -1) - (a.bestScreenScore ?? -1);
      if (screenDiff !== 0) return screenDiff;
      const scoreDiff = (b.bestScore ?? -1) - (a.bestScore ?? -1);
      if (scoreDiff !== 0) return scoreDiff;
      return b.last_applied_at.localeCompare(a.last_applied_at);
    });
}

/** Replace a candidate's tags (trimmed, de-duplicated, capped). */
export function setCandidateTags(id: string, organizationId: string, tags: string[]): boolean {
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const raw of tags) {
    const t = String(raw).trim().slice(0, 40);
    const key = t.toLowerCase();
    if (t && !seen.has(key)) {
      seen.add(key);
      clean.push(t);
    }
    if (clean.length >= 25) break;
  }
  const result = getDb()
    .prepare("UPDATE candidates SET tags = ?, updated_at = ? WHERE id = ? AND organization_id = ?")
    .run(JSON.stringify(clean), nowIso(), id, organizationId);
  return result.changes > 0;
}

/** Assign (or clear, with "") the owning recruiter. */
export function setCandidateOwner(id: string, organizationId: string, ownerUserId: string): boolean {
  const result = getDb()
    .prepare("UPDATE candidates SET owner_user_id = ?, updated_at = ? WHERE id = ? AND organization_id = ?")
    .run(ownerUserId, nowIso(), id, organizationId);
  return result.changes > 0;
}

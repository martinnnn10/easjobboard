import { getDb, type ApplicationStatus, type ScreenStatus } from "./db";

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

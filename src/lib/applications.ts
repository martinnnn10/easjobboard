import { randomUUID } from "crypto";
import { getDb, rowToApplication, type Application, type ApplicationStatus } from "./db";

function nowIso(): string {
  return new Date().toISOString();
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
}): Application {
  const database = getDb();
  const id = randomUUID();

  database
    .prepare(
      `INSERT INTO applications (
        id, organization_id, job_id, applicant_name, applicant_email, applicant_phone,
        cover_letter, resume_filename, resume_content_type, resume_data,
        resume_text, resume_skills, match_score, created_at
      ) VALUES (
        @id, @organization_id, @job_id, @applicant_name, @applicant_email, @applicant_phone,
        @cover_letter, @resume_filename, @resume_content_type, @resume_data,
        @resume_text, @resume_skills, @match_score, @created_at
      )`,
    )
    .run({
      id,
      organization_id: input.organization_id,
      job_id: input.job_id,
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
      created_at: nowIso(),
    });

  return getApplicationById(id)!;
}

export function getApplicationById(id: string): Application | null {
  const row = getDb().prepare("SELECT * FROM applications WHERE id = ?").get(id);
  return row ? rowToApplication(row as Record<string, unknown>) : null;
}

export function getApplicationResume(id: string, organizationId: string): {
  filename: string;
  contentType: string;
  data: Buffer;
} | null {
  const row = getDb()
    .prepare(
      `SELECT resume_filename, resume_content_type, resume_data
       FROM applications WHERE id = ? AND organization_id = ?`,
    )
    .get(id, organizationId) as
    | { resume_filename: string; resume_content_type: string; resume_data: Buffer }
    | undefined;

  if (!row) return null;

  return {
    filename: row.resume_filename,
    contentType: row.resume_content_type,
    data: Buffer.from(row.resume_data),
  };
}

export function listApplicationsByOrganization(
  organizationId: string,
  orderBy: "recent" | "score" = "recent",
): ApplicationWithJob[] {
  // "score" surfaces the best-matching candidates first (nulls last); "recent"
  // keeps reverse-chronological order for the dashboard feed.
  const ordering =
    orderBy === "score"
      ? "a.match_score IS NULL, a.match_score DESC, a.created_at DESC"
      : "a.created_at DESC";

  return getDb()
    .prepare(
      // Explicit columns: never load the resume BLOB or full extracted text into
      // memory for list views — only the small fields the table renders.
      `SELECT a.id, a.organization_id, a.job_id, a.applicant_name, a.applicant_email,
              a.applicant_phone, a.cover_letter, a.resume_filename, a.resume_content_type,
              a.status, a.resume_skills, a.match_score, a.created_at,
              j.title AS job_title, j.slug AS job_slug
       FROM applications a
       JOIN jobs j ON j.id = a.job_id
       WHERE a.organization_id = ?
       ORDER BY ${ordering}`,
    )
    .all(organizationId)
    .map((row) => {
      const application = rowToApplication(row as Record<string, unknown>);
      return {
        ...application,
        job_title: (row as Record<string, unknown>).job_title as string,
        job_slug: (row as Record<string, unknown>).job_slug as string,
      };
    });
}

export function countApplicationsByOrganization(organizationId: string): number {
  const row = getDb()
    .prepare("SELECT COUNT(*) AS count FROM applications WHERE organization_id = ?")
    .get(organizationId) as { count: number };
  return row.count;
}

/**
 * Returns a count of applications in each pipeline stage for an organization.
 * Stages with no applications are included with a count of 0.
 */
export function getApplicationStatusCounts(
  organizationId: string,
): Record<ApplicationStatus, number> {
  const counts: Record<ApplicationStatus, number> = {
    new: 0,
    screening: 0,
    interview: 0,
    offer: 0,
    hired: 0,
    rejected: 0,
  };

  const rows = getDb()
    .prepare(
      "SELECT status, COUNT(*) AS count FROM applications WHERE organization_id = ? GROUP BY status",
    )
    .all(organizationId) as Array<{ status: ApplicationStatus; count: number }>;

  for (const row of rows) {
    if (row.status in counts) counts[row.status] = row.count;
  }
  return counts;
}

/**
 * Moves an application to a new pipeline stage. Scoped by organization so one
 * org can never mutate another's records. Returns the updated row, or null if
 * no matching application exists for that organization.
 */
export function updateApplicationStatus(
  id: string,
  organizationId: string,
  status: ApplicationStatus,
): Application | null {
  const result = getDb()
    .prepare("UPDATE applications SET status = ? WHERE id = ? AND organization_id = ?")
    .run(status, id, organizationId);

  if (result.changes === 0) return null;
  return getApplicationById(id);
}

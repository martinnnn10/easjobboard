import { randomUUID } from "crypto";
import { getDb, rowToApplication, type Application } from "./db";

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
}): Application {
  const database = getDb();
  const id = randomUUID();

  database
    .prepare(
      `INSERT INTO applications (
        id, organization_id, job_id, applicant_name, applicant_email, applicant_phone,
        cover_letter, resume_filename, resume_content_type, resume_data, created_at
      ) VALUES (
        @id, @organization_id, @job_id, @applicant_name, @applicant_email, @applicant_phone,
        @cover_letter, @resume_filename, @resume_content_type, @resume_data, @created_at
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

export function listApplicationsByOrganization(organizationId: string): ApplicationWithJob[] {
  return getDb()
    .prepare(
      `SELECT a.*, j.title AS job_title, j.slug AS job_slug
       FROM applications a
       JOIN jobs j ON j.id = a.job_id
       WHERE a.organization_id = ?
       ORDER BY a.created_at DESC`,
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

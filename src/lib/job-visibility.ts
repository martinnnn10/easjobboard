import { randomUUID } from "crypto";
import { getDb } from "./db";
import { canManageTeam } from "./roles";

/**
 * Per-job access control.
 *
 * A job is "restricted" when it has one or more rows in job_visible_users; only
 * those users — plus owners and the job's creator — may see its applications and
 * resumes. A job with no rows is visible to everyone in the org (this is the
 * backward-compatible default for all pre-existing jobs).
 *
 * We model access as the (usually tiny) set of jobs a given user CANNOT see and
 * filter reads with `AND job_id NOT IN (...)`. Listing hidden jobs rather than
 * visible ones keeps the IN-list small — most jobs are unrestricted — and avoids
 * SQLite's bound-parameter ceiling.
 */
export type JobAccess = { unrestricted: true } | { unrestricted: false; hiddenJobIds: Set<string> };

type SessionUser = { id: string; role: string };

/** Resolve which jobs are hidden from this user. Owners see everything. */
export function getJobAccess(organizationId: string, user: SessionUser): JobAccess {
  if (canManageTeam(user.role)) return { unrestricted: true };

  const rows = getDb()
    .prepare(
      `SELECT j.id FROM jobs j
       WHERE j.organization_id = ?
         AND EXISTS (SELECT 1 FROM job_visible_users v WHERE v.job_id = j.id)
         AND j.created_by != ?
         AND NOT EXISTS (SELECT 1 FROM job_visible_users v WHERE v.job_id = j.id AND v.user_id = ?)`,
    )
    .all(organizationId, user.id, user.id) as Array<{ id: string }>;

  return { unrestricted: false, hiddenJobIds: new Set(rows.map((r) => r.id)) };
}

/** True when the user may see the given job's applications/resumes. */
export function canSeeJob(access: JobAccess, jobId: string): boolean {
  return access.unrestricted || !access.hiddenJobIds.has(jobId);
}

/**
 * SQL fragment (+ bound params) constraining a job_id column to the visible set,
 * e.g. `AND a.job_id NOT IN (?, ?)`. Empty when nothing is hidden.
 */
export function hiddenJobsSql(access: JobAccess, column: string): { clause: string; params: string[] } {
  if (access.unrestricted || access.hiddenJobIds.size === 0) return { clause: "", params: [] };
  const ids = [...access.hiddenJobIds];
  return { clause: ` AND ${column} NOT IN (${ids.map(() => "?").join(", ")})`, params: ids };
}

/**
 * SQL fragment (+ params) for candidate inclusion: a candidate is visible if
 * they have no applications (sourced) OR at least one application to a job the
 * user can see. Empty when nothing is hidden.
 */
export function visibleCandidateSql(
  access: JobAccess,
  candidateIdColumn: string,
): { clause: string; params: string[] } {
  if (access.unrestricted || access.hiddenJobIds.size === 0) return { clause: "", params: [] };
  const ids = [...access.hiddenJobIds];
  const placeholders = ids.map(() => "?").join(", ");
  const clause =
    ` AND (NOT EXISTS (SELECT 1 FROM applications a WHERE a.candidate_id = ${candidateIdColumn})` +
    ` OR EXISTS (SELECT 1 FROM applications a WHERE a.candidate_id = ${candidateIdColumn} AND a.job_id NOT IN (${placeholders})))`;
  return { clause, params: ids };
}

/** The user ids explicitly granted access to a job (for the edit form). */
export function getJobVisibleUserIds(jobId: string): string[] {
  const rows = getDb()
    .prepare("SELECT user_id FROM job_visible_users WHERE job_id = ?")
    .all(jobId) as Array<{ user_id: string }>;
  return rows.map((r) => r.user_id);
}

/**
 * Replace a job's visibility allowlist. `selectedUserIds` are the checked
 * members. If every org member is selected, store NO rows (unrestricted, visible
 * to all including future members). Otherwise store the explicit subset. Owners
 * and the creator always retain access via role / created_by, so they don't need
 * to be stored — but storing them is harmless.
 */
export function setJobVisibleUsers(input: {
  organizationId: string;
  jobId: string;
  selectedUserIds: string[];
  allOrgUserIds: string[];
}): void {
  const db = getDb();
  const orgSet = new Set(input.allOrgUserIds);
  const selected = [...new Set(input.selectedUserIds)].filter((id) => orgSet.has(id));

  db.prepare("DELETE FROM job_visible_users WHERE job_id = ? AND organization_id = ?").run(
    input.jobId,
    input.organizationId,
  );

  // Everyone selected ⇒ leave unrestricted (no rows).
  if (selected.length >= orgSet.size) return;

  const now = new Date().toISOString();
  const stmt = db.prepare(
    "INSERT OR IGNORE INTO job_visible_users (id, organization_id, job_id, user_id, created_at) VALUES (?, ?, ?, ?, ?)",
  );
  const insertAll = db.transaction((ids: string[]) => {
    for (const uid of ids) stmt.run(randomUUID(), input.organizationId, input.jobId, uid, now);
  });
  insertAll(selected);
}

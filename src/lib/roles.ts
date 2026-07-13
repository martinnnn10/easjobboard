/**
 * Role-based access control.
 *
 * - owner: full control incl. team management and org settings.
 * - recruiter: manage jobs, applicants, outreach; download resumes. No team mgmt.
 * - viewer: read-only. Cannot mutate anything or download resumes (PII).
 */
export type Role = "owner" | "recruiter" | "viewer";

export const ROLES: Role[] = ["owner", "recruiter", "viewer"];

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  recruiter: "Recruiter",
  viewer: "Viewer (read-only)",
};

export function isRole(value: unknown): value is Role {
  return value === "owner" || value === "recruiter" || value === "viewer";
}

function normalize(role: string): Role {
  return isRole(role) ? role : "viewer";
}

/** Manage teammates, roles, and org settings. */
export function canManageTeam(role: string): boolean {
  return normalize(role) === "owner";
}

/** Create/edit/delete jobs, change applicant status, add notes, send outreach. */
export function canWrite(role: string): boolean {
  const r = normalize(role);
  return r === "owner" || r === "recruiter";
}

/** Download resume files (personally identifiable information). */
export function canViewResumes(role: string): boolean {
  return canWrite(role);
}

/**
 * Role-based permissions. Kept free of server/DB imports so both API routes,
 * server pages, and client components can share the same checks.
 *
 * - admin     — full access, plus managing the team (invite/revoke/change roles).
 * - recruiter — use the product: post jobs, review/move candidates, email, source.
 * - viewer    — read-only: can see everything, can't change anything.
 */

export type Role = "admin" | "recruiter" | "viewer";

export const ROLES: Role[] = ["admin", "recruiter", "viewer"];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  recruiter: "Recruiter",
  viewer: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: "Full access, including managing the team.",
  recruiter: "Post jobs, review and move candidates, email, and source. No team management.",
  viewer: "Read-only — can see jobs, candidates, and the pipeline, but can't make changes.",
};

/** Unknown/invalid role strings resolve to the least-privileged role. */
export function normalizeRole(value: string | null | undefined): Role {
  return value === "admin" || value === "recruiter" || value === "viewer" ? value : "viewer";
}

/** Can create/edit jobs, change pipeline stages, email, add notes, source. */
export function canWrite(role: string): boolean {
  return role === "admin" || role === "recruiter";
}

/** Can invite/revoke teammates, change roles, and org-level settings. */
export function canManageTeam(role: string): boolean {
  return role === "admin";
}

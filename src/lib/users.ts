import { randomBytes, randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { getDb, rowToUser, type User } from "./db";

function nowIso(): string {
  return new Date().toISOString();
}

/** A readable, URL-safe temporary password for emailed teammate invites. */
export function generateTempPassword(): string {
  return randomBytes(9).toString("base64url");
}

export function getUserById(id: string): User | null {
  const row = getDb().prepare("SELECT * FROM users WHERE id = ?").get(id);
  return row ? rowToUser(row as Record<string, unknown>) : null;
}

export function getUserByEmail(email: string): User | null {
  const row = getDb().prepare("SELECT * FROM users WHERE email = ?").get(email.trim().toLowerCase());
  return row ? rowToUser(row as Record<string, unknown>) : null;
}

export function createUser(input: {
  organization_id: string;
  email: string;
  password: string;
  name: string;
  role?: string;
}): User {
  const database = getDb();
  const id = randomUUID();
  const passwordHash = bcrypt.hashSync(input.password, 10);

  database
    .prepare(
      `INSERT INTO users (id, organization_id, email, password_hash, name, role, sessions_valid_after, created_at)
       VALUES (@id, @organization_id, @email, @password_hash, @name, @role, '', @created_at)`,
    )
    .run({
      id,
      organization_id: input.organization_id,
      email: input.email.trim().toLowerCase(),
      password_hash: passwordHash,
      name: input.name.trim(),
      role: input.role ?? "owner",
      created_at: nowIso(),
    });

  return getUserById(id)!;
}

/** Update a teammate's role (org-scoped). */
export function updateUserRole(userId: string, organizationId: string, role: string): boolean {
  const result = getDb()
    .prepare("UPDATE users SET role = ? WHERE id = ? AND organization_id = ?")
    .run(role, userId, organizationId);
  return result.changes > 0;
}

/** Remove a teammate (org-scoped). */
export function deleteUser(userId: string, organizationId: string): boolean {
  const result = getDb()
    .prepare("DELETE FROM users WHERE id = ? AND organization_id = ?")
    .run(userId, organizationId);
  return result.changes > 0;
}

/**
 * Revoke outstanding sessions by advancing the cutoff to now: for one user, or
 * (when userId is omitted) every member of the org.
 */
export function revokeSessions(organizationId: string, userId?: string): void {
  const now = nowIso();
  const database = getDb();
  if (userId) {
    database
      .prepare("UPDATE users SET sessions_valid_after = ? WHERE id = ? AND organization_id = ?")
      .run(now, userId, organizationId);
  } else {
    database
      .prepare("UPDATE users SET sessions_valid_after = ? WHERE organization_id = ?")
      .run(now, organizationId);
  }
}

/** Number of owners in an org — used to prevent removing/demoting the last owner. */
export function countOwners(organizationId: string): number {
  const row = getDb()
    .prepare("SELECT COUNT(*) AS count FROM users WHERE organization_id = ? AND role = 'owner'")
    .get(organizationId) as { count: number };
  return row.count;
}

export async function verifyUserPassword(user: User, password: string): Promise<boolean> {
  return bcrypt.compare(password, user.password_hash);
}

export function listUsersByOrganization(organizationId: string): User[] {
  return getDb()
    .prepare("SELECT * FROM users WHERE organization_id = ? ORDER BY created_at ASC")
    .all(organizationId)
    .map((row) => rowToUser(row as Record<string, unknown>));
}

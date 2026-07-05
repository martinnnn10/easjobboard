import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { getDb, rowToUser, type User } from "./db";

function nowIso(): string {
  return new Date().toISOString();
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
}): User {
  const database = getDb();
  const id = randomUUID();
  const passwordHash = bcrypt.hashSync(input.password, 10);

  database
    .prepare(
      `INSERT INTO users (id, organization_id, email, password_hash, name, created_at)
       VALUES (@id, @organization_id, @email, @password_hash, @name, @created_at)`,
    )
    .run({
      id,
      organization_id: input.organization_id,
      email: input.email.trim().toLowerCase(),
      password_hash: passwordHash,
      name: input.name.trim(),
      created_at: nowIso(),
    });

  return getUserById(id)!;
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

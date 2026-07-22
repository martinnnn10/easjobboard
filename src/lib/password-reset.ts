import { createHash, randomBytes } from "crypto";
import { getDb } from "./db";
import type { User } from "./db";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function nowIso(): string {
  return new Date().toISOString();
}

/** We store only the hash of a token, never the token itself. */
function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Issue a single-use, 1-hour password-reset token for a user. Returns the RAW
 * token (emailed to the user); only its SHA-256 is persisted. Any of the user's
 * prior unused tokens are cleared so only the newest link works.
 */
export function createPasswordResetToken(user: User): string {
  const db = getDb();
  db.prepare("DELETE FROM password_reset_tokens WHERE user_id = ? AND used_at = ''").run(user.id);
  const rawToken = randomBytes(32).toString("hex");
  db.prepare(
    `INSERT INTO password_reset_tokens (token_hash, user_id, organization_id, expires_at, used_at, created_at)
     VALUES (@hash, @user, @org, @expires, '', @now)`,
  ).run({
    hash: hashToken(rawToken),
    user: user.id,
    org: user.organization_id,
    expires: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
    now: nowIso(),
  });
  return rawToken;
}

/**
 * Validate + consume a reset token. Returns the target user/org on success and
 * marks the token used (single-use); returns null if the token is unknown,
 * already used, or expired.
 */
export function consumePasswordResetToken(
  rawToken: string,
): { userId: string; organizationId: string } | null {
  if (!rawToken || typeof rawToken !== "string") return null;
  const db = getDb();
  const row = db
    .prepare("SELECT user_id, organization_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash = ?")
    .get(hashToken(rawToken)) as
    | { user_id: string; organization_id: string; expires_at: string; used_at: string }
    | undefined;

  if (!row) return null;
  if (row.used_at) return null;
  if (Date.parse(row.expires_at) < Date.now()) return null;

  const marked = db
    .prepare("UPDATE password_reset_tokens SET used_at = ? WHERE token_hash = ? AND used_at = ''")
    .run(nowIso(), hashToken(rawToken));
  if (marked.changes === 0) return null; // lost a race — already consumed

  return { userId: row.user_id, organizationId: row.organization_id };
}

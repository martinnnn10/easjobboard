import { randomBytes, randomUUID } from "crypto";
import { getDb } from "./db";
import { createUser, getUserByEmail } from "./users";
import type { User } from "./db";

/**
 * Team invitations. An admin invites a teammate by email; a random token maps to
 * a pending invite that, when accepted, creates a user in the same organization.
 * The data model was already multi-user (users.organization_id) — this adds the
 * join flow on top.
 */

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export type Invite = {
  id: string;
  organizationId: string;
  email: string;
  token: string;
  invitedBy: string;
  status: "pending" | "accepted" | "revoked";
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
};

function rowToInvite(row: Record<string, unknown>): Invite {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    email: row.email as string,
    token: row.token as string,
    invitedBy: (row.invited_by as string) ?? "",
    status: row.status as Invite["status"],
    createdAt: row.created_at as string,
    expiresAt: row.expires_at as string,
    acceptedAt: (row.accepted_at as string | null) ?? null,
  };
}

export function createInvite(input: {
  organizationId: string;
  email: string;
  invitedBy: string;
}): Invite {
  const db = getDb();
  const email = input.email.trim().toLowerCase();
  const now = new Date();

  // Re-use / refresh any existing pending invite for the same email+org so we
  // don't pile up duplicates.
  const existing = db
    .prepare("SELECT * FROM invites WHERE organization_id = ? AND email = ? AND status = 'pending'")
    .get(input.organizationId, email) as Record<string, unknown> | undefined;

  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(now.getTime() + INVITE_TTL_MS).toISOString();

  if (existing) {
    db.prepare("UPDATE invites SET token = ?, invited_by = ?, created_at = ?, expires_at = ? WHERE id = ?").run(
      token,
      input.invitedBy,
      now.toISOString(),
      expiresAt,
      existing.id as string,
    );
    return getInviteById(existing.id as string)!;
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO invites (id, organization_id, email, token, invited_by, status, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
  ).run(id, input.organizationId, email, token, input.invitedBy, now.toISOString(), expiresAt);
  return getInviteById(id)!;
}

export function getInviteById(id: string): Invite | null {
  const row = getDb().prepare("SELECT * FROM invites WHERE id = ?").get(id);
  return row ? rowToInvite(row as Record<string, unknown>) : null;
}

export function getInviteByToken(token: string): Invite | null {
  const row = getDb().prepare("SELECT * FROM invites WHERE token = ?").get(token);
  return row ? rowToInvite(row as Record<string, unknown>) : null;
}

export function listInvitesByOrg(organizationId: string): Invite[] {
  return (
    getDb()
      .prepare("SELECT * FROM invites WHERE organization_id = ? ORDER BY created_at DESC")
      .all(organizationId) as Record<string, unknown>[]
  ).map(rowToInvite);
}

export function revokeInvite(id: string, organizationId: string): boolean {
  const result = getDb()
    .prepare("UPDATE invites SET status = 'revoked' WHERE id = ? AND organization_id = ? AND status = 'pending'")
    .run(id, organizationId);
  return result.changes > 0;
}

export type AcceptResult =
  | { ok: false; error: string }
  | { ok: true; user: User; organizationId: string };

/** Validates a token and creates the teammate's account in the invite's org. */
export function acceptInvite(input: { token: string; name: string; password: string }): AcceptResult {
  const invite = getInviteByToken(input.token);
  if (!invite || invite.status !== "pending") {
    return { ok: false, error: "This invitation is no longer valid." };
  }
  if (new Date(invite.expiresAt).getTime() < Date.now()) {
    return { ok: false, error: "This invitation has expired. Ask your admin to send a new one." };
  }
  if (!input.name.trim()) return { ok: false, error: "Please enter your name." };
  if (input.password.length < 8) return { ok: false, error: "Password must be at least 8 characters." };
  if (getUserByEmail(invite.email)) {
    return { ok: false, error: "An account already exists for this email. Try signing in instead." };
  }

  const user = createUser({
    organization_id: invite.organizationId,
    email: invite.email,
    password: input.password,
    name: input.name,
  });

  getDb()
    .prepare("UPDATE invites SET status = 'accepted', accepted_at = ? WHERE id = ?")
    .run(new Date().toISOString(), invite.id);

  return { ok: true, user, organizationId: invite.organizationId };
}

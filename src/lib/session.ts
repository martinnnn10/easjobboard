import { getAuthSecret } from "./env";

const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type SessionData = {
  userId: string;
  orgId: string;
  orgSlug: string;
};

async function signPayload(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function encodePayload(data: SessionData): string {
  return `user:${data.userId}:${data.orgId}:${data.orgSlug}:${Date.now()}`;
}

function decodePayload(payload: string): SessionData | null {
  const match = payload.match(/^user:([^:]+):([^:]+):([^:]+):(\d+)$/);
  if (!match) return null;

  const issuedAt = Number(match[4]);
  if (Date.now() - issuedAt >= SESSION_MAX_AGE_MS) return null;

  return {
    userId: match[1],
    orgId: match[2],
    orgSlug: match[3],
  };
}

export async function createSessionToken(data: SessionData): Promise<string> {
  const payload = encodePayload(data);
  return `${payload}.${await signPayload(payload, getAuthSecret())}`;
}

export async function parseSessionToken(token: string | undefined): Promise<SessionData | null> {
  if (!token) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  if (signature !== (await signPayload(payload, getAuthSecret()))) return null;

  return decodePayload(payload);
}

export async function verifySessionForOrg(
  token: string | undefined,
  orgSlug: string,
): Promise<SessionData | null> {
  const session = await parseSessionToken(token);
  if (!session || session.orgSlug !== orgSlug) return null;
  return session;
}

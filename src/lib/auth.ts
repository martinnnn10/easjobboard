import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getOrganizationById } from "./organizations";
import { getUserById } from "./users";
import { createSessionToken, parseSessionToken, verifySessionForOrg, type SessionData } from "./session";

const SESSION_COOKIE = "eas_recruit_session";
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export { createSessionToken, parseSessionToken, verifySessionForOrg };
export type { SessionData };

type OrgSessionResult = {
  session: SessionData;
  user: NonNullable<Awaited<ReturnType<typeof getUserById>>>;
  organization: NonNullable<Awaited<ReturnType<typeof getOrganizationById>>>;
};

export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  return parseSessionToken(token);
}

/**
 * True when the token was issued before the user's revocation cutoff — i.e. an
 * admin (or the user) has since "signed out all sessions".
 */
function isSessionRevoked(
  user: NonNullable<Awaited<ReturnType<typeof getUserById>>>,
  session: SessionData,
): boolean {
  if (!user.sessions_valid_after) return false;
  const cutoff = Date.parse(user.sessions_valid_after);
  return Number.isFinite(cutoff) && session.issuedAt < cutoff;
}

/**
 * Non-redirecting session check for the public auth pages. Returns the fully
 * validated session (user + org still exist and the token isn't revoked) or
 * null. Lets /login, /signup, and org admin login bounce an already
 * authenticated user to their dashboard instead of re-showing the form.
 */
export async function getVerifiedSession(): Promise<OrgSessionResult | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = await parseSessionToken(token);
  if (!session) return null;

  const user = getUserById(session.userId);
  const organization = getOrganizationById(session.orgId);
  if (!user || !organization || isSessionRevoked(user, session)) return null;

  return { session, user, organization };
}

/**
 * For use in Server Components (pages). Redirects to login if unauthorized.
 */
export async function requireOrgSession(orgSlug: string): Promise<OrgSessionResult> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = await verifySessionForOrg(token, orgSlug);

  if (!session) {
    redirect(`/o/${orgSlug}/admin/login`);
  }

  const user = getUserById(session.userId);
  const organization = getOrganizationById(session.orgId);

  if (!user || !organization || organization.slug !== orgSlug || isSessionRevoked(user, session)) {
    redirect(`/o/${orgSlug}/admin/login`);
  }

  return { session, user, organization };
}

/**
 * For use in API routes. Throws an error if unauthorized (caller catches and returns 401).
 */
export async function requireOrgSessionApi(orgSlug: string): Promise<OrgSessionResult> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = await verifySessionForOrg(token, orgSlug);

  if (!session) {
    throw new Error("UNAUTHORIZED");
  }

  const user = getUserById(session.userId);
  const organization = getOrganizationById(session.orgId);

  if (!user || !organization || organization.slug !== orgSlug || isSessionRevoked(user, session)) {
    throw new Error("UNAUTHORIZED");
  }

  return { session, user, organization };
}

/**
 * API guard: require the caller to belong to the org AND satisfy a capability
 * predicate (from lib/roles). Throws "UNAUTHORIZED" (401) or "FORBIDDEN" (403).
 */
export async function requireOrgCapability(
  orgSlug: string,
  can: (role: string) => boolean,
): Promise<OrgSessionResult> {
  const result = await requireOrgSessionApi(orgSlug);
  if (!can(result.user.role)) {
    throw new Error("FORBIDDEN");
  }
  return result;
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.BASE_URL?.startsWith("https://") ?? false,
    path: "/",
    maxAge: SESSION_MAX_AGE_MS / 1000,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

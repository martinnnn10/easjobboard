import { NextResponse } from "next/server";
import { consumePasswordResetToken } from "@/lib/password-reset";
import { getClientIp } from "@/lib/rate-limit";
import { durableRateLimit } from "@/lib/rate-limit-db";
import { revokeSessions, setUserPassword } from "@/lib/users";

export const runtime = "nodejs";

// Durable limit: 10 submission attempts per IP per 15 minutes.
const RESET_LIMIT = 10;
const RESET_WINDOW_MS = 15 * 60 * 1000;

/**
 * Complete a password reset: validate + consume the single-use token, set the
 * new password, and revoke the user's existing sessions so a compromised
 * session can't outlive the reset. Additive — no changes to login/session code.
 */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = durableRateLimit(`reset-ip:${ip}`, RESET_LIMIT, RESET_WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { token?: unknown; password?: unknown };
  const token = typeof body.token === "string" ? body.token : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const result = consumePasswordResetToken(token);
  if (!result) {
    return NextResponse.json(
      { error: "This reset link is invalid or has expired. Request a new one." },
      { status: 400 },
    );
  }

  try {
    setUserPassword(result.userId, password);
    // Invalidate any outstanding sessions for this user.
    revokeSessions(result.organizationId, result.userId);
  } catch (error) {
    console.error("Password reset completion failed:", error);
    return NextResponse.json({ error: "Could not reset your password. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

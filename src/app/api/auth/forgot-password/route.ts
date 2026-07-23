import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { getPublicBaseUrl } from "@/lib/env";
import { isEmailConfigured, sendPasswordResetEmail } from "@/lib/email";
import { createPasswordResetToken } from "@/lib/password-reset";
import { durableRateLimit } from "@/lib/rate-limit-db";
import { getClientIp } from "@/lib/rate-limit";
import { getUserByEmail } from "@/lib/users";

export const runtime = "nodejs";

// Durable (PM2-restart-surviving) limit: 3 requests per email+IP per hour.
const FORGOT_LIMIT = 3;
const FORGOT_WINDOW_MS = 60 * 60 * 1000;

/** Opaque bucket key — the raw email is hashed, never stored or logged. */
function bucketKey(scope: string, value: string): string {
  return `${scope}:${createHash("sha256").update(value).digest("hex").slice(0, 32)}`;
}

/**
 * Start a password reset. Always returns a generic success — we never reveal
 * whether an email is registered (anti-enumeration). A link is emailed only
 * when the address matches a user and SMTP is configured. Rate-limited durably
 * by email+IP so the endpoint can't be used to blast reset mail or probe.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { email?: unknown };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const ip = getClientIp(request);

  // Limit by IP and (when present) email — both durable, fixed-window.
  const ipLimit = durableRateLimit(bucketKey("forgot-ip", ip), FORGOT_LIMIT * 3, FORGOT_WINDOW_MS);
  const emailLimit = email ? durableRateLimit(bucketKey("forgot-email", `${email}|${ip}`), FORGOT_LIMIT, FORGOT_WINDOW_MS) : { allowed: true, retryAfterSeconds: 0 };
  if (!ipLimit.allowed || !emailLimit.allowed) {
    const retry = Math.max(ipLimit.retryAfterSeconds, emailLimit.retryAfterSeconds || 0);
    // Anti-enumeration: same generic message; 429 only signals throttling, not
    // whether the address exists.
    return NextResponse.json(
      { ok: true, message: "If an account exists for that email, we've sent a reset link." },
      { status: 429, headers: { "Retry-After": String(retry) } },
    );
  }

  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    try {
      const user = getUserByEmail(email);
      if (user && isEmailConfigured()) {
        const token = createPasswordResetToken(user);
        const resetUrl = `${getPublicBaseUrl()}/reset-password?token=${token}`;
        await sendPasswordResetEmail({ to: user.email, name: user.name, resetUrl });
      }
    } catch (error) {
      // Never surface internal state to the caller; just log.
      console.error("Password reset request failed:", error);
    }
  }

  return NextResponse.json({
    ok: true,
    message: "If an account exists for that email, we've sent a reset link.",
  });
}

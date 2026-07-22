import { NextResponse } from "next/server";
import { getPublicBaseUrl } from "@/lib/env";
import { isEmailConfigured, sendPasswordResetEmail } from "@/lib/email";
import { createPasswordResetToken } from "@/lib/password-reset";
import { getUserByEmail } from "@/lib/users";

export const runtime = "nodejs";

/**
 * Start a password reset. Always returns a generic success — we never reveal
 * whether an email is registered (anti-enumeration). A link is emailed only
 * when the address matches a user and SMTP is configured.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { email?: unknown };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

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

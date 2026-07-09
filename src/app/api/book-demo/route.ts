import { NextResponse } from "next/server";
import { createDemoRequest } from "@/lib/demo-requests";
import { sendDemoRequestNotification } from "@/lib/email";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const LIMIT = 5;
const WINDOW_MS = 60 * 60 * 1000;

/** Public "Book a demo" submission — stores the request and notifies the team. */
export async function POST(request: Request) {
  try {
    const limit = rateLimit(`book-demo:${getClientIp(request)}`, LIMIT, WINDOW_MS);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
      );
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim();
    const company = String(body.company ?? "").trim();
    const role = String(body.role ?? "").trim();
    const challenge = String(body.challenge ?? "").trim();
    const notes = String(body.notes ?? "").trim();

    if (!name || !email) {
      return NextResponse.json({ error: "Name and work email are required." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Please enter a valid work email." }, { status: 400 });
    }

    createDemoRequest({ name, email, company, role, challenge, notes });
    // Best-effort notification — never blocks the confirmation.
    await sendDemoRequestNotification({ name, email, company, role, challenge, notes }).catch((err) =>
      console.error("Demo request email failed:", err),
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Book-demo failed:", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";

/**
 * Map the errors thrown by the auth guards to HTTP responses. Returns null for
 * anything else so callers can fall through to their own handling.
 */
export function authErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof Error && error.message === "FORBIDDEN") {
    return NextResponse.json({ error: "You don't have permission to do that." }, { status: 403 });
  }
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

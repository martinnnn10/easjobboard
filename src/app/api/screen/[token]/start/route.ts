import { NextResponse } from "next/server";
import { getInviteByToken, markInviteStarted } from "@/lib/screen-invites";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ token: string }> };

/**
 * Beacon fired by the candidate screen form the moment they begin answering —
 * gives a "Started" funnel signal distinct from "Opened" (page load). No login:
 * the token is the credential. Idempotent and side-effect-free beyond the
 * timestamp; never returns invite contents.
 */
export async function POST(_request: Request, context: RouteContext) {
  const { token } = await context.params;
  const invite = getInviteByToken(token);
  if (invite && invite.status === "pending") {
    markInviteStarted(token);
  }
  // Always 204 — never reveal whether the token is valid.
  return new NextResponse(null, { status: 204 });
}

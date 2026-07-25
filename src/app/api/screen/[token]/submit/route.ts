import { NextResponse } from "next/server";
import { getCandidateById } from "@/lib/candidates";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { getInviteByToken, recordScreenCompletion } from "@/lib/screen-invites";
import type { ScreenAnswers } from "@/lib/screen-scoring";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ token: string }> };

// Blunt token-guessing / spam even though tokens are unguessable (192 bits).
const SUBMIT_RATE_LIMIT = 20;
const SUBMIT_RATE_WINDOW_MS = 10 * 60 * 1000;

function answeredCount(answers: ScreenAnswers): number {
  return Object.values(answers).filter(
    (v) => v !== "" && v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0),
  ).length;
}

/**
 * Public submission for a token-based skills screen. No login: the token is the
 * credential. Scores the answers, folds the result onto the candidate's
 * application, and marks the invite completed. Rejects expired/completed tokens
 * so there are no duplicate submissions.
 */
export async function POST(request: Request, context: RouteContext) {
  const { token } = await context.params;

  const limit = rateLimit(`screen-submit:${getClientIp(request)}`, SUBMIT_RATE_LIMIT, SUBMIT_RATE_WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const invite = getInviteByToken(token);
  if (!invite) {
    return NextResponse.json({ error: "This screening link is invalid." }, { status: 404 });
  }
  if (invite.status === "expired") {
    return NextResponse.json({ error: "This screening link has expired." }, { status: 410 });
  }
  if (invite.status === "completed") {
    return NextResponse.json({ error: "This screen has already been completed." }, { status: 409 });
  }

  const body = (await request.json().catch(() => ({}))) as { answers?: unknown };
  let answers: ScreenAnswers = {};
  if (body.answers && typeof body.answers === "object" && !Array.isArray(body.answers)) {
    answers = body.answers as ScreenAnswers;
  }
  if (answeredCount(answers) === 0) {
    return NextResponse.json({ error: "Please answer at least one question before submitting." }, { status: 400 });
  }

  try {
    const candidate = getCandidateById(invite.candidate_id, invite.organization_id);
    await recordScreenCompletion(invite, answers, candidate?.name || "Candidate");
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Screen submission failed:", error);
    return NextResponse.json({ error: "We couldn't record your screen. Please try again." }, { status: 500 });
  }
}

import { randomBytes, randomUUID } from "crypto";
import {
  getApplicationById,
  updateApplicationScreen,
} from "./applications";
import {
  assessRisk,
  deriveRecommendedAction,
  deriveScoreConfidence,
  type ScreenSummary,
} from "./candidate-intel";
import { recordCandidateEvent } from "./candidate-events";
import { getDb } from "./db";
import { getJobById } from "./jobs";
import { evaluateKnockout, scoreScreen, type ScreenAnswers } from "./screen-scoring";
import { saveScreenSubmission } from "./screen-submissions";

export type ScreenInviteStatus = "pending" | "completed" | "expired";

export type ScreenInvite = {
  id: string;
  organization_id: string;
  candidate_id: string;
  job_id: string;
  application_id: string;
  screen_key: string;
  token: string;
  status: ScreenInviteStatus;
  source: string;
  message: string;
  sent_by: string;
  sent_at: string;
  started_at: string;
  completed_at: string;
  expires_at: string;
  created_at: string;
};

function rowToInvite(row: Record<string, unknown>): ScreenInvite {
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    candidate_id: row.candidate_id as string,
    job_id: (row.job_id as string | undefined) ?? "",
    application_id: (row.application_id as string | undefined) ?? "",
    screen_key: row.screen_key as string,
    token: row.token as string,
    status: (row.status as ScreenInviteStatus | undefined) ?? "pending",
    source: (row.source as string | undefined) ?? "manual",
    message: (row.message as string | undefined) ?? "",
    sent_by: (row.sent_by as string | undefined) ?? "",
    sent_at: (row.sent_at as string | undefined) ?? "",
    started_at: (row.started_at as string | undefined) ?? "",
    completed_at: (row.completed_at as string | undefined) ?? "",
    expires_at: (row.expires_at as string | undefined) ?? "",
    created_at: row.created_at as string,
  };
}

/** Unguessable, URL-safe token (32 chars). */
function newToken(): string {
  return randomBytes(24).toString("base64url");
}

export function createScreenInvite(input: {
  organization_id: string;
  candidate_id: string;
  job_id: string;
  application_id: string;
  screen_key: string;
  source?: string;
  message?: string;
  sent_by?: string;
  expires_at?: string;
}): ScreenInvite {
  const db = getDb();
  const id = randomUUID();
  const now = new Date().toISOString();
  const token = newToken();
  db.prepare(
    `INSERT INTO screen_invites (
       id, organization_id, candidate_id, job_id, application_id, screen_key,
       token, status, source, message, sent_by, sent_at, completed_at, expires_at, created_at
     ) VALUES (
       @id, @organization_id, @candidate_id, @job_id, @application_id, @screen_key,
       @token, 'pending', @source, @message, @sent_by, @now, '', @expires_at, @now
     )`,
  ).run({
    id,
    organization_id: input.organization_id,
    candidate_id: input.candidate_id,
    job_id: input.job_id,
    application_id: input.application_id,
    screen_key: input.screen_key,
    token,
    source: input.source ?? "manual",
    message: input.message ?? "",
    sent_by: input.sent_by ?? "",
    expires_at: input.expires_at ?? "",
    now,
  });
  return getInviteById(id)!;
}

export function getInviteById(id: string): ScreenInvite | null {
  const row = getDb().prepare("SELECT * FROM screen_invites WHERE id = ?").get(id);
  return row ? rowToInvite(row as Record<string, unknown>) : null;
}

/**
 * Look up an invite by its public token. Tokens are globally unique so this
 * needs no org context (that's the whole point of the public page). Applies a
 * lazy expiry: a still-pending invite past its expires_at is reported expired.
 */
export function getInviteByToken(token: string): ScreenInvite | null {
  if (!token) return null;
  const row = getDb().prepare("SELECT * FROM screen_invites WHERE token = ?").get(token);
  if (!row) return null;
  const invite = rowToInvite(row as Record<string, unknown>);
  if (invite.status === "pending" && invite.expires_at && invite.expires_at <= new Date().toISOString()) {
    getDb().prepare("UPDATE screen_invites SET status = 'expired' WHERE id = ?").run(invite.id);
    return { ...invite, status: "expired" };
  }
  return invite;
}

/** Invites for a candidate, newest first — drives the profile's screen state. */
export function getInvitesForCandidate(candidateId: string, organizationId: string): ScreenInvite[] {
  const rows = getDb()
    .prepare("SELECT * FROM screen_invites WHERE candidate_id = ? AND organization_id = ? ORDER BY sent_at DESC")
    .all(candidateId, organizationId) as Array<Record<string, unknown>>;
  return rows.map(rowToInvite);
}

/** Invites for a job, newest first — drives the job command center funnel. */
export function getInvitesForJob(jobId: string, organizationId: string): ScreenInvite[] {
  const rows = getDb()
    .prepare("SELECT * FROM screen_invites WHERE job_id = ? AND organization_id = ? ORDER BY sent_at DESC")
    .all(jobId, organizationId) as Array<Record<string, unknown>>;
  return rows.map(rowToInvite);
}

/**
 * Stamp the moment a candidate first opened their screen link (once). Never
 * changes status or touches a completed invite — purely a funnel signal.
 */
export function markInviteStarted(token: string): void {
  getDb()
    .prepare(
      "UPDATE screen_invites SET started_at = ? WHERE token = ? AND started_at = '' AND status = 'pending'",
    )
    .run(new Date().toISOString(), token);
}

/**
 * Score a completed screen and fold the result onto the invite's application —
 * the same derivation the public apply flow uses, so the candidate's profile
 * intelligence, Call Queue ranking, and client presentation all light up.
 * Returns the overall score (null if scoring produced nothing).
 */
export async function recordScreenCompletion(
  invite: ScreenInvite,
  answers: ScreenAnswers,
  actor = "Candidate",
): Promise<{ score: number | null }> {
  const application = invite.application_id ? getApplicationById(invite.application_id) : null;
  const job = invite.job_id ? getJobById(invite.job_id) : null;

  const screenResult = await scoreScreen(invite.screen_key, answers).catch(() => null);
  const screenScore = screenResult?.overallScore ?? null;
  const screenStatus = "completed" as const;
  let screenOutcome = "";
  if (screenResult) {
    const verdict = evaluateKnockout(invite.screen_key, screenResult);
    screenOutcome = verdict.qualified ? "qualified" : "knockout";
  }

  const candidateIsLead = false; // imported candidates carry no resume text here
  // assessRisk needs a job shape for the pay/commute checks; fall back to an
  // empty posting when the job was deleted so scoring still degrades cleanly.
  const jobForRisk = job ?? { salary_max: 0, salary_min: 0, city: "", state: "", location: "" };
  const risk = assessRisk({
    job: jobForRisk,
    desiredPay: application?.desired_pay ?? "",
    applicantLocation: application?.applicant_location ?? "",
    resumeText: "",
    screenScore,
    jobIsLeadRole: invite.screen_key === "maintenance_leader",
    candidateIsLead,
  });

  let screenSummary: ScreenSummary;
  if (screenResult) {
    const openAnswers = screenResult.perAnswer.filter((a) => a.type === "short_answer" || a.type === "scenario");
    const avgOpenWords =
      openAnswers.length === 0
        ? 0
        : openAnswers.reduce((sum, a) => sum + a.answerText.split(/\s+/).filter(Boolean).length, 0) /
          openAnswers.length;
    const confidence = deriveScoreConfidence({
      answeredCount: screenResult.answeredCount,
      totalCount: screenResult.totalCount,
      method: screenResult.method,
      avgOpenWords,
      hasOpenQuestions: openAnswers.length > 0,
    });
    screenSummary = {
      strengths: screenResult.strengths,
      redFlags: screenResult.redFlags,
      recommendedAction: deriveRecommendedAction(screenScore, screenStatus, risk.level),
      strongDims: screenResult.strongDims,
      weakDims: screenResult.weakDims,
      method: screenResult.method,
      confidence: confidence.level,
    };
  } else {
    screenSummary = {
      strengths: [],
      redFlags: [],
      recommendedAction: deriveRecommendedAction(screenScore, screenStatus, risk.level),
      strongDims: [],
      weakDims: [],
      method: "heuristic",
    };
  }

  if (application) {
    updateApplicationScreen(application.id, invite.organization_id, {
      screen_status: screenStatus,
      screen_score: screenScore,
      screen_outcome: screenOutcome,
      risk_level: risk.level,
      risk_flags: risk.flags,
      screen_summary: screenSummary,
    });
    if (screenResult && job) {
      saveScreenSubmission({
        organizationId: invite.organization_id,
        applicationId: application.id,
        jobId: job.id,
        screenKey: invite.screen_key,
        answers,
        result: screenResult,
      });
    }
  }

  getDb()
    .prepare("UPDATE screen_invites SET status = 'completed', completed_at = ? WHERE id = ? AND status != 'completed'")
    .run(new Date().toISOString(), invite.id);

  recordCandidateEvent({
    organization_id: invite.organization_id,
    candidate_id: invite.candidate_id,
    application_id: application?.id,
    type: "note",
    detail:
      screenScore !== null
        ? `Skills screen completed — scored ${screenScore}/100`
        : "Skills screen completed",
    actor,
  });

  return { score: screenScore };
}

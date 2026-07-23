/**
 * Screening funnel + outcome metrics for the job command center (Deploy 21).
 * Funnel counts come from screen_invites (sent → started → completed → expired);
 * outcome counts come from completed screens on the job's applications — so both
 * invited candidates and public applicants who took the screen are reflected.
 */
import { getDb } from "./db";
import { getInvitesForJob } from "./screen-invites";

/** Score thresholds mirror the scoring engine's STRONG/WEAK bands. */
const STRONG = 70;
const WEAK = 45;

export type JobScreeningMetrics = {
  invited: number;
  delivered: number;
  opened: number;
  started: number;
  completed: number;
  pending: number;
  expired: number;
  failed: number;
  scored: number;
  averageScore: number | null;
  strongFit: number;
  review: number;
  highRisk: number;
};

export function getJobScreeningMetrics(jobId: string, orgId: string): JobScreeningMetrics {
  const invites = getInvitesForJob(jobId, orgId);
  const invited = invites.length;
  const completed = invites.filter((i) => i.status === "completed").length;
  // Opened = loaded the page; Started = began answering — kept distinct.
  const opened = invites.filter((i) => i.status === "completed" || i.opened_at || i.started_at).length;
  const started = invites.filter((i) => i.status === "completed" || i.started_at).length;
  const delivered = invites.filter((i) => i.delivered_at).length;
  const failed = invites.filter((i) => i.failed_at && !i.delivered_at && i.status !== "completed").length;
  const expired = invites.filter((i) => i.status === "expired").length;
  const pending = invites.filter((i) => i.status === "pending").length;

  const rows = getDb()
    .prepare(
      `SELECT screen_score AS score, screen_outcome AS outcome
       FROM applications
       WHERE job_id = ? AND organization_id = ? AND screen_status = 'completed' AND screen_score IS NOT NULL`,
    )
    .all(jobId, orgId) as Array<{ score: number | null; outcome: string }>;

  let strongFit = 0;
  let review = 0;
  let highRisk = 0;
  let sum = 0;
  let scored = 0;
  for (const r of rows) {
    if (r.score == null) continue;
    scored++;
    sum += r.score;
    const knockout = r.outcome === "knockout";
    if (knockout || r.score < WEAK) highRisk++;
    else if (r.score >= STRONG) strongFit++;
    else review++;
  }

  return {
    invited,
    delivered,
    opened,
    started,
    completed,
    pending,
    expired,
    failed,
    scored,
    averageScore: scored === 0 ? null : Math.round(sum / scored),
    strongFit,
    review,
    highRisk,
  };
}

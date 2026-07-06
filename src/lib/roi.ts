import { getDb } from "./db";

/**
 * The renewal number. Converts screening data already stored into hours and
 * dollars saved: every completed screen that came back a clear reject or a
 * high-risk applicant is an interview the team did NOT have to run blind. No
 * competing ATS can tell a plant manager "you avoided 47 interview-hours /
 * $4,700" — because it never tested anyone. Deterministic SQL, no LLM.
 */

// Conservative, defensible assumptions: one loaded panel-hour per interview.
const HOURS_PER_INTERVIEW = 1;
const DOLLARS_PER_HOUR = 100;
// A completed screen below this, or flagged high-risk, is a wasted interview avoided.
const WASTE_THRESHOLD = 45;

export type RoiStats = {
  screensCompleted: number;
  interviewsAvoided: number;
  hoursSaved: number;
  dollarsSaved: number;
  /** Share of completed screens the screen filtered out before a human looked. */
  filterRatePercent: number;
};

export function getRoiStats(organizationId: string): RoiStats {
  const row = getDb()
    .prepare(
      `SELECT
         SUM(CASE WHEN screen_status = 'completed' AND screen_score IS NOT NULL THEN 1 ELSE 0 END) AS completed,
         SUM(CASE WHEN screen_status = 'completed' AND screen_score IS NOT NULL
                   AND (screen_score < ? OR risk_level = 'high') THEN 1 ELSE 0 END) AS avoided
       FROM applications WHERE organization_id = ?`,
    )
    .get(WASTE_THRESHOLD, organizationId) as { completed: number | null; avoided: number | null };

  const screensCompleted = row.completed ?? 0;
  const interviewsAvoided = row.avoided ?? 0;
  const hoursSaved = interviewsAvoided * HOURS_PER_INTERVIEW;
  const dollarsSaved = hoursSaved * DOLLARS_PER_HOUR;
  const filterRatePercent =
    screensCompleted === 0 ? 0 : Math.round((interviewsAvoided / screensCompleted) * 100);

  return { screensCompleted, interviewsAvoided, hoursSaved, dollarsSaved, filterRatePercent };
}

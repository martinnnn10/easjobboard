import { getDb } from "./db";
import { hiddenJobsSql, type JobAccess } from "./job-visibility";

/**
 * Role percentile benchmarking. A raw 0–100 screen score means little without a
 * reference class — and a generic ATS has no reference class because it has no
 * test. Here every score is norm-referenced against the accumulated pool of
 * everyone who took the same screen_key in this org, turning "78" into a rank a
 * hiring manager can defend ("top 12% of 143 maintenance-tech applicants").
 *
 * The pool compounds with every applicant, so this is a data moat that cannot
 * exist without owning the screen. Deterministic — one COUNT query, no LLM.
 */

// Below this sample size, a percentile is noise — say so instead of lying.
const MIN_POOL = 8;

export type ScoreBenchmark = {
  /** Number of completed screens for this screen_key in the org. */
  pool: number;
  /** "top X%" — the share of the pool this score beats or ties. Null if pool too small. */
  topPercent: number | null;
  /** True when the pool is too small for a meaningful percentile. */
  early: boolean;
};

/**
 * Where `score` ranks within all completed submissions for `screenKey`.
 * topPercent = 100 − percentile-rank, so a high score → a small "top X%".
 */
export function getScoreBenchmark(
  organizationId: string,
  screenKey: string,
  score: number | null,
  access?: JobAccess,
): ScoreBenchmark {
  if (score === null || !screenKey) return { pool: 0, topPercent: null, early: true };

  const vis = access ? hiddenJobsSql(access, "job_id") : { clause: "", params: [] };
  const row = getDb()
    .prepare(
      `SELECT
         COUNT(*) AS pool,
         SUM(CASE WHEN overall_score < ? THEN 1 ELSE 0 END) AS below,
         SUM(CASE WHEN overall_score = ? THEN 1 ELSE 0 END) AS tied
       FROM screen_submissions
       WHERE organization_id = ? AND screen_key = ? AND overall_score IS NOT NULL${vis.clause}`,
    )
    .get(score, score, organizationId, screenKey, ...vis.params) as {
    pool: number;
    below: number | null;
    tied: number | null;
  };

  const pool = row.pool ?? 0;
  if (pool < MIN_POOL) return { pool, topPercent: null, early: true };

  // Tie-aware (midpoint) percentile rank: ties split so a modal/average score
  // isn't misreported as "top of the field".
  const percentileRank = Math.round((((row.below ?? 0) + (row.tied ?? 0) / 2) / pool) * 100);
  const topPercent = Math.max(1, 100 - percentileRank);
  return { pool, topPercent, early: false };
}

export function benchmarkLabel(benchmark: ScoreBenchmark): string {
  if (benchmark.early) return benchmark.pool > 0 ? `Early — only ${benchmark.pool} screened` : "First to be screened";
  return `Top ${benchmark.topPercent}% of ${benchmark.pool}`;
}

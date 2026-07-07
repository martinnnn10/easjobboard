import { getDb } from "./db";
import { getApplicationStatusCounts, getJobScreeningSummaries, getScreeningStats, STRONG_FIT } from "./applications";
import { listJobsByOrganization } from "./jobs";

/**
 * Recruiting-ops rollups for the Reports page. Everything is derived from real
 * rows — where there's no data yet, callers show an honest empty state rather
 * than a fabricated number.
 */

export type SourceRow = { source: string; applicants: number; strongFit: number };
export type RoleScoreRow = { job: string; avgScore: number; screened: number };

export type ReportData = {
  totalApplicants: number;
  screened: number;
  screenCompletionRate: number | null; // % of applications with a completed screen
  strongFit: number;
  needsReview: number;
  highRisk: number;
  avgScore: number | null;
  bySource: SourceRow[];
  avgScoreByRole: RoleScoreRow[];
  callsLogged: number;
  timeToFirstContactDays: number | null;
  submittedToHM: number;
  inInterview: number;
  hired: number;
  openRolesNoStrong: number;
  openPublishedRoles: number;
};

export function getReportData(organizationId: string): ReportData {
  const db = getDb();
  const stats = getScreeningStats(organizationId);
  const statusCounts = getApplicationStatusCounts(organizationId);

  const totalApplications = db
    .prepare("SELECT COUNT(*) AS c FROM applications WHERE organization_id = ?")
    .get(organizationId) as { c: number };
  const completed = db
    .prepare("SELECT COUNT(*) AS c FROM applications WHERE organization_id = ? AND screen_status = 'completed'")
    .get(organizationId) as { c: number };
  const screenCompletionRate =
    totalApplications.c === 0 ? null : Math.round((completed.c / totalApplications.c) * 100);

  // Applicants by candidate source, with how many are strong-fit (a completed
  // screen at/above the strong bar and not high-risk on any application).
  const sourceRows = db
    .prepare(
      `SELECT c.source AS source, COUNT(*) AS applicants,
              SUM(
                CASE WHEN EXISTS (
                  SELECT 1 FROM applications a
                  WHERE a.candidate_id = c.id AND a.screen_status = 'completed'
                    AND a.screen_score >= ? AND a.risk_level != 'high'
                ) THEN 1 ELSE 0 END
              ) AS strong
       FROM candidates c
       WHERE c.organization_id = ?
       GROUP BY c.source
       ORDER BY applicants DESC`,
    )
    .all(STRONG_FIT, organizationId) as Array<{ source: string; applicants: number; strong: number | null }>;
  const bySource: SourceRow[] = sourceRows.map((r) => ({
    source: r.source || "unknown",
    applicants: r.applicants,
    strongFit: r.strong ?? 0,
  }));

  // Average completed skills score per role.
  const jobs = listJobsByOrganization(organizationId);
  const roleRows = db
    .prepare(
      `SELECT job_id, AVG(screen_score) AS avg, COUNT(*) AS n
       FROM applications
       WHERE organization_id = ? AND screen_status = 'completed' AND screen_score IS NOT NULL
       GROUP BY job_id`,
    )
    .all(organizationId) as Array<{ job_id: string; avg: number; n: number }>;
  const jobTitle = new Map(jobs.map((j) => [j.id, j.title]));
  const avgScoreByRole: RoleScoreRow[] = roleRows
    .map((r) => ({ job: jobTitle.get(r.job_id) ?? "—", avgScore: Math.round(r.avg), screened: r.n }))
    .sort((a, b) => b.avgScore - a.avgScore);

  const callsLogged = (
    db
      .prepare("SELECT COUNT(*) AS c FROM candidate_events WHERE organization_id = ? AND type = 'call'")
      .get(organizationId) as { c: number }
  ).c;

  const submittedToHM = (
    db
      .prepare(
        "SELECT COUNT(*) AS c FROM candidate_events WHERE organization_id = ? AND type = 'call' AND detail LIKE '%Submitted to hiring manager%'",
      )
      .get(organizationId) as { c: number }
  ).c;

  // Time to first contact: for each candidate who has been contacted, the gap
  // between their first application and their first logged call/email. Averaged.
  const contactRows = db
    .prepare(
      `SELECT a.candidate_id AS cid,
              MIN(a.created_at) AS applied_at,
              (SELECT MIN(e.created_at) FROM candidate_events e
                 WHERE e.candidate_id = a.candidate_id AND e.type IN ('call','email_sent')) AS first_contact
       FROM applications a
       WHERE a.organization_id = ? AND a.candidate_id != ''
       GROUP BY a.candidate_id`,
    )
    .all(organizationId) as Array<{ cid: string; applied_at: string; first_contact: string | null }>;
  const gaps: number[] = [];
  for (const row of contactRows) {
    if (!row.first_contact) continue;
    const applied = Date.parse(row.applied_at);
    const contacted = Date.parse(row.first_contact);
    if (!Number.isFinite(applied) || !Number.isFinite(contacted) || contacted < applied) continue;
    gaps.push((contacted - applied) / 86_400_000);
  }
  const timeToFirstContactDays =
    gaps.length === 0 ? null : Math.round((gaps.reduce((s, g) => s + g, 0) / gaps.length) * 10) / 10;

  const jobSummaries = getJobScreeningSummaries(organizationId);
  const publishedJobs = jobs.filter((j) => j.status === "published");
  const openRolesNoStrong = publishedJobs.filter((j) => (jobSummaries[j.id]?.strongFit ?? 0) === 0).length;

  return {
    totalApplicants: stats.totalApplicants,
    screened: stats.screened,
    screenCompletionRate,
    strongFit: stats.strongFit,
    needsReview: stats.needsReview,
    highRisk: stats.highRisk,
    avgScore: stats.avgScore,
    bySource,
    avgScoreByRole,
    callsLogged,
    timeToFirstContactDays,
    submittedToHM,
    inInterview: statusCounts.interview,
    hired: statusCounts.hired,
    openRolesNoStrong,
    openPublishedRoles: publishedJobs.length,
  };
}

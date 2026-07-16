import { getDb } from "./db";
import { getJobScreeningSummaries, REVIEW_FLOOR, STRONG_FIT } from "./applications";
import { canSeeJob, hiddenJobsSql, type JobAccess } from "./job-visibility";
import { listJobsByOrganization } from "./jobs";

/**
 * Recruiting-ops rollups for the Reports page. Everything is derived from real
 * rows — where there's no data yet, callers show an honest empty state rather
 * than a fabricated number.
 *
 * An optional date range filters every activity-based metric on a consistent
 * `created_at` predicate (applications, screens, calls, interviews), so the
 * whole report answers "what happened in this window". Pipeline snapshots
 * (in-interview, hired) are current-state by nature and are labelled as such.
 */

export type DateRange = { from?: string; to?: string };

export type RangePreset = "all" | "last_7" | "last_30" | "this_month" | "last_month" | "custom";

export const RANGE_PRESETS: { key: RangePreset; label: string }[] = [
  { key: "last_7", label: "Last 7 days" },
  { key: "last_30", label: "Last 30 days" },
  { key: "this_month", label: "This month" },
  { key: "last_month", label: "Last month" },
  { key: "all", label: "All time" },
];

export function isRangePreset(v: string | undefined): v is RangePreset {
  return v === "all" || v === "last_7" || v === "last_30" || v === "this_month" || v === "last_month" || v === "custom";
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

/**
 * Turn a preset (or custom from/to date strings) into an ISO date range plus a
 * human label. `now` is injected so callers stay deterministic/testable.
 */
export function resolveRange(
  preset: RangePreset,
  from: string | undefined,
  to: string | undefined,
  now: Date,
): { range: DateRange; label: string } {
  switch (preset) {
    case "last_7": {
      const start = startOfDay(new Date(now.getTime() - 6 * 86_400_000));
      return { range: { from: start.toISOString() }, label: "Last 7 days" };
    }
    case "last_30": {
      const start = startOfDay(new Date(now.getTime() - 29 * 86_400_000));
      return { range: { from: start.toISOString() }, label: "Last 30 days" };
    }
    case "this_month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { range: { from: start.toISOString() }, label: "This month" };
    }
    case "last_month": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
      return { range: { from: start.toISOString(), to: end.toISOString() }, label: "Last month" };
    }
    case "custom": {
      const range: DateRange = {};
      const f = from ? new Date(`${from}T00:00:00`) : null;
      const t = to ? new Date(`${to}T00:00:00`) : null;
      if (f && !Number.isNaN(f.getTime())) range.from = startOfDay(f).toISOString();
      if (t && !Number.isNaN(t.getTime())) range.to = endOfDay(t).toISOString();
      const label =
        range.from || range.to
          ? `${from || "start"} → ${to || "now"}`
          : "All time";
      return { range, label };
    }
    default:
      return { range: {}, label: "All time" };
  }
}

export type SourceRow = { source: string; applicants: number; strongFit: number };
export type RoleScoreRow = { job: string; avgScore: number; screened: number };
/** Applications grouped by the apply-link attribution channel (?source=…). */
export type ChannelRow = { channel: string; label: string; applicants: number; strongFit: number };

/** Buyer-facing labels for the apply-link source channels. */
const CHANNEL_LABELS: Record<string, string> = {
  direct: "Direct / careers page",
  careers: "Careers page",
  google_jobs: "Google Jobs",
  indeed: "Indeed",
  linkedin: "LinkedIn",
  ziprecruiter: "ZipRecruiter",
  qr: "QR code",
  flyer: "Flyer",
};

function channelLabel(channel: string): string {
  return CHANNEL_LABELS[channel] ?? channel.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export type ReportData = {
  totalApplicants: number;
  screened: number;
  screenCompletionRate: number | null; // % of applications with a completed screen
  strongFit: number;
  needsReview: number;
  highRisk: number;
  avgScore: number | null;
  bySource: SourceRow[];
  byChannel: ChannelRow[];
  avgScoreByRole: RoleScoreRow[];
  callsLogged: number;
  timeToFirstContactDays: number | null;
  submittedToHM: number;
  interviewsScheduled: number;
  inInterview: number;
  hired: number;
  openRolesNoStrong: number;
  openPublishedRoles: number;
};

/** Build a reusable `col BETWEEN ...` fragment + params for the given range. */
function rangeClause(column: string, range: DateRange): { sql: string; params: string[] } {
  const parts: string[] = [];
  const params: string[] = [];
  if (range.from) {
    parts.push(`${column} >= ?`);
    params.push(range.from);
  }
  if (range.to) {
    parts.push(`${column} <= ?`);
    params.push(range.to);
  }
  return { sql: parts.length ? ` AND ${parts.join(" AND ")}` : "", params };
}

export function getReportData(organizationId: string, range: DateRange = {}, access?: JobAccess): ReportData {
  const db = getDb();

  const appRange = rangeClause("created_at", range);
  const evtRange = rangeClause("created_at", range);
  // Exclude restricted jobs the viewer can't see from every job-tied rollup.
  const vis = access ? hiddenJobsSql(access, "job_id") : { clause: "", params: [] };

  // Funnel + quality, computed straight from applications so the date window
  // applies uniformly. Mirrors getScreeningStats' definitions of strong/review.
  const funnel = db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN screen_status = 'completed' AND screen_score IS NOT NULL THEN 1 ELSE 0 END) AS screened,
         SUM(CASE WHEN screen_status = 'completed' AND screen_score >= ? AND risk_level != 'high' THEN 1 ELSE 0 END) AS strong,
         SUM(CASE WHEN screen_status = 'completed' AND screen_score >= ? AND screen_score < ? THEN 1 ELSE 0 END) AS review,
         SUM(CASE WHEN risk_level = 'high' THEN 1 ELSE 0 END) AS high_risk,
         AVG(CASE WHEN screen_status = 'completed' AND screen_score IS NOT NULL THEN screen_score END) AS avg_score
       FROM applications
       WHERE organization_id = ?${appRange.sql}${vis.clause}`,
    )
    .get(STRONG_FIT, REVIEW_FLOOR, STRONG_FIT, organizationId, ...appRange.params, ...vis.params) as {
    total: number | null;
    screened: number | null;
    strong: number | null;
    review: number | null;
    high_risk: number | null;
    avg_score: number | null;
  };

  const totalApplicants = funnel.total ?? 0;
  const screened = funnel.screened ?? 0;
  const screenCompletionRate = totalApplicants === 0 ? null : Math.round((screened / totalApplicants) * 100);

  // Applicants by candidate source (added within the window), with how many are
  // strong-fit on any of their applications.
  const srcRange = rangeClause("c.created_at", range);
  const sourceRows = db
    .prepare(
      `SELECT c.source AS source, COUNT(*) AS applicants,
              SUM(
                CASE WHEN EXISTS (
                  SELECT 1 FROM applications a
                  WHERE a.candidate_id = c.id AND a.screen_status = 'completed'
                    AND a.screen_score >= ? AND a.risk_level != 'high'${hiddenJobsSql(access ?? { unrestricted: true }, "a.job_id").clause}
                ) THEN 1 ELSE 0 END
              ) AS strong
       FROM candidates c
       WHERE c.organization_id = ?${srcRange.sql}
       GROUP BY c.source
       ORDER BY applicants DESC`,
    )
    .all(
      STRONG_FIT,
      ...hiddenJobsSql(access ?? { unrestricted: true }, "a.job_id").params,
      organizationId,
      ...srcRange.params,
    ) as Array<{
    source: string;
    applicants: number;
    strong: number | null;
  }>;
  const bySource: SourceRow[] = sourceRows.map((r) => ({
    source: r.source || "unknown",
    applicants: r.applicants,
    strongFit: r.strong ?? 0,
  }));

  // Applications grouped by the apply-link attribution channel (?source=…),
  // scoped to the window and the jobs this viewer may see. Empty attribution
  // (a direct apply) rolls up as "direct".
  const channelRows = db
    .prepare(
      `SELECT COALESCE(NULLIF(apply_source, ''), 'direct') AS channel,
              COUNT(*) AS applicants,
              SUM(CASE WHEN screen_status = 'completed' AND screen_score >= ? AND risk_level != 'high' THEN 1 ELSE 0 END) AS strong
       FROM applications
       WHERE organization_id = ?${appRange.sql}${vis.clause}
       GROUP BY channel
       ORDER BY applicants DESC`,
    )
    .all(STRONG_FIT, organizationId, ...appRange.params, ...vis.params) as Array<{
    channel: string;
    applicants: number;
    strong: number | null;
  }>;
  const byChannel: ChannelRow[] = channelRows.map((r) => ({
    channel: r.channel,
    label: channelLabel(r.channel),
    applicants: r.applicants,
    strongFit: r.strong ?? 0,
  }));

  // Average completed skills score per role (screens in the window). Restrict to
  // jobs the viewer may see so restricted job titles never surface here.
  const jobs = listJobsByOrganization(organizationId).filter((j) => !access || canSeeJob(access, j.id));
  const roleRows = db
    .prepare(
      `SELECT job_id, AVG(screen_score) AS avg, COUNT(*) AS n
       FROM applications
       WHERE organization_id = ? AND screen_status = 'completed' AND screen_score IS NOT NULL${appRange.sql}${vis.clause}
       GROUP BY job_id`,
    )
    .all(organizationId, ...appRange.params, ...vis.params) as Array<{ job_id: string; avg: number; n: number }>;
  const jobTitle = new Map(jobs.map((j) => [j.id, j.title]));
  const avgScoreByRole: RoleScoreRow[] = roleRows
    .map((r) => ({ job: jobTitle.get(r.job_id) ?? "—", avgScore: Math.round(r.avg), screened: r.n }))
    .sort((a, b) => b.avgScore - a.avgScore);

  const callsLogged = (
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM candidate_events WHERE organization_id = ? AND type = 'call'${evtRange.sql}`,
      )
      .get(organizationId, ...evtRange.params) as { c: number }
  ).c;

  const submittedToHM = (
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM candidate_events
         WHERE organization_id = ? AND type = 'call' AND detail LIKE '%Submitted to hiring manager%'${evtRange.sql}`,
      )
      .get(organizationId, ...evtRange.params) as { c: number }
  ).c;

  const interviewsScheduled = (
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM interviews WHERE organization_id = ?${rangeClause("created_at", range).sql}`,
      )
      .get(organizationId, ...rangeClause("created_at", range).params) as { c: number }
  ).c;

  // Time to first contact: gap between first application and first logged
  // call/email, for candidates who applied within the window.
  const contactRows = db
    .prepare(
      `SELECT a.candidate_id AS cid,
              MIN(a.created_at) AS applied_at,
              (SELECT MIN(e.created_at) FROM candidate_events e
                 WHERE e.candidate_id = a.candidate_id AND e.type IN ('call','email_sent')) AS first_contact
       FROM applications a
       WHERE a.organization_id = ? AND a.candidate_id != ''${appRange.sql.replace(/created_at/g, "a.created_at")}
       GROUP BY a.candidate_id`,
    )
    .all(organizationId, ...appRange.params) as Array<{ cid: string; applied_at: string; first_contact: string | null }>;
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

  // Outcomes within the window: count status-change events into interview/hired,
  // falling back to nothing when there's no activity.
  const inInterview = (
    db
      .prepare(
        `SELECT COUNT(DISTINCT candidate_id) AS c FROM candidate_events
         WHERE organization_id = ? AND type = 'stage_change'
           AND (detail LIKE '%to interview%' OR detail LIKE '%to Interview%')${evtRange.sql}`,
      )
      .get(organizationId, ...evtRange.params) as { c: number }
  ).c;
  const hired = (
    db
      .prepare(
        `SELECT COUNT(DISTINCT candidate_id) AS c FROM candidate_events
         WHERE organization_id = ? AND type = 'stage_change'
           AND (detail LIKE '%to hired%' OR detail LIKE '%to Hired%')${evtRange.sql}`,
      )
      .get(organizationId, ...evtRange.params) as { c: number }
  ).c;

  const jobSummaries = getJobScreeningSummaries(organizationId, access);
  const publishedJobs = jobs.filter((j) => j.status === "published");
  const openRolesNoStrong = publishedJobs.filter((j) => (jobSummaries[j.id]?.strongFit ?? 0) === 0).length;

  return {
    totalApplicants,
    screened,
    screenCompletionRate,
    strongFit: funnel.strong ?? 0,
    needsReview: funnel.review ?? 0,
    highRisk: funnel.high_risk ?? 0,
    avgScore: funnel.avg_score == null ? null : Math.round(funnel.avg_score),
    bySource,
    byChannel,
    avgScoreByRole,
    callsLogged,
    timeToFirstContactDays,
    submittedToHM,
    interviewsScheduled,
    inInterview,
    hired,
    openRolesNoStrong,
    openPublishedRoles: publishedJobs.length,
  };
}

/** Human labels + CSV rows for a report, used by the page and the export route. */
export function reportToCsvRows(r: ReportData): Array<[string, string]> {
  const channelRows: Array<[string, string]> = r.byChannel.map((c) => [
    `Applications — ${c.label}`,
    `${c.applicants} (${c.strongFit} strong-fit)`,
  ]);
  return [
    ["Metric", "Value"],
    ["Applicants", String(r.totalApplicants)],
    ...channelRows,
    ["Screened", String(r.screened)],
    ["Screen completion rate", r.screenCompletionRate === null ? "—" : `${r.screenCompletionRate}%`],
    ["Average skills score", r.avgScore === null ? "—" : String(r.avgScore)],
    ["Strong-fit", String(r.strongFit)],
    ["Needs review", String(r.needsReview)],
    ["High-risk", String(r.highRisk)],
    ["Calls logged", String(r.callsLogged)],
    ["Time to first contact (days)", r.timeToFirstContactDays === null ? "—" : String(r.timeToFirstContactDays)],
    ["Submitted to hiring manager", String(r.submittedToHM)],
    ["Interviews scheduled", String(r.interviewsScheduled)],
    ["Moved to interview", String(r.inInterview)],
    ["Hired", String(r.hired)],
    ["Open roles with no strong candidate", String(r.openRolesNoStrong)],
    ["Open published roles", String(r.openPublishedRoles)],
  ];
}

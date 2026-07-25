import { randomUUID } from "crypto";
import { getDb, type Job, type Organization } from "./db";
import { getOrgJobUrl } from "./env";

/**
 * Job Distribution Status.
 *
 * For each published job we show where it is Live, Eligible, Feed-ready, or
 * needs Manual action across six channels. Statuses are *derived* from the
 * job's published state, with optional owner-set *manual* overrides (e.g.
 * marking an Indeed feed "Registered") stored per (job, channel). We never
 * claim a job is automatically posted to a board unless a real integration
 * confirms it — none exist yet, so LinkedIn/ZipRecruiter default to
 * "Manual share required".
 */

export type DistributionChannel =
  | "careers"
  | "google_jobs"
  | "indeed"
  | "job_boards"
  | "linkedin"
  | "ziprecruiter";

export type StatusTone = "live" | "eligible" | "ready" | "off";

export type ChannelView = {
  channel: DistributionChannel;
  name: string;
  status: string; // machine value
  label: string; // buyer-facing label
  tone: StatusTone;
  detail: string;
  /** Manual statuses an owner/recruiter can set for this channel (label + value). */
  manualOptions: { value: string; label: string }[];
  /** The manual status currently applied, if any. */
  manual: string | null;
};

const TONE_FOR: Record<string, StatusTone> = {
  live: "live",
  live_confirmed: "live",
  posted: "live",
  indexed: "live",
  eligible: "eligible",
  submitted: "eligible",
  registered: "eligible",
  api_connected: "eligible",
  feed_ready: "ready",
  manual_share_required: "ready",
  not_live: "off",
  not_eligible: "off",
  not_connected: "off",
  not_ready: "off",
};

const LABELS: Record<string, string> = {
  live: "Live",
  live_confirmed: "Live confirmed",
  posted: "Manually posted",
  indexed: "Indexed",
  eligible: "Eligible",
  submitted: "Submitted",
  registered: "Feed registered",
  api_connected: "API connected",
  feed_ready: "Feed ready",
  manual_share_required: "Manual share required",
  not_live: "Not live",
  not_eligible: "Not eligible",
  not_connected: "Not connected",
  not_ready: "Not ready",
};

/**
 * Buyer-facing BADGE label for a manual (team-recorded) status, per channel.
 * The same value (e.g. "submitted") reads differently by channel — "Indexing
 * requested" for Google, "Feed submitted" for XML boards — and team-set states
 * are tagged "· Manually marked" so they can't be mistaken for a verified
 * automatic post. "Live confirmed" means a human verified the external listing.
 */
const CHANNEL_MANUAL_LABELS: Record<DistributionChannel, Record<string, string>> = {
  careers: {},
  google_jobs: { submitted: "Indexing requested · Manually marked", indexed: "Indexed · Manually marked" },
  indeed: { registered: "Feed registered · Manually marked", live_confirmed: "Live confirmed" },
  job_boards: { submitted: "Feed submitted · Manually marked", live_confirmed: "Live confirmed" },
  linkedin: { posted: "Manually posted" },
  ziprecruiter: { posted: "Manually posted" },
};

/**
 * Short label shown on each manual CONTROL chip, per channel (the panel prefixes
 * it with "Mark:" → e.g. "Mark: Indexing requested"). Explicit, never claiming
 * automatic posting or that a board indexed the job.
 */
const CHANNEL_CONTROL_LABELS: Record<DistributionChannel, Record<string, string>> = {
  careers: {},
  google_jobs: { submitted: "Indexing requested", indexed: "Indexed" },
  indeed: { registered: "Feed registered", live_confirmed: "Live confirmed" },
  job_boards: { submitted: "Feed submitted", live_confirmed: "Live confirmed" },
  linkedin: { posted: "Manually posted" },
  ziprecruiter: { posted: "Manually posted" },
};

// Manual statuses each channel exposes to owners. Deliberately excludes states
// that would imply a real integration we don't have (e.g. LinkedIn "API
// connected"), so the UI can never overclaim automatic posting.
const MANUAL_OPTIONS: Record<DistributionChannel, string[]> = {
  careers: [],
  google_jobs: ["submitted", "indexed"],
  indeed: ["registered", "live_confirmed"],
  job_boards: ["submitted", "live_confirmed"],
  linkedin: ["posted"],
  ziprecruiter: ["posted"],
};

export function isChannel(value: unknown): value is DistributionChannel {
  return (
    value === "careers" ||
    value === "google_jobs" ||
    value === "indeed" ||
    value === "job_boards" ||
    value === "linkedin" ||
    value === "ziprecruiter"
  );
}

/** Whether a manual status is allowed for a channel (empty string = reset). */
export function isValidManualStatus(channel: DistributionChannel, status: string): boolean {
  return status === "" || MANUAL_OPTIONS[channel].includes(status);
}

export function getManualStatuses(jobId: string): Partial<Record<DistributionChannel, string>> {
  const rows = getDb()
    .prepare("SELECT channel, status FROM job_channel_status WHERE job_id = ?")
    .all(jobId) as Array<{ channel: string; status: string }>;
  const out: Partial<Record<DistributionChannel, string>> = {};
  for (const r of rows) {
    if (isChannel(r.channel)) out[r.channel] = r.status;
  }
  return out;
}

/** Set (or, with an empty status, clear) a manual distribution override. */
export function setManualStatus(input: {
  organizationId: string;
  jobId: string;
  channel: DistributionChannel;
  status: string;
  updatedBy: string;
}): void {
  const db = getDb();
  if (!input.status) {
    db.prepare("DELETE FROM job_channel_status WHERE job_id = ? AND channel = ?").run(input.jobId, input.channel);
    return;
  }
  db.prepare(
    `INSERT INTO job_channel_status (id, organization_id, job_id, channel, status, updated_at, updated_by)
     VALUES (@id, @organization_id, @job_id, @channel, @status, @updated_at, @updated_by)
     ON CONFLICT(job_id, channel) DO UPDATE SET status = @status, updated_at = @updated_at, updated_by = @updated_by`,
  ).run({
    id: randomUUID(),
    organization_id: input.organizationId,
    job_id: input.jobId,
    channel: input.channel,
    status: input.status,
    updated_at: new Date().toISOString(),
    updated_by: input.updatedBy,
  });
}

function view(
  channel: DistributionChannel,
  name: string,
  status: string,
  detail: string,
  manual: string | null,
): ChannelView {
  // When the effective status IS the team's manual override, use the
  // channel-aware "· Manually marked" label; otherwise the system-derived one.
  const isManual = manual != null && status === manual;
  const label = isManual
    ? CHANNEL_MANUAL_LABELS[channel][status] ?? LABELS[status] ?? status
    : LABELS[status] ?? status;
  return {
    channel,
    name,
    status,
    label,
    tone: TONE_FOR[status] ?? "off",
    detail,
    manualOptions: MANUAL_OPTIONS[channel].map((v) => ({
      value: v,
      label: CHANNEL_CONTROL_LABELS[channel][v] ?? LABELS[v] ?? v,
    })),
    manual,
  };
}

/**
 * The full distribution view for a job. `published` gates every "live/eligible/
 * ready" state; manual overrides only apply on top of a published job.
 */
export function getJobDistribution(
  job: Job,
  manual: Partial<Record<DistributionChannel, string>>,
): ChannelView[] {
  const published = job.status === "published";
  const m = (c: DistributionChannel) => manual[c] ?? null;

  return [
    view(
      "careers",
      "Careers page",
      published ? "live" : "not_live",
      published
        ? "On your public careers page — candidates can view and apply."
        : "Publish this job to make it live on your careers page.",
      null,
    ),
    view(
      "google_jobs",
      "Google Jobs",
      !published ? "not_eligible" : m("google_jobs") ?? "eligible",
      "Eligible for Google Jobs once Google crawls it. Placement is not guaranteed.",
      m("google_jobs"),
    ),
    view(
      "indeed",
      "Indeed",
      !published ? "not_connected" : m("indeed") ?? "feed_ready",
      "Included in your Indeed XML feed. Mark it Registered once you've submitted the feed to Indeed.",
      m("indeed"),
    ),
    view(
      "job_boards",
      "Job boards (XML)",
      !published ? "not_ready" : m("job_boards") ?? "feed_ready",
      "In your standard XML feed for Jooble, Talent.com, Adzuna, Careerjet, and others.",
      m("job_boards"),
    ),
    view(
      "linkedin",
      "LinkedIn",
      !published ? "not_connected" : m("linkedin") ?? "manual_share_required",
      "No automatic posting — share the link manually. Mark Posted once you've shared it.",
      m("linkedin"),
    ),
    view(
      "ziprecruiter",
      "ZipRecruiter",
      !published ? "not_connected" : m("ziprecruiter") ?? "manual_share_required",
      "No automatic posting — post manually. Mark Posted once you've shared it.",
      m("ziprecruiter"),
    ),
  ];
}

/** Public source parameters we tag on generated links for attribution. */
export type LinkSource =
  | "careers"
  | "google_jobs"
  | "indeed"
  | "linkedin"
  | "ziprecruiter"
  | "qr"
  | "flyer";

/** A public job URL tagged with a source param for attribution. */
export function sourcedJobUrl(orgSlug: string, jobSlug: string, source: LinkSource): string {
  return `${getOrgJobUrl(orgSlug, jobSlug)}?source=${source}`;
}

/** Ready-to-paste LinkedIn share text (no automatic posting implied). */
export function linkedInShareText(job: Job, organization: Organization, orgSlug: string): string {
  const url = sourcedJobUrl(orgSlug, job.slug, "linkedin");
  return [
    `We're hiring: ${job.title}${job.location ? ` (${job.location})` : ""} at ${organization.name}.`,
    "",
    "Apply and take a short skills check here:",
    url,
    "",
    "#hiring #manufacturing #skilledtrades",
  ].join("\n");
}

/** Ready-to-paste manual posting text for ZipRecruiter or any board. */
export function manualPostingText(job: Job, organization: Organization, orgSlug: string): string {
  const url = sourcedJobUrl(orgSlug, job.slug, "ziprecruiter");
  return [
    `${job.title} — ${organization.name}`,
    job.location ? `Location: ${job.location}` : "",
    "",
    `Apply: ${url}`,
  ]
    .filter(Boolean)
    .join("\n");
}

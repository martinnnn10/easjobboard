import { randomUUID } from "crypto";
import { getDb } from "./db";

/**
 * Tracks the result of pushing a job to an external board that uses a push API
 * (currently 100Hires). One row per (job, channel), upserted on each sync so the
 * distribution page can show live status and the last error, if any.
 */

export type SyndicationStatus = "posted" | "error" | "pending";

export type JobSyndication = {
  jobId: string;
  channel: string;
  externalId: string;
  status: SyndicationStatus | "";
  url: string;
  error: string;
  syncedAt: string | null;
};

function rowToSyndication(row: Record<string, unknown>): JobSyndication {
  return {
    jobId: row.job_id as string,
    channel: row.channel as string,
    externalId: (row.external_id as string) ?? "",
    status: (row.status as SyndicationStatus | "") ?? "",
    url: (row.url as string) ?? "",
    error: (row.error as string) ?? "",
    syncedAt: (row.synced_at as string | null) ?? null,
  };
}

export function upsertSyndication(input: {
  organizationId: string;
  jobId: string;
  channel: string;
  externalId?: string;
  status: SyndicationStatus;
  url?: string;
  error?: string;
}): void {
  getDb()
    .prepare(
      `INSERT INTO job_syndications (id, organization_id, job_id, channel, external_id, status, url, error, synced_at, created_at)
       VALUES (@id, @organization_id, @job_id, @channel, @external_id, @status, @url, @error, @synced_at, @created_at)
       ON CONFLICT(job_id, channel) DO UPDATE SET
         external_id = excluded.external_id,
         status = excluded.status,
         url = excluded.url,
         error = excluded.error,
         synced_at = excluded.synced_at`,
    )
    .run({
      id: randomUUID(),
      organization_id: input.organizationId,
      job_id: input.jobId,
      channel: input.channel,
      external_id: input.externalId ?? "",
      status: input.status,
      url: input.url ?? "",
      error: input.error ?? "",
      synced_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });
}

export function getSyndicationsForOrg(
  organizationId: string,
  channel?: string,
): Record<string, JobSyndication> {
  const rows = channel
    ? (getDb()
        .prepare("SELECT * FROM job_syndications WHERE organization_id = ? AND channel = ?")
        .all(organizationId, channel) as Record<string, unknown>[])
    : (getDb()
        .prepare("SELECT * FROM job_syndications WHERE organization_id = ?")
        .all(organizationId) as Record<string, unknown>[]);

  const byJob: Record<string, JobSyndication> = {};
  for (const row of rows) {
    const syn = rowToSyndication(row);
    byJob[syn.jobId] = syn;
  }
  return byJob;
}
